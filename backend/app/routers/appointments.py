from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..schemas import AppointmentCreate, AppointmentDataUpsert, AppointmentUpdate
from ..security import get_current_doctor

router = APIRouter(prefix="/api/appointments", tags=["appointments"], dependencies=[Depends(get_current_doctor)])

SELECT = "*, appointment_data(*), patients(id, first_name, last_name)"


def _normalize(appt: dict) -> dict:
    # PostgREST returns one-to-one embeds as an object, but be defensive about lists.
    data = appt.get("appointment_data")
    if isinstance(data, list):
        appt["appointment_data"] = data[0] if data else None
    appt["patient"] = appt.pop("patients", None)
    return appt


@router.get("")
def list_appointments(patient_id: str | None = None):
    query = supabase.table("appointments").select(SELECT)
    if patient_id:
        query = query.eq("patient_id", patient_id).order("scheduled_at", desc=True)
    else:
        query = query.order("scheduled_at")
    return [_normalize(a) for a in query.execute().data]


@router.post("", status_code=201)
def create_appointment(payload: AppointmentCreate, doctor: dict = Depends(get_current_doctor)):
    data = payload.model_dump(mode="json") | {"doctor_id": doctor["id"]}
    created = supabase.table("appointments").insert(data).execute().data[0]
    return _fetch(created["id"])


@router.patch("/{appointment_id}")
def update_appointment(appointment_id: str, payload: AppointmentUpdate):
    _fetch(appointment_id)
    supabase.table("appointments").update(payload.model_dump()).eq("id", appointment_id).execute()
    return _fetch(appointment_id)


@router.put("/{appointment_id}/data")
def upsert_appointment_data(appointment_id: str, payload: AppointmentDataUpsert):
    _fetch(appointment_id)
    data = payload.model_dump() | {"appointment_id": appointment_id}
    supabase.table("appointment_data").upsert(data, on_conflict="appointment_id").execute()
    return _fetch(appointment_id)


def _fetch(appointment_id: str) -> dict:
    rows = supabase.table("appointments").select(SELECT).eq("id", appointment_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Appointment not found")
    return _normalize(rows[0])
