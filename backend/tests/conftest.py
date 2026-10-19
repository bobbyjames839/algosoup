import os
import sys

# Set before the app is imported: config.py reads these at import time, and load_dotenv won't
# override them, so a local backend/.env can't point the tests at a real database or the real OpenAI API.
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
os.environ["JWT_SECRET"] = "test-jwt-secret-that-is-long-enough-for-hs256"
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["OPENAI_MODEL"] = "test-model"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security import create_token, hash_password

from .fake_supabase import FakeSupabase

# bcrypt is deliberately slow, so hash the fixture passwords once rather than per test.
DOCTOR_PASSWORD_HASH = hash_password("password123")
PATIENT_PASSWORD_HASH = hash_password("patientpass")


@pytest.fixture
def db(monkeypatch) -> FakeSupabase:
    fake = FakeSupabase()
    # Every module does `from ..db import supabase`, so patch each module's reference.
    for name, module in list(sys.modules.items()):
        if name.startswith("app.") and hasattr(module, "supabase"):
            monkeypatch.setattr(module, "supabase", fake)
    return fake


@pytest.fixture
def client(db) -> TestClient:
    return TestClient(app)


@pytest.fixture
def hospital(db) -> dict:
    return db.add("hospitals", name="City General", city="Leeds")


@pytest.fixture
def doctor(db, hospital) -> dict:
    return db.add(
        "doctors",
        username="drsmith",
        password_hash=DOCTOR_PASSWORD_HASH,
        full_name="Dr Jane Smith",
        hospital_id=hospital["id"],
    )


@pytest.fixture
def other_doctor(db, hospital) -> dict:
    return db.add("doctors", username="drjones", password_hash=DOCTOR_PASSWORD_HASH, full_name="Dr Tom Jones", hospital_id=hospital["id"])


@pytest.fixture
def patient(db, doctor) -> dict:
    return db.add(
        "patients",
        doctor_id=doctor["id"],
        first_name="Amy",
        last_name="Patel",
        email="amy@example.com",
        password_hash=PATIENT_PASSWORD_HASH,
        date_of_birth="1990-05-01",
        phone=None,
        diagnosis_date=None,
    )


def auth(subject: dict, role: str = "doctor") -> dict:
    return {"Authorization": f"Bearer {create_token(subject['id'], role=role)}"}
