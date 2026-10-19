"""Pushes new messages to connected browsers over a WebSocket.

Every message is inserted through this API, so each insert calls `publish` and the hub fans it out:
doctors receive every message (the inbox shows every conversation), a patient only their own.
Connections live in this process's memory, so this assumes a single server process (as the Dockerfile
runs it); with several workers or instances you'd need a shared broker such as Redis pub/sub.
"""

import asyncio
import threading
import time
from dataclasses import dataclass, field

import anyio
import jwt
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials

from .config import JWT_SECRET
from .security import get_current_doctor, get_current_patient

router = APIRouter()

AUTH_TIMEOUT_SECONDS = 10
QUEUE_SIZE = 100  # events buffered per connection before a stalled client is disconnected
CLOSE_UNAUTHORIZED = 4401  # app-defined close code: bad, missing or expired token


@dataclass(eq=False)
class _Connection:
    role: str
    user_id: str
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(QUEUE_SIZE))
    stalled: asyncio.Event = field(default_factory=asyncio.Event)

    def offer(self, event: dict) -> None:
        # Runs on the connection's event loop.
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            self.stalled.set()


_connections: set[_Connection] = set()
_lock = threading.Lock()


def publish(message: dict) -> None:
    """Send a newly inserted message row to everyone allowed to see it. Safe to call from any thread."""
    event = {"type": "message", "message": message}
    with _lock:
        targets = [c for c in _connections if c.role == "doctor" or c.user_id == message["patient_id"]]
    for c in targets:
        try:
            c.loop.call_soon_threadsafe(c.offer, event)
        except RuntimeError:  # loop already closed: the connection is going away
            pass


def _authenticate(token: str) -> tuple[str, dict, float]:
    """Returns (role, user, token expiry) or raises HTTPException, using the same checks as the REST API."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Not authenticated")
    role = payload.get("role", "doctor")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = get_current_doctor(creds) if role == "doctor" else get_current_patient(creds)
    return role, user, payload["exp"]


@router.websocket("/api/ws")
async def websocket(ws: WebSocket):
    """Protocol: the client's first frame is `{"token": "<JWT>"}` (browsers can't set headers on a
    WebSocket, and a token in the URL would end up in logs). The server replies `{"type": "ready"}`, then
    sends `{"type": "message", "message": {...}}` for each new message. Closes with 4401 if the token is
    bad or expires."""
    await ws.accept()
    try:
        with anyio.fail_after(AUTH_TIMEOUT_SECONDS):
            first = await ws.receive_json()
        role, user, expires_at = await anyio.to_thread.run_sync(_authenticate, str(first.get("token", "")))
    except (TimeoutError, WebSocketDisconnect):
        await _close(ws, CLOSE_UNAUTHORIZED)
        return
    except Exception:  # bad JSON, bad token, unknown user
        await _close(ws, CLOSE_UNAUTHORIZED)
        return

    conn = _Connection(role=role, user_id=user["id"], loop=asyncio.get_running_loop())
    with _lock:
        _connections.add(conn)
    try:
        await ws.send_json({"type": "ready"})
        # Stays open until the client leaves, the token expires, or the client stops reading.
        with anyio.move_on_after(max(0, expires_at - time.time())):
            async with anyio.create_task_group() as tg:

                async def send_events():
                    while True:
                        await ws.send_json(await conn.queue.get())

                async def watch_disconnect():
                    while True:
                        if (await ws.receive())["type"] == "websocket.disconnect":
                            break
                    tg.cancel_scope.cancel()

                async def watch_stalled():
                    await conn.stalled.wait()
                    tg.cancel_scope.cancel()

                tg.start_soon(send_events)
                tg.start_soon(watch_disconnect)
                tg.start_soon(watch_stalled)
        await _close(ws, CLOSE_UNAUTHORIZED if time.time() >= expires_at else 1000)
    except (WebSocketDisconnect, RuntimeError):
        pass  # client went away mid-send
    finally:
        with _lock:
            _connections.discard(conn)


async def _close(ws: WebSocket, code: int) -> None:
    try:
        await ws.close(code)
    except RuntimeError:  # already closed
        pass
