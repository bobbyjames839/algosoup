import json
from datetime import datetime, timezone
from types import SimpleNamespace as NS

import pytest

from app.routers import assistant

from .conftest import auth

QUESTION = {"message": "How is Amy doing?"}


class _Item(NS):
    def model_dump(self, exclude_none=False):
        return {k: v for k, v in vars(self).items() if not (exclude_none and v is None)}


class FakeStream:
    """One scripted model call: streams a text answer and/or function calls, then completes."""

    def __init__(self, text=None, tool_uses=()):
        output = [
            _Item(type="function_call", call_id=f"call_{i}", name=name, arguments=json.dumps(args))
            for i, (name, args) in enumerate(tool_uses)
        ]
        self.events = [NS(type="response.output_item.added", item=item) for item in output]
        if text:
            message = _Item(type="message", role="assistant", content=[NS(type="output_text", text=text)])
            output.insert(0, message)
            self.events += [NS(type="response.output_item.added", item=message), NS(type="response.output_text.delta", delta=text)]
        response = NS(output=output, usage=NS(input_tokens=100, output_tokens=20), status="completed")
        self.events.append(NS(type="response.completed", response=response))

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for e in self.events:
            yield e


@pytest.fixture
def model(monkeypatch):
    """Replaces the OpenAI client; append FakeStreams to `calls` in the order the model should answer."""
    calls: list[FakeStream] = []
    requests: list[dict] = []

    async def create(**kwargs):
        requests.append({**kwargs, "input": list(kwargs["input"])})
        return calls.pop(0)

    client = NS(responses=NS(create=create))
    # Don't depend on a local backend/.env: CI has no OpenAI config.
    monkeypatch.setattr(assistant, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(assistant, "OPENAI_MODEL", "test-model")
    monkeypatch.setattr(assistant.openai, "AsyncOpenAI", lambda **_: client)
    assistant._in_flight.clear()
    return NS(calls=calls, requests=requests)


def _events(res) -> list[dict]:
    return [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")]


def test_glucose_stats():
    stats = assistant._glucose_stats([{"value_mmol": v} for v in (3.0, 5.0, 7.0, 12.0)])
    assert stats == {
        "count": 4,
        "average_mmol": 6.8,
        "min_mmol": 3.0,
        "max_mmol": 12.0,
        "percent_in_range": 50,
        "hypos_below_3_9": 1,
        "highs_above_10": 1,
    }
    assert assistant._glucose_stats([]) is None


def test_search_patients_tool(db, patient):
    db.add("patients", doctor_id=patient["doctor_id"], first_name="Ben", last_name="Cole", email=None)
    assert [p["first_name"] for p in json.loads(assistant.search_patients(query="amy pat"))] == ["Amy"]
    assert len(json.loads(assistant.search_patients(query=""))) == 2


def test_list_appointments_between_rejects_bad_dates(db):
    assert assistant.list_appointments_between(start_date="next week", end_date="2026-10-26").startswith("Error")


def test_chat_requires_doctor(client, model, patient):
    assert client.post("/api/assistant/chat", json=QUESTION).status_code == 401
    assert client.post("/api/assistant/chat", headers=auth(patient, role="patient"), json=QUESTION).status_code == 401


def test_chat_without_api_key(client, monkeypatch, doctor):
    monkeypatch.setattr(assistant, "OPENAI_API_KEY", None)
    assert client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION).status_code == 503


def test_chat_rejects_blank_question(client, model, doctor):
    assert client.post("/api/assistant/chat", headers=auth(doctor), json={"message": "   "}).status_code == 422


def test_chat_rate_limited_per_minute(client, db, model, doctor):
    now = datetime.now(timezone.utc).isoformat()
    for _ in range(assistant.ASSISTANT_REQUESTS_PER_MINUTE):
        db.add("assistant_usage", doctor_id=doctor["id"], input_tokens=10, output_tokens=10, created_at=now)
    res = client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION)
    assert res.status_code == 429
    # The rejected request doesn't leave the doctor stuck as "in flight".
    assert doctor["id"] not in assistant._in_flight


