import pytest
from starlette.websockets import WebSocketDisconnect

from app import realtime
from app.security import create_token

from .conftest import auth


def _connect(client, subject: dict, role: str):
    ws = client.websocket_connect("/api/ws")
    session = ws.__enter__()
    session.send_json({"token": create_token(subject["id"], role=role)})
    assert session.receive_json() == {"type": "ready"}
    return ws, session


def test_rejects_bad_token(client):
    with client.websocket_connect("/api/ws") as ws:
        ws.send_json({"token": "not-a-jwt"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == realtime.CLOSE_UNAUTHORIZED


def test_rejects_token_for_deleted_user(client, db, doctor):
    db.tables["doctors"].clear()
    with client.websocket_connect("/api/ws") as ws:
        ws.send_json({"token": create_token(doctor["id"])})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == realtime.CLOSE_UNAUTHORIZED


def test_doctor_receives_patient_message(client, db, doctor, patient):
    ctx, ws = _connect(client, doctor, "doctor")
    try:
        res = client.post("/api/portal/messages", headers=auth(patient, role="patient"), json={"body": "Feeling dizzy"})
        assert res.status_code == 201
        event = ws.receive_json()
        assert event["type"] == "message"
        assert event["message"]["id"] == res.json()["id"]
        assert (event["message"]["sender"], event["message"]["body"]) == ("patient", "Feeling dizzy")
    finally:
        ctx.__exit__(None, None, None)


def test_patient_only_receives_own_messages(client, db, doctor, patient):
    other = db.add("patients", doctor_id=doctor["id"], first_name="Ben", last_name="Cole")
    ctx, ws = _connect(client, patient, "patient")
    try:
        client.post(f"/api/messages/patient/{other['id']}", headers=auth(doctor), json={"body": "For Ben"})
        client.post(f"/api/messages/patient/{patient['id']}", headers=auth(doctor), json={"body": "For Amy"})
        # Ben's message was never queued for Amy, so the next event is her own.
        assert ws.receive_json()["message"]["body"] == "For Amy"
    finally:
        ctx.__exit__(None, None, None)


def test_inbound_message_is_published(client, db, doctor, patient):
    ctx, ws = _connect(client, doctor, "doctor")
    try:
        client.post("/api/messages/inbound", json={"patient_id": patient["id"], "body": "Hello"})
        assert ws.receive_json()["message"]["body"] == "Hello"
    finally:
        ctx.__exit__(None, None, None)


def test_disconnect_unregisters(client, doctor):
    ctx, _ = _connect(client, doctor, "doctor")
    assert len(realtime._connections) == 1
    ctx.__exit__(None, None, None)
    assert realtime._connections == set()
