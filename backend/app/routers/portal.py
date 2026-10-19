"""Patient portal: a signed-in patient can see only their own records and message their doctor."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..realtime import publish
from ..schemas import LoginRequest, MessageCreate
from ..security import create_token, get_current_patient, verify_password
from .appointments import SELECT, _normalize

router = APIRouter(prefix="/api/portal", tags=["portal"])

PUBLIC_FIELDS = ("id", "doctor_id", "first_name", "last_name", "date_of_birth", "email", "phone", "diagnosis_date")


@router.post("/login")
def login(payload: LoginRequest):
    """Patients sign in with their email address as the username."""
    rows = supabase.table("patients").select("*").ilike("email", payload.username.strip()).limit(1).execute().data
    if not rows or not rows[0].get("password_hash") or not verify_password(payload.password, rows[0]["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    patient = {k: rows[0][k] for k in PUBLIC_FIELDS}
    return {"access_token": create_token(patient["id"], role="patient"), "patient": patient}


@router.get("/me")
def me(patient: dict = Depends(get_current_patient)):
    return patient


@router.get("/glucose")
def glucose(days: int = 14, patient: dict = Depends(get_current_patient)):
    since = (datetime.now(timezone.utc) - timedelta(days=min(days, 90))).isoformat()
    return (
        supabase.table("glucose_readings")
        .select("*")
        .eq("patient_id", patient["id"])
        .gte("recorded_at", since)
        .order("recorded_at")
        .execute()
        .data
    )


@router.get("/appointments")
def appointments(patient: dict = Depends(get_current_patient)):
    rows = (
        supabase.table("appointments")
        .select(SELECT)
        .eq("patient_id", patient["id"])
        .order("scheduled_at", desc=True)
        .execute()
        .data
    )
    return [_normalize(a) for a in rows]


@router.get("/messages")
def messages(patient: dict = Depends(get_current_patient)):
    rows = (
        supabase.table("messages").select("*").eq("patient_id", patient["id"]).order("created_at").execute().data
    )
    supabase.table("messages").update({"is_read": True}).eq("patient_id", patient["id"]).eq(
        "sender", "doctor"
    ).execute()
    return rows


@router.post("/messages", status_code=201)
def send_message(payload: MessageCreate, patient: dict = Depends(get_current_patient)):
    data = {"patient_id": patient["id"], "doctor_id": patient["doctor_id"], "sender": "patient", "body": payload.body}
    message = supabase.table("messages").insert(data).execute().data[0]
    publish(message)
    return message
