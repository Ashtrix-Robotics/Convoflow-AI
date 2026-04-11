#!/usr/bin/env python
"""
Create or invite a user in Supabase Auth so they can log in to the web dashboard.

Usage:
  python scripts/create_supabase_auth_user.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY to be set in backend/.env
(backend is not required to be running — uses the admin REST API directly).

Run this once per user that needs web dashboard access.
The user must already have an agent account in the platform database.
"""
import os
import sys
import json
import httpx
from pathlib import Path

# Allow running from project root or backend folder
env_file = Path(__file__).parent.parent / "backend" / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env")
    sys.exit(1)

# ----- Users to create in Supabase Auth -----
USERS = [
    {"email": "admin@convoflow.ai", "password": "ConvoFlow@123"},
    {"email": "manual_124917@test.com", "password": "ManualTest123!"},
]

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

for user in USERS:
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    payload = {
        "email": user["email"],
        "password": user["password"],
        "email_confirm": True,  # skip email confirmation for admin-created users
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=15)
    if resp.status_code == 200:
        uid = resp.json().get("id")
        print(f"[CREATED] {user['email']} (id={uid})")
    elif resp.status_code == 422:
        data = resp.json()
        if "already exists" in str(data).lower() or "email" in str(data).lower():
            print(f"[EXISTS]  {user['email']} — already in Supabase Auth")
        else:
            print(f"[ERROR]   {user['email']} — {data}")
    else:
        print(f"[ERROR]   {user['email']} — {resp.status_code}: {resp.text[:200]}")

print("\nDone. Users can now sign in via the web dashboard.")
