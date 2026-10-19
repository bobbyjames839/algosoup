import json
import os
import threading
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone

import anyio
import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from postgrest.exceptions import APIError
from pydantic import validate_call

from ..config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    OPENAI_REASONING_EFFORT,
    ASSISTANT_DAILY_TOKENS_PER_DOCTOR,
    ASSISTANT_DAILY_TOKENS_TOTAL,
    ASSISTANT_HISTORY_MESSAGES,
    ASSISTANT_MAX_TOKENS_PER_QUESTION,
    ASSISTANT_REQUESTS_PER_DAY,
    ASSISTANT_REQUESTS_PER_MINUTE,
)
from ..db import supabase
from ..schemas import AssistantChatRequest
from ..security import get_current_doctor

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

IN_RANGE = (3.9, 10.0)  # mmol/L target range used for time-in-range
DISPLAY_LIMIT = 200  # most recent conversation messages returned to the chat UI
MAX_TOOL_ROUNDS = 8
MAX_OUTPUT_TOKENS = 8192  # per model call, including reasoning tokens

SYSTEM = """You are a clinical assistant inside GlucoCare, a portal clinicians use to manage patients with Type 1 diabetes.
The clinician asking questions is {doctor_name}. Today is {today} (UTC).

Use the tools to look up patients, glucose readings, appointments, visit records and patient messages. Never guess at patient data: if you haven't looked it up, look it up; if it isn't recorded, say so. When a question names a patient, find them with search_patients first. If several patients match, ask which one is meant.

Glucose values are in mmol/L and the target range is 3.9-10.0. Answer concisely in plain text (short paragraphs or simple "-" bullet lists, no tables or headings), quoting the specific numbers and dates you relied on. You support the clinician's judgment and don't replace it: flag anything that looks clinically concerning, but leave treatment decisions to them."""


def _dump(data) -> str:
    return json.dumps(data, default=str)


def _name(p: dict | None) -> str | None:
    return f"{p['first_name']} {p['last_name']}" if p else None


def _glucose_stats(readings: list[dict]) -> dict | None:
    values = [float(r["value_mmol"]) for r in readings]
    if not values:
        return None
    low, high = IN_RANGE
    return {
        "count": len(values),
        "average_mmol": round(sum(values) / len(values), 1),
        "min_mmol": min(values),
        "max_mmol": max(values),
        "percent_in_range": round(100 * sum(low <= v <= high for v in values) / len(values)),
        "hypos_below_3_9": sum(v < low for v in values),
        "highs_above_10": sum(v > high for v in values),
    }


@validate_call
def search_patients(query: str = "") -> str:
    """Find patients by name or email. Returns id, name, date of birth, diagnosis date and contact details.

    Args:
        query: Part of the patient's first name, last name or email. Leave empty to list every patient.
    """
    rows = supabase.table("patients").select("id, doctor_id, first_name, last_name, date_of_birth, email, phone, diagnosis_date, created_at").order("last_name").execute().data
    words = query.lower().split()
    matches = [p for p in rows if all(w in f"{p['first_name']} {p['last_name']} {p['email'] or ''}".lower() for w in words)]
    if len(matches) > 25:
        return _dump({"total_matches": len(matches), "showing": 25, "patients": matches[:25], "note": "Narrow the query to see the rest."})
    return _dump(matches)


@validate_call
def get_glucose_readings(patient_id: str, days: int = 14) -> str:
    """Get a patient's glucose readings over the last N days, with summary statistics (average, min/max, time in range, hypo/high counts) overall and per context (fasting, pre_meal, post_meal, bedtime).

    Args:
        patient_id: The patient's id from search_patients.
        days: How many days back to look (1-90).
    """
    days = max(1, min(days, 90))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    readings = (
        supabase.table("glucose_readings").select("value_mmol, context, recorded_at")
        .eq("patient_id", patient_id).gte("recorded_at", since).order("recorded_at").execute().data
    )
    contexts = sorted({r["context"] for r in readings})
    return _dump({
        "days": days,
        "overall": _glucose_stats(readings),
        "by_context": {c: _glucose_stats([r for r in readings if r["context"] == c]) for c in contexts},
        "readings": readings,
    })


@validate_call
def get_appointments(patient_id: str) -> str:
    """Get all of a patient's appointments (past and upcoming), newest first, each with its visit record if one exists: vitals (height, weight, HbA1c, blood pressure, overall score), chief complaint, assessment, plan, insulin regimen and notes.

    Args:
        patient_id: The patient's id from search_patients.
    """
    rows = (
        supabase.table("appointments").select("*, appointment_data(*)")
        .eq("patient_id", patient_id).order("scheduled_at", desc=True).execute().data
    )
    return _dump(rows)


