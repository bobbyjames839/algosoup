# GlucoCare backend

FastAPI + Supabase (Postgres via `supabase-py`/PostgREST). The entry point is `app/main.py`, routers are in `app/routers/`, request models are in `app/schemas.py`, and the full DB schema is in `schema.sql`.

- Run: `source .venv/bin/activate && uvicorn app.main:app --reload` (API docs at http://127.0.0.1:8000/docs)
- Seed: `python seed.py` (login `drsmith` / `password123`). It is not idempotent: re-running duplicates patients.
- Schema changes: add a file to `migrations/` (idempotent `add column if not exists`) **and** update `schema.sql` so fresh installs match. There is no DB URL in `.env`, so migrations are run by hand in the Supabase SQL editor.
- Bulk inserts via PostgREST set columns missing from a row to `null`, not the column default. Give every row in a bulk insert the same keys.

## Appointment details (migration `001_appointment_details.sql`)

Appointments were expanded so the frontend can show richer detail.

### `appointments`: new columns
| Column | Type | Notes |
| --- | --- | --- |
| `title` | text, nullable | Short label, e.g. "Quarterly diabetes review". The frontend should fall back to `appointment_type` when this is null. |
| `description` | text, nullable | Reason for visit / what will be covered (max 5000 chars). |
| `duration_minutes` | int, default 30 | Must be between 5 and 480. |
| `location` | text, nullable | Room, clinic, or "Video call". |
| `cancellation_reason` | text, nullable | Cleared automatically when status is changed back to `scheduled`/`completed`. |
| `updated_at` | timestamptz | Set by the API on every PATCH. |

### `appointment_data` (visit record): new columns
| Column | Type | Notes |
| --- | --- | --- |
| `chief_complaint` | text | What the patient came in with. |
| `assessment` | text | Clinician's assessment. |
| `plan` | text | Treatment plan / next steps. |
| `insulin_regimen` | text | Free text, e.g. "Glargine 20u nightly; aspart with meals". |
| `follow_up_weeks` | int | Must be between 0 and 104. |
| `updated_at` | timestamptz | Set by the API on every PUT. |

### API changes (`app/routers/appointments.py`)
- **New** `GET /api/appointments/{id}` returns one appointment (same shape as list items, with `appointment_data` and `patient` embedded). Returns 404 if not found.
- `POST /api/appointments` also accepts `title`, `description`, `duration_minutes`, `location`.
- `PATCH /api/appointments/{id}` is now a **partial update** of any of `status`, `scheduled_at`, `appointment_type`, `title`, `description`, `duration_minutes`, `location`, `notes`, `cancellation_reason`. Only the fields sent are changed, so the existing `{status}` call still works. Sending `null` for `status`/`scheduled_at`/`appointment_type`/`duration_minutes` returns 422. An empty body is a no-op.
- `PUT /api/appointments/{id}/data` accepts the new visit-record fields and now writes **only the fields sent** (it used to overwrite every field), so a client that doesn't know about the new fields won't erase them.

The frontend types in `frontend/src/types.ts` (`Appointment`, `AppointmentData`) and `NewAppointment` in `frontend/src/store/api.ts` need the new fields added to use them.

## AI assistant (`app/routers/assistant.py`)

An AI assistant (OpenAI) the doctor can ask about any patient. It appears in the frontend as a pinned **AI Assistant** conversation at the top of the Messages inbox (`frontend/src/components/AssistantChat.tsx`, wired up in `frontend/src/pages/MessagesPage.tsx`).

- **One continuous conversation per doctor** (no "new chat"), stored in `assistant_messages` (migration `004_assistant_messages.sql`). `GET /api/assistant/messages` returns the latest 200 messages, oldest first, with saved reasoning and lookup steps.
- **Endpoint:** `POST /api/assistant/chat` (doctor auth required). Body: `{"message": "..."}`, just the new question. The backend loads the last `ASSISTANT_HISTORY_MESSAGES` (default 20) saved messages, drops a leading reply so the context starts with a question, and sends those plus the new question to the model. The question and reply are saved once the answer finishes. If the doctor stops it partway, the partial reply is saved. If no answer text was produced (e.g. an error), nothing is saved.
- **Streaming:** the response is server-sent events (`text/event-stream`). Each `data:` line is JSON:
  - `{"type": "thinking", "text"}` and `{"type": "text", "text"}` are deltas to append (reasoning summary / answer).
  - `{"type": "tool", "name", "label"}` means a lookup started (the label is for display).
  - `{"type": "error", "message"}` is an error after streaming began.
  - `{"type": "done"}` ends a successful answer.
  - Auth, validation and rate-limit failures happen before the stream starts and come back as normal JSON HTTP errors.
- **Frontend:** `frontend/src/lib/assistantStream.ts` reads the stream with `fetch` (EventSource can't POST), and `AssistantChat.tsx` renders it: the lookup steps, live reasoning that collapses into a "Show reasoning" toggle once the answer starts, and the answer typing in. The conversation is fetched once into `store/assistantSlice.ts` (input is disabled until then) and updated locally after that. **Stop** and leaving the chat abort the request, and the backend then stops the model call so no more tokens are spent.
- **Config:** `OPENAI_API_KEY` and `OPENAI_MODEL` (currently `gpt-6-luna`) in `backend/.env`, plus optional `OPENAI_REASONING_EFFORT` (default `low`). Without the key or model the endpoint returns 503 and the rest of the app works normally.
- **How it works:** a streaming tool loop (`_stream_answer`) over the OpenAI Responses API (`AsyncOpenAI().responses.create(stream=True)`), with reasoning summaries on (`reasoning.summary: "auto"`). The model only produces a summary when it actually reasons, so simple lookups often show none. It runs up to 8 tool rounds and 8,192 output tokens (including reasoning) per model call. Tool calls and their results from earlier questions aren't kept, only the question and answer text, so the model looks data up again when it needs it.
- `store=False`, so OpenAI doesn't keep the conversation. Reasoning is carried between tool calls through `include=["reasoning.encrypted_content"]`. Tools are strict function schemas, and the Python functions are wrapped in pydantic `validate_call`, so bad arguments come back to the model as an error instead of running.
- **Tools** (read-only plain functions in `assistant.py`, querying Supabase directly):
  - `search_patients`: name/email match
  - `get_glucose_readings`: readings plus overall and per-context stats (average, min/max, % in 3.9-10.0, hypo/high counts)
  - `get_appointments`: a patient's appointments with visit records
  - `get_messages`: a patient's message thread. Doesn't mark messages read.
  - `list_appointments_between`: all patients' appointments in a date range
  - `get_unread_messages`: unread patient messages across all patients
- To let the assistant see more data, write a `@validate_call` function and add it to the `TOOLS` dict with its JSON-schema properties. Every property must be listed, because strict mode makes them all required. The first paragraph of the docstring becomes the tool description.
- The assistant has no write tools, so it can't change records or send messages.
- Like the rest of the API, it can see **every** patient, not just the logged-in doctor's.
- Patient data is sent to the OpenAI API. Real patient data needs the appropriate agreements in place (e.g. a BAA for HIPAA).

## Hospitals and care team (migration `002_hospitals_and_care_team.sql`)

- **New** `hospitals` table (`name` unique, `city`). `doctors` gains `hospital_id` and `specialty`.
- `appointments.hospital_id` records where the visit happened. It is set from the doctor's hospital when the appointment is created, so history stays correct if a doctor moves.
- `GET /api/appointments` **with no `patient_id`** returns only the logged-in doctor's appointments (the calendar and schedule). **With `patient_id`** it returns the patient's full history across all doctors and hospitals.
- Each appointment embeds `doctor` (`id, full_name, specialty`) and `hospital` (`id, name, city`).
- `PATCH /api/appointments/{id}` and `PUT /api/appointments/{id}/data` return **403** for another doctor's appointment. Those appointments are read-only.
- Seed adds `drpatel`, `drlee` and `drmorgan` (password `password123`) at other hospitals, with prior appointments for each patient.

### Cost and abuse limits
Every question is logged in the `assistant_usage` table (migration `002_assistant_usage.sql`) with its token count. Limits are checked against it before calling the model. All limits are env vars in `app/config.py`:

| Limit | Default | Env var |
| --- | --- | --- |
| Questions per doctor per minute | 5 | `ASSISTANT_REQUESTS_PER_MINUTE` |
| Questions per doctor per day | 100 | `ASSISTANT_REQUESTS_PER_DAY` |
| Tokens per question (tool loop stops here) | 150k | `ASSISTANT_MAX_TOKENS_PER_QUESTION` |
| Tokens per doctor per day | 1M | `ASSISTANT_DAILY_TOKENS_PER_DOCTOR` |
| Tokens across all doctors per day | 5M | `ASSISTANT_DAILY_TOKENS_TOTAL` |

- A doctor can only have one question running at a time. This is enforced in-process, so it only holds within a single server process.
- Days are UTC. Tokens are OpenAI's reported `input_tokens + output_tokens` (output includes reasoning). For a call interrupted before OpenAI reports usage, the count is estimated at about 4 characters per token.
- Questions that fail, get cut off or get stopped are still counted, because they were still billed. A call interrupted halfway is counted using that estimate.
- If the usage table can't be read, the endpoint returns 503 instead of skipping the limits.
- Input is capped at 4,000 characters per message. Tool results are capped too: glucose readings at 90 days, messages at 100, search results at 25, appointments at 200.
- `POST /api/auth/register` is open, so anyone can create more doctor accounts. The global daily cap is what bounds total spend.
- Also set a monthly budget and usage limit in the OpenAI dashboard as a hard backstop.

## Live messages (`app/realtime.py`)

Patient–doctor messages are pushed to browsers over a WebSocket at `/api/ws`, so they appear instantly. Nothing polls any more.

- **Protocol:** the client's first frame is `{"token": "<JWT>"}`. Browsers can't set headers on a WebSocket, and a token in the URL would end up in logs. The server replies `{"type": "ready"}`, then sends `{"type": "message", "message": {...message row}}` for every new message. It closes with code `4401` for a bad, expired or unknown token (the frontend doesn't retry that code) and when the token expires.
- **Who gets what:** doctors get every message, matching the inbox, which shows every conversation. A patient only gets their own.
- **Publishing:** every route that inserts a message calls `realtime.publish(row)`: doctor reply, patient portal send and `/inbound`. A new route that inserts messages must do the same. Messages written straight to the database bypass this.
- **Single process only:** connections are held in this process's memory, which works with the Dockerfile's single uvicorn process. With several workers or instances, publish through a shared broker such as Redis pub/sub.
- **Slow clients:** each connection buffers 100 events. A client that stops reading is disconnected and catches up when it reconnects.
- **Frontend:** `frontend/src/store/realtime.ts` (`useRealtimeMessages`, used in `Layout` and `PatientPortalPage`) reconnects with backoff up to 30s, and refetches messages after a reconnect to catch anything missed. New messages are added straight into the RTK Query cache. A patient message refetches the thread if the doctor has it open, which also marks it read. The Vite dev proxy has `ws: true` for this.
- Requires the `websockets` package (pinned in `requirements.txt`); without it uvicorn can't accept WebSocket connections.
