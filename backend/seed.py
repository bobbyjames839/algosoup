"""Seed demo data. Usage: python seed.py  (login: drsmith / password123)"""
import random
from datetime import datetime, timedelta, timezone

from app.db import supabase
from app.security import hash_password

random.seed(42)
now = datetime.now(timezone.utc)

hospitals = {
    h["name"]: h
    for h in supabase.table("hospitals")
    .upsert(
        [
            {"name": "St. Mary's Hospital", "city": "London"},
            {"name": "Royal Infirmary", "city": "Manchester"},
            {"name": "Northgate Children's Hospital", "city": "Leeds"},
        ],
        on_conflict="name",
    )
    .execute()
    .data
}


def ensure_doctor(username: str, full_name: str, specialty: str, hospital: str) -> dict:
    fields = {"full_name": full_name, "specialty": specialty, "hospital_id": hospitals[hospital]["id"]}
    existing = supabase.table("doctors").select("id").eq("username", username).execute().data
    if existing:
        return supabase.table("doctors").update(fields).eq("id", existing[0]["id"]).execute().data[0]
    return supabase.table("doctors").insert(fields | {"username": username, "password_hash": hash_password("password123")}).execute().data[0]


me = ensure_doctor("drsmith", "Dr. Sarah Smith", "Endocrinology", "St. Mary's Hospital")
doctor_id = me["id"]
# Other clinicians patients have seen; their appointments show in patient history but not drsmith's calendar.
others = [
    ensure_doctor("drpatel", "Dr. Arjun Patel", "Endocrinology", "Royal Infirmary"),
    ensure_doctor("drlee", "Dr. Hannah Lee", "Paediatric Diabetes", "Northgate Children's Hospital"),
    ensure_doctor("drmorgan", "Dr. Owen Morgan", "Emergency Medicine", "St. Mary's Hospital"),
]

patient_rows = [
    ("James", "Carter", "1988-04-12", "2009-06-01"),
    ("Emily", "Nguyen", "1995-09-23", "2003-02-14"),
    ("Michael", "Okafor", "1972-01-30", "1990-11-05"),
    ("Sophie", "Bennett", "2001-07-08", "2012-08-20"),
    ("Daniel", "Reyes", "1983-12-17", "2015-03-11"),
]
patient_hash = hash_password("password123")
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
                "password_hash": patient_hash,
            }
            for i, (f, l, dob, dx) in enumerate(patient_rows)
        ]
    )
    .execute()
    .data
)

visit_details = {
    "routine": ("Quarterly diabetes review", "Review of glucose logs, HbA1c and insulin dosing. Check injection sites and feet.", 30, "Room 2, Diabetes Clinic"),
    "follow_up": ("Post-meal glucose follow-up", "Follow up on raised post-dinner readings; review carb ratios and bolus timing.", 20, "Room 2, Diabetes Clinic"),
    "telehealth": ("Telehealth check-in", "Video call to review CGM trends and answer questions about dose adjustments.", 15, "Video call"),
}

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

    upcoming_type = random.choice(["follow_up", "telehealth", "routine"])
    appointments += [
        {"patient_id": p["id"], "doctor_id": doctor_id, "hospital_id": me["hospital_id"], "appointment_type": "routine", "status": "completed",
         "scheduled_at": (now - timedelta(days=random.randint(30, 90))).isoformat(), "notes": "Quarterly review",
         **dict(zip(("title", "description", "duration_minutes", "location"), visit_details["routine"]))},
        {"patient_id": p["id"], "doctor_id": doctor_id, "hospital_id": me["hospital_id"], "appointment_type": upcoming_type, "notes": None,
         "status": "scheduled", "scheduled_at": (now + timedelta(days=random.randint(1, 21), hours=random.randint(0, 6))).replace(minute=0, second=0, microsecond=0).isoformat(),
         **dict(zip(("title", "description", "duration_minutes", "location"), visit_details[upcoming_type]))},
    ]
    # Earlier care with other doctors/hospitals.
    for other in random.sample(others, k=random.randint(1, 2)):
        urgent = other["specialty"] == "Emergency Medicine"
        appointments.append(
            {"patient_id": p["id"], "doctor_id": other["id"], "hospital_id": other["hospital_id"],
             "appointment_type": "urgent" if urgent else "routine", "status": "completed",
             "scheduled_at": (now - timedelta(days=random.randint(120, 400))).isoformat(), "notes": None,
             "title": "A&E attendance: hypoglycaemia" if urgent else "Diabetes clinic review",
             "description": "Presented with severe hypoglycaemia; treated and discharged." if urgent else "Routine review with previous care team.",
             "duration_minutes": 60 if urgent else 30,
             "location": "Emergency Department" if urgent else "Diabetes Outpatients"}
        )

    messages += [
        {"patient_id": p["id"], "doctor_id": doctor_id, "sender": "patient", "body": "Hi doctor, my readings have been high after dinner this week. Should I adjust my bolus?", "is_read": False},
        {"patient_id": p["id"], "doctor_id": doctor_id, "sender": "doctor", "body": "Thanks for letting me know. Let's review at your next appointment; keep logging post-meal readings.", "is_read": True},
    ]

supabase.table("glucose_readings").insert(readings).execute()
created = supabase.table("appointments").insert(appointments).execute().data
supabase.table("appointment_data").insert(
    [
        {"appointment_id": a["id"], "height_cm": round(random.uniform(158, 190), 1), "weight_kg": round(random.uniform(55, 95), 1),
         "hba1c_percent": round(random.uniform(6.2, 8.9), 1), "blood_pressure": f"{random.randint(110, 135)}/{random.randint(70, 88)}",
         "overall_score": random.randint(55, 92), "notes": "Stable control. Continue current insulin regimen.",
         "chief_complaint": "Occasional high readings after evening meals.",
         "assessment": "Overall control acceptable; post-prandial spikes after dinner suggest the evening carb ratio is too low.",
         "plan": "Increase evening carb ratio by 1 unit per 10g. Continue logging post-meal readings. Repeat HbA1c in 3 months.",
         "insulin_regimen": f"Basal glargine {random.randint(14, 26)}u nightly; rapid-acting aspart with meals",
         "follow_up_weeks": 12}
        for a in created if a["status"] == "completed"
    ]
).execute()
supabase.table("messages").insert(messages).execute()
print(f"Seeded {len(patients)} patients, {len(readings)} readings, {len(created)} appointments. Login: drsmith / password123; patients: <email> / password123")