@validate_call
def get_messages(patient_id: str, limit: int = 50) -> str:
    """Get the most recent messages between a patient and their clinician, oldest first.

    Args:
        patient_id: The patient's id from search_patients.
        limit: Maximum number of messages to return (1-100).
    """
    limit = max(1, min(limit, 100))
    rows = (
        supabase.table("messages").select("sender, body, is_read, created_at")
        .eq("patient_id", patient_id).order("created_at", desc=True).limit(limit).execute().data
    )
    return _dump(rows[::-1])


@validate_call
def list_appointments_between(start_date: str, end_date: str) -> str:
    """List appointments across all patients between two dates (inclusive), e.g. to answer "who am I seeing this week?".

    Args:
        start_date: ISO date, e.g. 2026-10-19.
        end_date: ISO date, e.g. 2026-10-26.
    """
    try:
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date() + timedelta(days=1)
    except ValueError:
        return "Error: dates must be ISO format, e.g. 2026-10-19."
    rows = (
        supabase.table("appointments")
        .select("id, scheduled_at, appointment_type, status, title, description, duration_minutes, location, patients(id, first_name, last_name)")
        .gte("scheduled_at", start.isoformat()).lt("scheduled_at", end.isoformat()).order("scheduled_at").limit(200).execute().data
    )
    for a in rows:
        a["patient"] = a.pop("patients", None)
    return _dump(rows)


@validate_call
def get_unread_messages() -> str:
    """List patients with unread messages and the unread message text, across all patients."""
    rows = (
        supabase.table("messages").select("body, created_at, patients(id, first_name, last_name)")
        .eq("sender", "patient").eq("is_read", False).order("created_at").limit(100).execute().data
    )
    return _dump([{"patient": _name(m["patients"]), "patient_id": m["patients"]["id"], "body": m["body"], "created_at": m["created_at"]} for m in rows])


def _function(fn, properties: dict) -> dict:
    """OpenAI function tool for fn: description from the docstring's first paragraph, strict schema from properties."""
    return {
        "type": "function",
        "name": fn.__name__,
        "description": fn.__doc__.split("\n\n")[0].strip(),
        "parameters": {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False},
        "strict": True,
    }


PATIENT_ID = {"type": "string", "description": "The patient's id from search_patients."}
TOOLS = {
    search_patients: {"query": {"type": "string", "description": "Part of the patient's first name, last name or email. Empty string lists every patient."}},
    get_glucose_readings: {"patient_id": PATIENT_ID, "days": {"type": "integer", "description": "How many days back to look (1-90). Use 14 if unsure."}},
    get_appointments: {"patient_id": PATIENT_ID},
    get_messages: {"patient_id": PATIENT_ID, "limit": {"type": "integer", "description": "Maximum number of messages to return (1-100). Use 50 if unsure."}},
    list_appointments_between: {
        "start_date": {"type": "string", "description": "ISO date, e.g. 2026-10-19."},
        "end_date": {"type": "string", "description": "ISO date, e.g. 2026-10-26."},
    },
    get_unread_messages: {},
}
TOOL_PARAMS = [_function(fn, props) for fn, props in TOOLS.items()]
TOOLS_BY_NAME = {fn.__name__: fn for fn in TOOLS}
# Shown in the UI while a tool runs.
TOOL_LABELS = {
    "search_patients": "Searching patients",
    "get_glucose_readings": "Reading glucose data",
    "get_appointments": "Reading appointments and visit records",
    "get_messages": "Reading messages",
    "list_appointments_between": "Checking the schedule",
    "get_unread_messages": "Checking unread messages",
}

# Doctors with a question currently being answered; stops one account running many expensive requests in parallel.
_in_flight: set[str] = set()
_in_flight_lock = threading.Lock()


def _estimate_tokens(text: str) -> int:
    # Rough count (~4 characters per token), only used when a call is interrupted before OpenAI reports usage.
    return len(text) // 4


