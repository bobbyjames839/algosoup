"""Give every patient without a portal password one. Usage: python set_patient_passwords.py [password]  (default password123)"""

import sys

from app.db import supabase
from app.security import hash_password

password_hash = hash_password(sys.argv[1] if len(sys.argv) > 1 else "password123")
patients = supabase.table("patients").select("id, email").is_("password_hash", "null").execute().data
for p in patients:
    supabase.table("patients").update({"password_hash": password_hash}).eq("id", p["id"]).execute()
    print(p["email"])
print(f"Set portal passwords for {len(patients)} patients.")
