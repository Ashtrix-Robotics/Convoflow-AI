"""Comprehensive API test script — run against local backend at :8000"""
import urllib.request, json, sys

BASE = "http://127.0.0.1:8000"


def req(method, path, data=None, token=None, ct=None):
    r = urllib.request.Request(BASE + path, data=data, method=method)
    if token:
        r.add_header("Authorization", "Bearer " + token)
    if ct:
        r.add_header("Content-Type", ct)
    return r


# Login
form = b"username=admin@convoflow.ai&password=Admin@123"
r = urllib.request.urlopen(
    req("POST", "/auth/login", form, ct="application/x-www-form-urlencoded"), timeout=5
)
token = json.loads(r.read())["access_token"]
print(f"Login OK")

# Worksheets
print("\n=== Worksheets ===")
try:
    r = urllib.request.urlopen(
        req("GET", "/admin/sheets/worksheets", token=token), timeout=15
    )
    ws = json.loads(r.read())
    print(f"  Tabs: {ws.get('worksheets', [])}")
except urllib.error.HTTPError as e:
    print(f"  Error {e.code}: {e.read().decode()[:100]}")

# Pull
print("\n=== Pull from Sheet ===")
try:
    r = urllib.request.urlopen(
        req("POST", "/admin/sheets/pull", token=token), timeout=30
    )
    pull = json.loads(r.read())
    print(f"  Result: created={pull.get('created')}, updated={pull.get('updated')}, skipped={pull.get('skipped')}, total_rows={pull.get('total_rows')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"  Error {e.code}: {body[:200]}")

# Leads after pull
print("\n=== Leads after pull ===")
r = urllib.request.urlopen(req("GET", "/leads", token=token), timeout=5)
leads = json.loads(r.read())
print(f"  Total: {len(leads)} leads")
for lead in leads[:5]:
    name = lead.get("name", "?")
    phone = lead.get("phone", "?")
    status = lead.get("status", "?")
    print(f"    - {name}: {phone} ({status})")

# Purge
print("\n=== Purge ===")
r = urllib.request.urlopen(
    req("DELETE", "/admin/leads/purge", token=token), timeout=15
)
purge = json.loads(r.read())
print(f"  Deleted: {purge.get('deleted')}")

# Verify empty
r = urllib.request.urlopen(req("GET", "/leads", token=token), timeout=5)
leads = json.loads(r.read())
print(f"  Leads after purge: {len(leads)} (should be 0)")
assert len(leads) == 0, "Purge failed!"

# Push (sync to sheet)
print("\n=== Push to Sheet ===")
try:
    r = urllib.request.urlopen(
        req("POST", "/admin/sheets/sync", data=b"{}", token=token, ct="application/json"),
        timeout=30,
    )
    sync = json.loads(r.read())
    print(f"  Result: {sync}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"  Error {e.code}: {body[:200]}")

# Analytics
print("\n=== Analytics ===")
r = urllib.request.urlopen(req("GET", "/analytics/overview", token=token), timeout=30)
analytics = json.loads(r.read())
total = analytics.get("total_leads", "?")
calls_total = analytics.get("total_calls", "?")
print(f"  Total leads: {total}, Total calls: {calls_total}")

# Auth/me
print("\n=== Auth/me ===")
r = urllib.request.urlopen(req("GET", "/auth/me", token=token), timeout=5)
me = json.loads(r.read())
print(f"  Agent: {me.get('name')} ({me.get('email')})")

# Lead CRUD: create via pull, then update, then purge
print("\n=== Re-pull to test CRUD ===")
try:
    r = urllib.request.urlopen(
        req("POST", "/admin/sheets/pull", token=token), timeout=30
    )
    pull = json.loads(r.read())
    print(f"  Re-pulled: created={pull.get('created')}")
except urllib.error.HTTPError as e:
    print(f"  Error: {e.code}")

# Get a lead and try PATCH
r = urllib.request.urlopen(req("GET", "/leads", token=token), timeout=5)
leads = json.loads(r.read())
if leads:
    lead_id = leads[0].get("id")
    # PATCH lead status
    patch_data = json.dumps({"status": "contacted"}).encode()
    try:
        r = urllib.request.urlopen(
            req("PATCH", f"/leads/{lead_id}", data=patch_data, token=token, ct="application/json"),
            timeout=5,
        )
        updated = json.loads(r.read())
        print(f"  PATCH lead {lead_id[:8]}... status -> {updated.get('status')}")
    except urllib.error.HTTPError as e:
        print(f"  PATCH Error {e.code}: {e.read().decode()[:100]}")

# Final purge
r = urllib.request.urlopen(
    req("DELETE", "/admin/leads/purge", token=token), timeout=15
)
purge = json.loads(r.read())
print(f"\n  Final purge: deleted={purge.get('deleted')}")

print("\n=== ALL API TESTS COMPLETE ===")
