from datetime import datetime, timedelta, timezone

from .conftest import auth


def test_patient_login_with_email_case_insensitive(client, patient):
    res = client.post("/api/portal/login", json={"username": "  AMY@example.com ", "password": "patientpass"})
    assert res.status_code == 200
    body = res.json()
    assert body["patient"]["id"] == patient["id"]
    assert "password_hash" not in body["patient"]

    me = client.get("/api/portal/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["first_name"] == "Amy"


def test_patient_login_wrong_password(client, patient):
    assert client.post("/api/portal/login", json={"username": "amy@example.com", "password": "nope"}).status_code == 401


def test_patient_without_password_cannot_log_in(client, db, doctor):
    db.add("patients", doctor_id=doctor["id"], first_name="No", last_name="Pass", email="nopass@example.com", password_hash=None)
    assert client.post("/api/portal/login", json={"username": "nopass@example.com", "password": "anything"}).status_code == 401


def test_portal_rejects_doctor_token(client, doctor):
    assert client.get("/api/portal/me", headers=auth(doctor)).status_code == 401


def test_patient_only_sees_own_data(client, db, doctor, patient):
    other = db.add("patients", doctor_id=doctor["id"], first_name="Ben", last_name="Cole", email="ben@example.com")
    now = datetime.now(timezone.utc).isoformat()
    db.add("glucose_readings", patient_id=patient["id"], value_mmol=5.5, recorded_at=now)
    db.add("glucose_readings", patient_id=other["id"], value_mmol=12.0, recorded_at=now)
    db.add("messages", patient_id=other["id"], doctor_id=doctor["id"], sender="doctor", body="For Ben", is_read=False)
    db.add("appointments", patient_id=other["id"], doctor_id=doctor["id"], scheduled_at=now, appointment_type="routine")

    headers = auth(patient, role="patient")
    assert [r["value_mmol"] for r in client.get("/api/portal/glucose", headers=headers).json()] == [5.5]
    assert client.get("/api/portal/messages", headers=headers).json() == []
    assert client.get("/api/portal/appointments", headers=headers).json() == []


def test_glucose_window_is_capped(client, db, patient):
    old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
    db.add("glucose_readings", patient_id=patient["id"], value_mmol=7.0, recorded_at=old)
    res = client.get("/api/portal/glucose?days=365", headers=auth(patient, role="patient"))
    assert res.json() == []


def test_reading_messages_marks_doctor_messages_read(client, db, doctor, patient):
    db.add("messages", patient_id=patient["id"], doctor_id=doctor["id"], sender="doctor", body="Hi Amy", is_read=False, created_at="2026-10-01T09:00:00+00:00")
    res = client.get("/api/portal/messages", headers=auth(patient, role="patient"))
    assert [m["body"] for m in res.json()] == ["Hi Amy"]
    assert db.tables["messages"][0]["is_read"] is True


def test_patient_sends_message_to_their_doctor(client, doctor, patient):
    res = client.post("/api/portal/messages", headers=auth(patient, role="patient"), json={"body": "Question about insulin"})
    assert res.status_code == 201
    assert (res.json()["sender"], res.json()["doctor_id"]) == ("patient", doctor["id"])
