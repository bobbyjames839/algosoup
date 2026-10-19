# GlucoCare

Clinician portal for managing Type 1 diabetes patients.

- **backend/** — FastAPI, Supabase (Postgres), bcrypt + JWT username/password auth
- **frontend/** — React + TypeScript (Vite), Tailwind CSS v4, Redux Toolkit + RTK Query, Recharts

## 1. Supabase

1. Create a project at supabase.com.
2. Open **SQL Editor** and run `backend/schema.sql`.
3. From **Project Settings → API**, copy the project URL and the `service_role` key.

RLS is enabled with no policies, so only the backend (service role key) can access data.

## 2. Backend (http://localhost:8000, API docs at /docs)

```bash
cd backend
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, OPENAI_API_KEY, OPENAI_MODEL
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py                # demo data; login drsmith / password123
uvicorn app.main:app --reload
```

## 3. Frontend (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to the backend.

## Data model

| Table | Purpose |
| --- | --- |
| `hospitals` | Hospitals; each doctor belongs to one, and each appointment records where it took place |
| `doctors` | Clinician accounts (username + bcrypt hash) |
| `patients` | Patient records (no login yet) |
| `glucose_readings` | mmol/L readings with context (fasting, post-meal, …) |
| `appointments` | Scheduled visits, type and status |
| `appointment_data` | Per-visit vitals: height, weight, HbA1c, BP, overall score, notes |
| `messages` | Patient ↔ doctor messages |

## API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/patients`, `GET /api/patients/{id}`
- `GET /api/patients/{id}/glucose?days=7` (read-only for doctors; readings come from patients/devices)
- `GET|POST /api/appointments`, `PATCH /api/appointments/{id}`, `PUT /api/appointments/{id}/data`
- `GET /api/messages` (inbox), `GET|POST /api/messages/patient/{id}`
- `POST /api/messages/inbound` — **unauthenticated**, for patients to send a message (`{patient_id, body}`) until patient accounts exist
- `POST /api/assistant/chat`: AI assistant (OpenAI, streamed) that answers questions about any patient's records. Needs `OPENAI_API_KEY` and `OPENAI_MODEL`
