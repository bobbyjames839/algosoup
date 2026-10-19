from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..schemas import AppointmentCreate, AppointmentDataUpsert, AppointmentUpdate
from ..security import get_current_doctor

router = APIRouter(prefix="/api/appointments", tags=["appointments"], dependencies=[Depends(get_current_doctor)])

SELECT = (
    "*, appointment_data(*), patients(id, first_name, last_name), "
    "doctor:doctors!appointments_doctor_id_fkey(id, full_name, specialty), "
    "hospital:hospitals!appointments_hospital_id_fkey(id, name, city)"
)


def _normalize(appt: dict) -> dict:
    # PostgREST returns one-to-one embeds as an object, but be defensive about lists.
    data = appt.get("appointment_data")
    if isinstance(data, list):
        appt["appointment_data"] = data[0] if data else None
    appt["patient"] = appt.pop("patients", None)
    return appt


@router.get("")
def list_appointments(patient_id: str | None = None, doctor: dict = Depends(get_current_doctor)):
    query = supabase.table("appointments").select(SELECT)
    if patient_id:
        # A patient's full care history, including appointments with other doctors/hospitals.
        query = query.eq("patient_id", patient_id).order("scheduled_at", desc=True)
    else:
        # Calendar/schedule: only the logged-in doctor's own appointments.
        query = query.eq("doctor_id", doctor["id"]).order("scheduled_at")
    return [_normalize(a) for a in query.execute().data]


@router.get("/{appointment_id}")
def get_appointment(appointment_id: str):
    return _fetch(appointment_id)


@router.post("", status_code=201)
def create_appointment(payload: AppointmentCreate, doctor: dict = Depends(get_current_doctor)):
    data = payload.model_dump(mode="json") | {"doctor_id": doctor["id"], "hospital_id": doctor["hospital_id"]}
    created = supabase.table("appointments").insert(data).execute().data[0]
    return _fetch(created["id"])


@router.patch("/{appointment_id}")
def update_appointment(appointment_id: str, payload: AppointmentUpdate, doctor: dict = Depends(get_current_doctor)):
    current = _fetch_own(appointment_id, doctor)
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        return current
    for field in ("status", "scheduled_at", "appointment_type", "duration_minutes"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    # A cancellation reason only makes sense on a cancelled appointment.
    if changes.get("status") in ("scheduled", "completed") and "cancellation_reason" not in changes:
        changes["cancellation_reason"] = None
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("appointments").update(changes).eq("id", appointment_id).execute()
    return _fetch(appointment_id)


@router.put("/{appointment_id}/data")
def upsert_appointment_data(appointment_id: str, payload: AppointmentDataUpsert, doctor: dict = Depends(get_current_doctor)):
    _fetch_own(appointment_id, doctor)
    # Only fields sent in the body are written, so older clients don't wipe fields they don't know about.
    data = payload.model_dump(exclude_unset=True) | {"appointment_id": appointment_id, "updated_at": datetime.now(timezone.utc).isoformat()}
    supabase.table("appointment_data").upsert(data, on_conflict="appointment_id").execute()
    return _fetch(appointment_id)


def _fetch(appointment_id: str) -> dict:
    rows = supabase.table("appointments").select(SELECT).eq("id", appointment_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Appointment not found")
    return _normalize(rows[0])


def _fetch_own(appointment_id: str, doctor: dict) -> dict:
    """Other doctors' appointments are visible in a patient's history but read-only."""
    appt = _fetch(appointment_id)
    if appt["doctor_id"] != doctor["id"]:
        raise HTTPException(403, "You can only change your own appointments")
    return appt
