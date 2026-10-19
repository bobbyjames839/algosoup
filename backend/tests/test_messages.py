from .conftest import auth


def _message(db, patient, sender, body, created_at, is_read=False):
    return db.add(
        "messages",
        patient_id=patient["id"],
        doctor_id=patient["doctor_id"],
        sender=sender,
        body=body,
        is_read=is_read,
        created_at=created_at,
        patients={"id": patient["id"], "first_name": patient["first_name"], "last_name": patient["last_name"]},
    )


def test_inbox_groups_threads_with_unread_counts(client, db, doctor, patient):
    other = db.add("patients", doctor_id=doctor["id"], first_name="Ben", last_name="Cole", email=None)
    _message(db, patient, "patient", "Hi", "2026-10-01T09:00:00+00:00")
    _message(db, patient, "doctor", "Hello", "2026-10-01T10:00:00+00:00")
    _message(db, patient, "patient", "Thanks", "2026-10-01T11:00:00+00:00")
    _message(db, other, "patient", "Old, read", "2026-09-01T09:00:00+00:00", is_read=True)

    res = client.get("/api/messages", headers=auth(doctor))
    assert res.status_code == 200
    threads = res.json()
    assert [t["patient"]["first_name"] for t in threads] == ["Amy", "Ben"]
    assert threads[0]["last_message"]["body"] == "Thanks"
    assert [t["unread"] for t in threads] == [2, 0]


def test_opening_thread_marks_patient_messages_read(client, db, doctor, patient):
    _message(db, patient, "patient", "Hi", "2026-10-01T09:00:00+00:00")
    _message(db, patient, "doctor", "Hello", "2026-10-01T10:00:00+00:00")

    res = client.get(f"/api/messages/patient/{patient['id']}", headers=auth(doctor))
    assert [m["body"] for m in res.json()] == ["Hi", "Hello"]
    patient_msgs = [m for m in db.tables["messages"] if m["sender"] == "patient"]
    assert all(m["is_read"] for m in patient_msgs)
    # The doctor's own message isn't touched.
    assert not [m for m in db.tables["messages"] if m["sender"] == "doctor"][0]["is_read"]


def test_reply(client, db, doctor, patient):
    res = client.post(f"/api/messages/patient/{patient['id']}", headers=auth(doctor), json={"body": "See you Monday"})
    assert res.status_code == 201
    assert res.json()["sender"] == "doctor"
    assert res.json()["doctor_id"] == doctor["id"]


def test_reply_rejects_empty_body(client, doctor, patient):
    assert client.post(f"/api/messages/patient/{patient['id']}", headers=auth(doctor), json={"body": ""}).status_code == 422


def test_messages_require_doctor(client, patient):
    assert client.get("/api/messages").status_code == 401
    assert client.post(f"/api/messages/patient/{patient['id']}", json={"body": "x"}).status_code == 401


def test_inbound_message_routes_to_patients_doctor(client, db, doctor, patient):
    res = client.post("/api/messages/inbound", json={"patient_id": patient["id"], "body": "Feeling dizzy"})
    assert res.status_code == 201
    assert res.json()["sender"] == "patient"
    assert res.json()["doctor_id"] == doctor["id"]


def test_inbound_message_unknown_patient(client, db):
    assert client.post("/api/messages/inbound", json={"patient_id": "nope", "body": "Hi"}).status_code == 404
