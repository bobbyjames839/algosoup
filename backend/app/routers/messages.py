from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..realtime import publish
from ..schemas import MessageCreate, PatientMessageCreate
from ..security import get_current_doctor

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", dependencies=[Depends(get_current_doctor)])
def inbox():
    """One row per patient conversation, newest first, with unread counts."""
    rows = (
        supabase.table("messages")
        .select("*, patients(id, first_name, last_name)")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    threads: dict[str, dict] = {}
    for m in rows:
        thread = threads.setdefault(
            m["patient_id"],
            {"patient": m["patients"], "last_message": m, "unread": 0},
        )
        if m["sender"] == "patient" and not m["is_read"]:
            thread["unread"] += 1
    return list(threads.values())


@router.get("/patient/{patient_id}", dependencies=[Depends(get_current_doctor)])
def thread(patient_id: str):
    messages = (
        supabase.table("messages").select("*").eq("patient_id", patient_id).order("created_at").execute().data
    )
    supabase.table("messages").update({"is_read": True}).eq("patient_id", patient_id).eq(
        "sender", "patient"
    ).execute()
    return messages


@router.post("/patient/{patient_id}", status_code=201)
def reply(patient_id: str, payload: MessageCreate, doctor: dict = Depends(get_current_doctor)):
    data = {"patient_id": patient_id, "doctor_id": doctor["id"], "sender": "doctor", "body": payload.body}
    message = supabase.table("messages").insert(data).execute().data[0]
    publish(message)
    return message


@router.post("/inbound", status_code=201)
def patient_message(payload: PatientMessageCreate):
    """Unauthenticated endpoint for patients to message their doctor (no patient accounts yet)."""
    patients = supabase.table("patients").select("id, doctor_id").eq("id", payload.patient_id).limit(1).execute().data
    if not patients:
        raise HTTPException(404, "Patient not found")
    data = {
        "patient_id": payload.patient_id,
        "doctor_id": patients[0]["doctor_id"],
        "sender": "patient",
        "body": payload.body,
    }
    message = supabase.table("messages").insert(data).execute().data[0]
    publish(message)
    return message
