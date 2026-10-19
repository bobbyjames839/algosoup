from fastapi import APIRouter, Depends, HTTPException

from ..db import supabase
from ..schemas import LoginRequest, RegisterRequest
from ..security import create_token, get_current_doctor, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(doctor: dict) -> dict:
    public = {k: doctor[k] for k in ("id", "username", "full_name")}
    return {"access_token": create_token(doctor["id"]), "doctor": public}


@router.post("/register")
def register(payload: RegisterRequest):
    existing = supabase.table("doctors").select("id").eq("username", payload.username).execute().data
    if existing:
        raise HTTPException(409, "Username already taken")
    doctor = (
        supabase.table("doctors")
        .insert(
            {
                "username": payload.username,
                "password_hash": hash_password(payload.password),
                "full_name": payload.full_name,
            }
        )
        .execute()
        .data[0]
    )
    return _auth_response(doctor)


@router.post("/login")
def login(payload: LoginRequest):
    rows = supabase.table("doctors").select("*").eq("username", payload.username).limit(1).execute().data
    if not rows or not verify_password(payload.password, rows[0]["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    return _auth_response(rows[0])


@router.get("/me")
def me(doctor: dict = Depends(get_current_doctor)):
    return doctor