def _check_limits(doctor_id: str) -> None:
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    usage = supabase.table("assistant_usage")
    recent = usage.select("id", count="exact").eq("doctor_id", doctor_id).gte("created_at", (now - timedelta(minutes=1)).isoformat()).execute().count
    if recent >= ASSISTANT_REQUESTS_PER_MINUTE:
        raise HTTPException(429, "You're asking questions too quickly. Wait a minute and try again.")
    today = usage.select("doctor_id, input_tokens, output_tokens").gte("created_at", midnight).execute().data
    mine = [r for r in today if r["doctor_id"] == doctor_id]
    if len(mine) >= ASSISTANT_REQUESTS_PER_DAY or sum(r["input_tokens"] + r["output_tokens"] for r in mine) >= ASSISTANT_DAILY_TOKENS_PER_DOCTOR:
        raise HTTPException(429, "You've reached today's assistant limit. It resets at midnight UTC.")
    if sum(r["input_tokens"] + r["output_tokens"] for r in today) >= ASSISTANT_DAILY_TOKENS_TOTAL:
        raise HTTPException(429, "The assistant has reached its daily usage limit. It resets at midnight UTC.")


def _event(**data) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/chat")
def chat(payload: AssistantChatRequest, doctor: dict = Depends(get_current_doctor)):
    """Streams the answer as server-sent events. Each `data:` line is JSON with a `type`:
    `thinking` / `text` (deltas to append), `tool` (a lookup started), `error`, then `done`."""
    if not OPENAI_API_KEY or not OPENAI_MODEL:
        raise HTTPException(503, "The assistant isn't configured: set OPENAI_API_KEY and OPENAI_MODEL in backend/.env")

    # Limits are checked before the stream starts so they come back as normal HTTP errors.
    with _in_flight_lock:
        if doctor["id"] in _in_flight:
            raise HTTPException(429, "Wait for the current answer before asking another question.")
        _in_flight.add(doctor["id"])
    try:
        try:
            _check_limits(doctor["id"])
        except APIError:
            # Fail closed: without usage tracking there's no spend limit.
            raise HTTPException(503, "Assistant usage tracking isn't set up: run backend/migrations/002_assistant_usage.sql")
        try:
            history = _model_history(doctor["id"])
        except APIError:
            raise HTTPException(503, "Assistant conversation storage isn't set up: run backend/migrations/004_assistant_messages.sql")
    except BaseException:
        _release(doctor["id"])
        raise

    return StreamingResponse(
        _stream_answer(payload.message, history, doctor),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/messages")
def conversation(doctor: dict = Depends(get_current_doctor)):
    """The doctor's one continuous assistant conversation (most recent DISPLAY_LIMIT messages), oldest first."""
    try:
        rows = (
            supabase.table("assistant_messages").select("id, role, content, reasoning, steps, created_at")
            .eq("doctor_id", doctor["id"]).order("created_at", desc=True).limit(DISPLAY_LIMIT).execute().data
        )
    except APIError:
        raise HTTPException(503, "Assistant conversation storage isn't set up: run backend/migrations/004_assistant_messages.sql")
    return rows[::-1]


def _model_history(doctor_id: str) -> list[dict]:
    """The last ASSISTANT_HISTORY_MESSAGES messages, oldest first, as model input. Starts with a question,
    since a reply whose question was cut off is meaningless context."""
    rows = (
        supabase.table("assistant_messages").select("role, content")
        .eq("doctor_id", doctor_id).order("created_at", desc=True).limit(ASSISTANT_HISTORY_MESSAGES).execute().data
    )[::-1]
    while rows and rows[0]["role"] != "user":
        rows.pop(0)
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def _release(doctor_id: str) -> None:
    with _in_flight_lock:
        _in_flight.discard(doctor_id)


def _run_tool(name: str, arguments: str) -> str:
    fn = TOOLS_BY_NAME.get(name)
    if fn is None:
        return f"Error: unknown tool {name}."
    try:
        return fn(**json.loads(arguments))  # validate_call checks argument types before the lookup runs
    except Exception as e:  # bad arguments or a failed lookup: let the model see it and recover
        return f"Error: {e}"


async def _stream_answer(question: str, history: list[dict], doctor: dict) -> AsyncIterator[str]:
    asked_at = datetime.now(timezone.utc)
    history = [*history, {"role": "user", "content": question}]
    # What gets saved to the conversation: the answer text (not transient errors), reasoning and lookup steps.
    reply = {"content": "", "reasoning": "", "steps": []}
    instructions = SYSTEM.format(doctor_name=doctor["full_name"], today=datetime.now(timezone.utc).date().isoformat())
    client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    input_tokens = output_tokens = 0
    call_in = call_out = 0  # estimate for the call in progress, so an interrupted call is still counted
    sent = {"thinking": False, "text": False}  # whether anything of each kind has been streamed yet

    def separator(kind: str) -> str:
        return "\n\n" if sent[kind] else ""

    def answer(text: str) -> str:
        reply["content"] += text
        return _event(type="text", text=text)

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            call_in, call_out = _estimate_tokens(instructions + json.dumps(history, default=str)), 0
            response = None
            stream = await client.responses.create(
                model=OPENAI_MODEL,
                instructions=instructions,
                input=history,
                tools=TOOL_PARAMS,
                reasoning={"effort": OPENAI_REASONING_EFFORT, "summary": "auto"},
                max_output_tokens=MAX_OUTPUT_TOKENS,
                # Don't keep patient data at OpenAI; reasoning is carried between tool calls encrypted instead.
                store=False,
                include=["reasoning.encrypted_content"],
                stream=True,
            )
            async with stream:
                async for event in stream:
                    if event.type == "response.reasoning_summary_part.added":
                        if sent["thinking"]:
                            reply["reasoning"] += "\n\n"
                            yield _event(type="thinking", text="\n\n")
                    elif event.type == "response.reasoning_summary_text.delta":
                        sent["thinking"] = True
                        call_out += _estimate_tokens(event.delta) or 1
                        reply["reasoning"] += event.delta
                        yield _event(type="thinking", text=event.delta)
                    elif event.type == "response.output_item.added":
                        if event.item.type == "function_call":
                            label = TOOL_LABELS.get(event.item.name, "Looking up records")
                            reply["steps"].append(label)
                            yield _event(type="tool", name=event.item.name, label=label)
                        elif event.item.type == "message" and sent["text"]:
                            yield answer("\n\n")
                    elif event.type == "response.output_text.delta":
                        sent["text"] = True
                        call_out += _estimate_tokens(event.delta) or 1
                        yield answer(event.delta)
                    elif event.type in ("response.completed", "response.incomplete"):
                        response = event.response
                    elif event.type == "response.failed":
                        raise RuntimeError(event.response.error.message if event.response.error else "response failed")
                    elif event.type == "error":
                        raise RuntimeError(event.message)
            if response is None:
                raise RuntimeError("stream ended without a response")

            if response.usage:
                input_tokens += response.usage.input_tokens
                output_tokens += response.usage.output_tokens
            call_in = call_out = 0
            history += [item.model_dump(exclude_none=True) for item in response.output]

            calls = [item for item in response.output if item.type == "function_call"]
            refusal = any(c.type == "refusal" for item in response.output if item.type == "message" for c in item.content)
            if refusal:
                yield answer(separator("text") + "I can't help with that request.")
                break
            if response.status == "incomplete" or input_tokens + output_tokens >= ASSISTANT_MAX_TOKENS_PER_QUESTION:
                yield answer(separator("text") + "That question needed more data than I'm allowed to look through at once. Try narrowing it down, e.g. to one patient or a shorter date range.")
                break
            if not calls:
                if not sent["text"]:
                    yield answer("I couldn't produce an answer. Try rephrasing the question.")
                break

            for call in calls:
                output = await anyio.to_thread.run_sync(_run_tool, call.name, call.arguments)
                history.append({"type": "function_call_output", "call_id": call.call_id, "output": output})
        else:
            yield answer(separator("text") + "That question needed more lookups than I'm allowed. Try narrowing it down.")
        yield _event(type="done")
    except openai.RateLimitError:
        yield _event(type="error", message="The assistant is busy right now. Try again in a moment.")
    except openai.APIStatusError as e:
        yield _event(type="error", message=f"Assistant error: {e.message}")
    except (openai.APIConnectionError, RuntimeError):
        yield _event(type="error", message="Couldn't get an answer from the assistant service.")
    finally:
        # Runs on success, failure and client disconnect (which cancels the stream and stops spend).
        # Shielded so the usage write still happens while the request is being cancelled.
        with anyio.CancelScope(shield=True):
            try:
                await anyio.to_thread.run_sync(
                    lambda: supabase.table("assistant_usage").insert(
                        {"doctor_id": doctor["id"], "input_tokens": input_tokens + call_in, "output_tokens": output_tokens + call_out}
                    ).execute()
                )
                # Keep the exchange in the conversation if any answer was given (including a partial one
                # the doctor stopped). Explicit timestamps keep the question before its reply.
                if reply["content"].strip():
                    await anyio.to_thread.run_sync(
                        lambda: supabase.table("assistant_messages").insert([
                            {"doctor_id": doctor["id"], "role": "user", "content": question, "reasoning": None, "steps": [], "created_at": asked_at.isoformat()},
                            {"doctor_id": doctor["id"], "role": "assistant", "content": reply["content"].strip(), "reasoning": reply["reasoning"].strip() or None,
                             "steps": reply["steps"], "created_at": datetime.now(timezone.utc).isoformat()},
                        ]).execute()
                    )
            finally:
                _release(doctor["id"])
