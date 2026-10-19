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


AppointmentType = Literal["initial", "routine", "follow_up", "urgent", "telehealth"]
AppointmentStatus = Literal["scheduled", "completed", "cancelled"]


class AppointmentCreate(BaseModel):
    patient_id: str
    scheduled_at: datetime
    appointment_type: AppointmentType
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    duration_minutes: int = Field(default=30, ge=5, le=480)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    # Partial update: only fields present in the request body are written.
    status: AppointmentStatus | None = None
    scheduled_at: datetime | None = None
    appointment_type: AppointmentType | None = None
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = None
    cancellation_reason: str | None = Field(default=None, max_length=1000)


class AppointmentDataUpsert(BaseModel):
    height_cm: float | None = None
    weight_kg: float | None = None
    hba1c_percent: float | None = None
    blood_pressure: str | None = None
    overall_score: int | None = Field(default=None, ge=0, le=100)
    chief_complaint: str | None = None
    assessment: str | None = None
    plan: str | None = None
    insulin_regimen: str | None = None
    follow_up_weeks: int | None = Field(default=None, ge=0, le=104)
    notes: str | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class PatientMessageCreate(MessageCreate):
    patient_id: str


class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantChatRequest(BaseModel):
    # Full conversation so far, oldest first; must end with the doctor's new question.
    # Only the most recent turns are sent to the model (see assistant.HISTORY_LIMIT).
    messages: list[AssistantMessage] = Field(min_length=1, max_length=100)