def test_chat_answers_using_tools_and_records_usage(client, db, model, doctor, patient):
    model.calls += [
        FakeStream(tool_uses=[("search_patients", {"query": "Amy"})]),
        FakeStream(text="Amy is doing well."),
    ]

    res = client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION)

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = _events(res)
    assert events[0] == {"type": "tool", "name": "search_patients", "label": "Searching patients"}
    assert {"type": "text", "text": "Amy is doing well."} in events
    assert events[-1] == {"type": "done"}

    # The tool's result was fed back to the model on the second call.
    tool_result = model.requests[1]["input"][-1]
    assert (tool_result["type"], tool_result["call_id"]) == ("function_call_output", "call_0")
    assert json.loads(tool_result["output"])[0]["id"] == patient["id"]

    # Both model calls are counted in one usage row, and the doctor can ask again.
    [usage] = db.tables["assistant_usage"]
    assert (usage["doctor_id"], usage["input_tokens"], usage["output_tokens"]) == (doctor["id"], 200, 40)
    assert doctor["id"] not in assistant._in_flight


def test_chat_unknown_tool_is_reported_to_model(client, model, doctor):
    model.calls += [FakeStream(tool_uses=[("drop_tables", {})]), FakeStream(text="Sorry.")]
    client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION)
    tool_result = model.requests[1]["input"][-1]
    assert tool_result["output"].startswith("Error")


def test_chat_invalid_tool_arguments_are_reported_to_model(client, model, doctor):
    model.calls += [FakeStream(tool_uses=[("get_glucose_readings", {"patient_id": "p1", "days": "lots"})]), FakeStream(text="Sorry.")]
    client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION)
    assert model.requests[1]["input"][-1]["output"].startswith("Error")


def _saved(db, doctor, role, content, minutes_ago):
    created = datetime.now(timezone.utc).timestamp() - minutes_ago * 60
    return db.add("assistant_messages", doctor_id=doctor["id"], role=role, content=content, reasoning=None, steps=[],
                  created_at=datetime.fromtimestamp(created, timezone.utc).isoformat())


def test_chat_saves_exchange_to_continuous_conversation(client, db, model, doctor):
    model.calls += [FakeStream(tool_uses=[("search_patients", {"query": "Amy"})]), FakeStream(text="Amy is doing well.")]

    client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION)

    res = client.get("/api/assistant/messages", headers=auth(doctor))
    assert res.status_code == 200
    assert [(m["role"], m["content"], m["steps"]) for m in res.json()] == [
        ("user", "How is Amy doing?", []),
        ("assistant", "Amy is doing well.", ["Searching patients"]),
    ]


def test_chat_sends_only_last_messages_to_model(client, db, model, doctor, monkeypatch):
    monkeypatch.setattr(assistant, "ASSISTANT_HISTORY_MESSAGES", 3)
    for i, (role, content) in enumerate([("user", "q1"), ("assistant", "a1"), ("user", "q2"), ("assistant", "a2")]):
        _saved(db, doctor, role, content, minutes_ago=10 - i)
    model.calls.append(FakeStream(text="a3"))

    client.post("/api/assistant/chat", headers=auth(doctor), json={"message": "q3"})

    # The last 3 saved messages are a1, q2, a2; a1 is dropped so the context starts with a question.
    assert model.requests[0]["input"] == [
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "q3"},
    ]


def test_conversation_is_per_doctor(client, db, model, doctor, other_doctor):
    _saved(db, doctor, "user", "mine", minutes_ago=1)
    assert client.get("/api/assistant/messages", headers=auth(other_doctor)).json() == []


def test_failed_question_is_not_saved(client, db, model, doctor):
    async def fail(**kwargs):
        raise assistant.openai.APIConnectionError(request=None)

    model.calls.clear()
    assistant.openai.AsyncOpenAI = lambda **_: NS(responses=NS(create=fail))
    events = _events(client.post("/api/assistant/chat", headers=auth(doctor), json=QUESTION))
    assert events[-1]["type"] == "error"
    assert db.tables.get("assistant_messages", []) == []
