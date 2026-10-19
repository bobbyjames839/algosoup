from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import JWT_EXPIRE_HOURS, JWT_SECRET
from .db import supabase

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(subject_id: str, role: str = "doctor") -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": subject_id, "role": role, "exp": expires}, JWT_SECRET, algorithm="HS256")


def _decode(creds: HTTPAuthorizationCredentials | None, role: str) -> dict:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise unauthorized
    # Tokens issued before roles existed are doctor tokens.
    if payload.get("role", "doctor") != role:
        raise unauthorized
    return payload


def get_current_doctor(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = _decode(creds, "doctor")
    rows = (
        supabase.table("doctors")
        .select("id, username, full_name, hospital_id")
        .eq("id", payload["sub"])
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise unauthorized
    return rows[0]


def get_current_patient(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    payload = _decode(creds, "patient")
    rows = (
        supabase.table("patients")
        .select("id, doctor_id, first_name, last_name, date_of_birth, email, phone, diagnosis_date")
        .eq("id", payload["sub"])
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return rows[0]
