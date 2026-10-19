from datetime import datetime, timedelta, timezone

from .conftest import auth


def test_patient_routes_require_doctor(client, patient):
    assert client.get("/api/patients").status_code == 401
    assert client.get("/api/patients", headers=auth(patient, role="patient")).status_code == 401


def test_list_patients_hides_password_hash(client, doctor, patient):
    res = client.get("/api/patients", headers=auth(doctor))
    assert res.status_code == 200
    assert [p["id"] for p in res.json()] == [patient["id"]]
    assert "password_hash" not in res.json()[0]


def test_create_patient_assigns_current_doctor(client, db, doctor):
    res = client.post("/api/patients", headers=auth(doctor), json={"first_name": "Ben", "last_name": "Cole", "date_of_birth": "2001-02-03"})
    assert res.status_code == 201
    assert res.json()["doctor_id"] == doctor["id"]
    assert db.tables["patients"][0]["date_of_birth"] == "2001-02-03"


def test_create_patient_validates_body(client, doctor):
    res = client.post("/api/patients", headers=auth(doctor), json={"first_name": "Ben"})
    assert res.status_code == 422


def test_get_patient(client, doctor, patient):
    res = client.get(f"/api/patients/{patient['id']}", headers=auth(doctor))
    assert res.status_code == 200
    assert res.json()["email"] == "amy@example.com"
    assert "password_hash" not in res.json()


def test_get_missing_patient(client, doctor):
    assert client.get("/api/patients/nope", headers=auth(doctor)).status_code == 404


def test_glucose_only_returns_recent_readings_for_that_patient(client, db, doctor, patient):
    now = datetime.now(timezone.utc)
    db.add("glucose_readings", patient_id=patient["id"], value_mmol=6.1, recorded_at=(now - timedelta(days=1)).isoformat())
    db.add("glucose_readings", patient_id=patient["id"], value_mmol=9.9, recorded_at=(now - timedelta(days=20)).isoformat())
    db.add("glucose_readings", patient_id="someone-else", value_mmol=4.0, recorded_at=now.isoformat())

    res = client.get(f"/api/patients/{patient['id']}/glucose?days=7", headers=auth(doctor))
    assert [r["value_mmol"] for r in res.json()] == [6.1]
