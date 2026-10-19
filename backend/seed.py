"""Seed demo data. Usage: python seed.py  (login: drsmith / password123)"""
import random
from datetime import datetime, timedelta, timezone

from app.db import supabase
from app.security import hash_password

random.seed(42)
now = datetime.now(timezone.utc)

existing = supabase.table("doctors").select("id").eq("username", "drsmith").execute().data
if existing:
    doctor_id = existing[0]["id"]
else:
    doctor_id = (
        supabase.table("doctors")
        .insert({"username": "drsmith", "password_hash": hash_password("password123"), "full_name": "Dr. Sarah Smith"})
        .execute()
        .data[0]["id"]
    )

patient_rows = [
    ("James", "Carter", "1988-04-12", "2009-06-01"),
    ("Emily", "Nguyen", "1995-09-23", "2003-02-14"),
    ("Michael", "Okafor", "1972-01-30", "1990-11-05"),
    ("Sophie", "Bennett", "2001-07-08", "2012-08-20"),
    ("Daniel", "Reyes", "1983-12-17", "2015-03-11"),
]
patients = (
    supabase.table("patients")
    .insert(
        [
            {
                "doctor_id": doctor_id,
                "first_name": f,
                "last_name": l,
                "date_of_birth": dob,
                "diagnosis_date": dx,
                "email": f"{f.lower()}.{l.lower()}@example.com",
                "phone": f"555-01{i:02d}",
            }
            for i, (f, l, dob, dx) in enumerate(patient_rows)
        ]
    )
    .execute()
    .data
)

contexts = [("fasting", 7), ("post_meal", 13), ("pre_meal", 18), ("bedtime", 22)]
readings, appointments, messages = [], [], []
for p in patients:
    baseline = random.uniform(6.0, 9.5)
    for day in range(7, -1, -1):
        for context, hour in contexts:
            ts = (now - timedelta(days=day)).replace(hour=hour, minute=random.randint(0, 59))
            if ts > now:
                continue
            spike = 3 if context == "post_meal" else 0
            value = max(2.5, round(random.gauss(baseline + spike, 1.8), 1))
            readings.append({"patient_id": p["id"], "value_mmol": value, "context": context, "recorded_at": ts.isoformat()})

    appointments += [
        {"patient_id": p["id"], "doctor_id": doctor_id, "appointment_type": "routine", "status": "completed",
         "scheduled_at": (now - timedelta(days=random.randint(30, 90))).isoformat(), "notes": "Quarterly review"},
        {"patient_id": p["id"], "doctor_id": doctor_id, "appointment_type": random.choice(["follow_up", "telehealth", "routine"]),
         "status": "scheduled", "scheduled_at": (now + timedelta(days=random.randint(1, 21), hours=random.randint(0, 6))).replace(minute=0, second=0, microsecond=0).isoformat()},
    ]
    messages += [
        {"patient_id": p["id"], "doctor_id": doctor_id, "sender": "patient", "body": "Hi doctor, my readings have been high after dinner this week. Should I adjust my bolus?"},
        {"patient_id": p["id"], "doctor_id": doctor_id, "sender": "doctor", "body": "Thanks for letting me know. Let's review at your next appointment; keep logging post-meal readings.", "is_read": True},
    ]

supabase.table("glucose_readings").insert(readings).execute()
created = supabase.table("appointments").insert(appointments).execute().data
supabase.table("appointment_data").insert(
    [
        {"appointment_id": a["id"], "height_cm": round(random.uniform(158, 190), 1), "weight_kg": round(random.uniform(55, 95), 1),
         "hba1c_percent": round(random.uniform(6.2, 8.9), 1), "blood_pressure": f"{random.randint(110, 135)}/{random.randint(70, 88)}",
         "overall_score": random.randint(55, 92), "notes": "Stable control. Continue current insulin regimen."}
        for a in created if a["status"] == "completed"
    ]
).execute()
supabase.table("messages").insert(messages).execute()
print(f"Seeded {len(patients)} patients, {len(readings)} readings, {len(created)} appointments. Login: drsmith / password123")
