from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..schemas import PatientCreate
from ..security import get_current_doctor

# Never return password_hash (patient portal login).
PATIENT_FIELDS = "id, doctor_id, first_name, last_name, date_of_birth, email, phone, diagnosis_date, created_at"

router = APIRouter(prefix="/api/patients", tags=["patients"], dependencies=[Depends(get_current_doctor)])


def _get_patient(patient_id: str) -> dict:
    rows = supabase.table("patients").select(PATIENT_FIELDS).eq("id", patient_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Patient not found")
    return rows[0]


@router.get("")
def list_patients():
    return supabase.table("patients").select(PATIENT_FIELDS).order("last_name").execute().data


@router.post("", status_code=201)
def create_patient(payload: PatientCreate, doctor: dict = Depends(get_current_doctor)):
    data = payload.model_dump(mode="json") | {"doctor_id": doctor["id"]}
    created = supabase.table("patients").insert(data).execute().data[0]
    created.pop("password_hash", None)
    return created


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    return _get_patient(patient_id)


@router.get("/{patient_id}/glucose")
def list_glucose(patient_id: str, days: int = 7):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return (
        supabase.table("glucose_readings")
        .select("*")
        .eq("patient_id", patient_id)
        .gte("recorded_at", since)
        .order("recorded_at")
        .execute()
        .data
    )
