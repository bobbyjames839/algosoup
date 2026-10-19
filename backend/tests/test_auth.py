from datetime import datetime, timedelta, timezone

import jwt

from app.config import JWT_SECRET

from .conftest import auth


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_returns_working_token(client, db):
    res = client.post("/api/auth/register", json={"username": "newdoc", "password": "longenough", "full_name": "Dr New"})
    assert res.status_code == 200
    body = res.json()
    assert body["doctor"]["username"] == "newdoc"
    assert "password_hash" not in body["doctor"]
    # Password is stored hashed, never in plain text.
    assert db.tables["doctors"][0]["password_hash"] != "longenough"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Dr New"


def test_register_rejects_taken_username(client, doctor):
    res = client.post("/api/auth/register", json={"username": "drsmith", "password": "longenough", "full_name": "Dup"})
    assert res.status_code == 409


def test_register_rejects_short_password(client, db):
    res = client.post("/api/auth/register", json={"username": "x", "password": "short", "full_name": "X"})
    assert res.status_code == 422


def test_login(client, doctor):
    res = client.post("/api/auth/login", json={"username": "drsmith", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["doctor"] == {"id": doctor["id"], "username": "drsmith", "full_name": "Dr Jane Smith"}


def test_login_wrong_password(client, doctor):
    res = client.post("/api/auth/login", json={"username": "drsmith", "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_user(client, db):
    res = client.post("/api/auth/login", json={"username": "nobody", "password": "password123"})
    assert res.status_code == 401


def test_me_requires_token(client, db):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_bad_tokens(client, doctor):
    expired = jwt.encode({"sub": doctor["id"], "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, JWT_SECRET, algorithm="HS256")
    forged = jwt.encode({"sub": doctor["id"], "role": "doctor"}, "wrong-secret-that-is-long-enough-for-hs256", algorithm="HS256")
    for token in ("garbage", expired, forged):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_me_rejects_patient_token(client, patient):
    assert client.get("/api/auth/me", headers=auth(patient, role="patient")).status_code == 401


def test_me_rejects_deleted_doctor(client, db, doctor):
    headers = auth(doctor)
    db.tables["doctors"].clear()
    assert client.get("/api/auth/me", headers=headers).status_code == 401
