import pytest

from .conftest import auth


@pytest.fixture
def appointment(db, doctor, patient):
    return db.add(
        "appointments",
        patient_id=patient["id"],
        doctor_id=doctor["id"],
        hospital_id=doctor["hospital_id"],
        scheduled_at="2026-11-01T09:00:00+00:00",
        appointment_type="routine",
        status="scheduled",
        cancellation_reason=None,
        patients={"id": patient["id"], "first_name": "Amy", "last_name": "Patel"},
        appointment_data=[],
    )


@pytest.fixture
def others_appointment(db, other_doctor, patient):
    return db.add(
        "appointments",
        patient_id=patient["id"],
        doctor_id=other_doctor["id"],
        hospital_id=other_doctor["hospital_id"],
        scheduled_at="2026-10-01T09:00:00+00:00",
        appointment_type="initial",
        status="completed",
    )


def test_appointments_require_doctor(client, db):
    assert client.get("/api/appointments").status_code == 401


def test_schedule_only_shows_own_appointments(client, doctor, appointment, others_appointment):
    res = client.get("/api/appointments", headers=auth(doctor))
    assert [a["id"] for a in res.json()] == [appointment["id"]]
    # Embeds are normalised: `patients` becomes `patient`, a list of visit records becomes one or null.
    assert res.json()[0]["patient"]["first_name"] == "Amy"
    assert res.json()[0]["appointment_data"] is None


def test_patient_history_includes_other_doctors_newest_first(client, doctor, patient, appointment, others_appointment):
    res = client.get(f"/api/appointments?patient_id={patient['id']}", headers=auth(doctor))
    assert [a["id"] for a in res.json()] == [appointment["id"], others_appointment["id"]]


def test_create_appointment(client, db, doctor, patient):
    res = client.post(
        "/api/appointments",
        headers=auth(doctor),
        json={"patient_id": patient["id"], "scheduled_at": "2026-12-01T10:00:00Z", "appointment_type": "telehealth", "title": "Video review"},
    )
    assert res.status_code == 201
    stored = db.tables["appointments"][0]
    assert stored["doctor_id"] == doctor["id"]
    assert stored["hospital_id"] == doctor["hospital_id"]
    assert stored["duration_minutes"] == 30
    assert res.json()["title"] == "Video review"


@pytest.mark.parametrize(
    "body",
    [
        {"appointment_type": "dentist"},
        {"duration_minutes": 1},
        {"duration_minutes": 1000},
    ],
)
def test_create_appointment_validates_body(client, doctor, patient, body):
    base = {"patient_id": patient["id"], "scheduled_at": "2026-12-01T10:00:00Z", "appointment_type": "routine"}
    assert client.post("/api/appointments", headers=auth(doctor), json=base | body).status_code == 422


def test_get_appointment(client, doctor, appointment):
    assert client.get(f"/api/appointments/{appointment['id']}", headers=auth(doctor)).json()["id"] == appointment["id"]
    assert client.get("/api/appointments/missing", headers=auth(doctor)).status_code == 404


def test_cancel_then_reschedule_clears_reason(client, db, doctor, appointment):
    url = f"/api/appointments/{appointment['id']}"
    res = client.patch(url, headers=auth(doctor), json={"status": "cancelled", "cancellation_reason": "Patient unwell"})
    assert res.status_code == 200
    assert res.json()["cancellation_reason"] == "Patient unwell"

    res = client.patch(url, headers=auth(doctor), json={"status": "scheduled"})
    assert res.json()["status"] == "scheduled"
    assert res.json()["cancellation_reason"] is None
    assert db.tables["appointments"][0]["updated_at"]


def test_patch_rejects_null_required_field(client, doctor, appointment):
    res = client.patch(f"/api/appointments/{appointment['id']}", headers=auth(doctor), json={"status": None})
    assert res.status_code == 422


def test_empty_patch_is_noop(client, db, doctor, appointment):
    res = client.patch(f"/api/appointments/{appointment['id']}", headers=auth(doctor), json={})
    assert res.status_code == 200
    assert "updated_at" not in db.tables["appointments"][0]


def test_cannot_change_other_doctors_appointment(client, doctor, others_appointment):
    url = f"/api/appointments/{others_appointment['id']}"
    assert client.patch(url, headers=auth(doctor), json={"status": "cancelled"}).status_code == 403
    assert client.put(f"{url}/data", headers=auth(doctor), json={"notes": "x"}).status_code == 403


def test_visit_record_only_writes_sent_fields(client, db, doctor, appointment):
    url = f"/api/appointments/{appointment['id']}/data"
    assert client.put(url, headers=auth(doctor), json={"hba1c_percent": 7.2, "plan": "Increase basal"}).status_code == 200
    assert client.put(url, headers=auth(doctor), json={"notes": "Follow up"}).status_code == 200

    [record] = db.tables["appointment_data"]
    assert record["appointment_id"] == appointment["id"]
    assert (record["hba1c_percent"], record["plan"], record["notes"]) == (7.2, "Increase basal", "Follow up")


def test_visit_record_validates_ranges(client, doctor, appointment):
    url = f"/api/appointments/{appointment['id']}/data"
    assert client.put(url, headers=auth(doctor), json={"overall_score": 101}).status_code == 422
