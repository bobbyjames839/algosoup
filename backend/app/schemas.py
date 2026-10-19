from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(LoginRequest):
    full_name: str
    password: str = Field(min_length=8)


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    email: str | None = None
    phone: str | None = None
    diagnosis_date: date | None = None


class GlucoseCreate(BaseModel):
    value_mmol: float = Field(gt=0, lt=40)
    context: Literal["fasting", "pre_meal", "post_meal", "bedtime", "other"] = "other"
    recorded_at: datetime | None = None


class AppointmentCreate(BaseModel):
    patient_id: str
    scheduled_at: datetime
    appointment_type: Literal["initial", "routine", "follow_up", "urgent", "telehealth"]
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    status: Literal["scheduled", "completed", "cancelled"]


class AppointmentDataUpsert(BaseModel):
    height_cm: float | None = None
    weight_kg: float | None = None
    hba1c_percent: float | None = None
    blood_pressure: str | None = None
    overall_score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class PatientMessageCreate(MessageCreate):
    patient_id: str
