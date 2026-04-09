"""
Google Sheets Setup Script for Convoflow AI
==========================================

Run this script ONCE to:
  1. Create a Google Cloud project service account
  2. Enable Google Sheets + Drive APIs
  3. Create the leads tracking spreadsheet
  4. Output the env vars to paste into Render

Requirements:
  pip install google-auth google-auth-oauthlib gspread google-api-python-client

Usage:
  python scripts/setup_google_sheets.py

You will be prompted to sign in with your Google account via browser.
"""

import json
import os
import sys

# ─── Check dependencies ──────────────────────────────────────────────────────
try:
    import google.auth
    import google.oauth2.credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    import gspread
except ImportError:
    print("Missing dependencies. Install them with:")
    print("  pip install google-auth google-auth-oauthlib gspread google-api-python-client")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────
PROJECT_ID      = os.getenv("GCP_PROJECT_ID", "")       # optional: override GCP project
SPREADSHEET_NAME = "Convoflow AI — Leads"
SERVICE_ACCOUNT_NAME = "convoflow-sheets"
SERVICE_ACCOUNT_DISPLAY = "Convoflow AI Sheets Sync"

# OAuth scopes needed for setup (full admin access — only used during setup)
SETUP_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/iam",
]

# Headers for the leads sheet (must match google_sheets.py HEADERS)
HEADERS = [
    "Lead ID", "Name", "Phone", "Email", "Campaign", "Ad Set",
    "Status", "Intent", "Assigned Agent", "Interest Level",
    "Course Interested In", "Notes", "Follow-up Count", "Created At", "Updated At",
]


def enable_apis(service, project_id: str):
    """Enable Google Sheets and Drive APIs."""
    apis = [
        "sheets.googleapis.com",
        "drive.googleapis.com",
        "iam.googleapis.com",
    ]
    for api in apis:
        try:
            service.services().enable(
                name=f"projects/{project_id}/services/{api}"
            ).execute()
            print(f"  ✅ Enabled {api}")
        except Exception as e:
            # May already be enabled
            print(f"  ℹ  {api}: {e}")


def get_or_create_project(crm_service):
    """Return the first available project, or list projects for user to choose."""
    result = crm_service.projects().list().execute()
    projects = result.get("projects", [])
    if not projects:
        print("No GCP projects found. Create a project at https://console.cloud.google.com")
        sys.exit(1)
    if len(projects) == 1:
        proj = projects[0]
        print(f"  Using project: {proj['name']} ({proj['projectId']})")
        return proj["projectId"]
    print("\nAvailable GCP projects:")
    for i, p in enumerate(projects):
        print(f"  [{i}] {p['name']} ({p['projectId']})")
    idx = int(input("Select project number: ").strip())
    return projects[idx]["projectId"]


def create_service_account(iam_service, project_id: str) -> dict:
    """Create (or retrieve) a service account and return its email."""
    sa_email = f"{SERVICE_ACCOUNT_NAME}@{project_id}.iam.gserviceaccount.com"
    try:
        existing = iam_service.projects().serviceAccounts().get(
            name=f"projects/{project_id}/serviceAccounts/{sa_email}"
        ).execute()
        print(f"  ✅ Service account already exists: {sa_email}")
        return existing
    except Exception:
        pass  # doesn't exist yet — create it

    sa = iam_service.projects().serviceAccounts().create(
        name=f"projects/{project_id}",
        body={
            "accountId": SERVICE_ACCOUNT_NAME,
            "serviceAccount": {"displayName": SERVICE_ACCOUNT_DISPLAY},
        },
    ).execute()
    print(f"  ✅ Created service account: {sa['email']}")
    return sa


def create_key(iam_service, project_id: str, sa_email: str) -> dict:
    """Create and download a JSON key for the service account."""
    key = iam_service.projects().serviceAccounts().keys().create(
        name=f"projects/{project_id}/serviceAccounts/{sa_email}",
        body={"privateKeyType": "TYPE_GOOGLE_CREDENTIALS_FILE", "keyAlgorithm": "KEY_ALG_RSA_2048"},
    ).execute()
    import base64
    decoded = base64.b64decode(key["privateKeyData"]).decode("utf-8")
    return json.loads(decoded)


def create_spreadsheet(creds, sa_email: str) -> str:
    """Create the leads spreadsheet and share it with the service account."""
    gc = gspread.authorize(creds)

    # Check if it already exists
    try:
        ssheet = gc.open(SPREADSHEET_NAME)
        print(f"  ✅ Spreadsheet already exists: {ssheet.id}")
    except gspread.SpreadsheetNotFound:
        ssheet = gc.create(SPREADSHEET_NAME)
        print(f"  ✅ Created spreadsheet: {ssheet.id}")

    # Write headers
    sheet = ssheet.sheet1
    if not sheet.row_values(1):
        sheet.append_row(HEADERS, value_input_option="RAW")
        # Format header row bold
        sheet.format("A1:O1", {"textFormat": {"bold": True}})
        print("  ✅ Headers written to sheet")

    # Share with service account
    ssheet.share(sa_email, perm_type="user", role="writer", notify=False)
    print(f"  ✅ Shared with {sa_email}")

    return ssheet.id


def main():
    print("\n" + "=" * 60)
    print("  Convoflow AI — Google Sheets Setup")
    print("=" * 60)
    print("\nOpening browser for Google authentication...")
    print("(Sign in with the account that owns your GCP project)\n")

    # Client config for OAuth — using Google's default installed app flow
    # You can replace this with a real client_id from GCP Console for production use
    client_config = {
        "installed": {
            "client_id": "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com",
            "client_secret": "d-FL95Q19q7MQmFpd7hHD0Ty",
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SETUP_SCOPES)
    creds = flow.run_local_server(port=0)

    # Build service clients
    crm_service = build("cloudresourcemanager", "v1", credentials=creds)
    iam_service = build("iam", "v1", credentials=creds)
    serviceusage_service = build("serviceusage", "v1", credentials=creds)

    print("\n[1/4] Resolving GCP project...")
    project_id = PROJECT_ID or get_or_create_project(crm_service)

    print("\n[2/4] Enabling APIs...")
    enable_apis(serviceusage_service, project_id)

    print("\n[3/4] Creating service account + key...")
    sa = create_service_account(iam_service, project_id)
    sa_email = sa["email"]
    key_json = create_key(iam_service, project_id, sa_email)

    print("\n[4/4] Creating spreadsheet...")
    spreadsheet_id = create_spreadsheet(creds, sa_email)

    # ─── Output ──────────────────────────────────────────────────────────────
    key_json_str = json.dumps(key_json)

    print("\n" + "=" * 60)
    print("  ✅ SETUP COMPLETE — Add these to Render Environment Variables")
    print("=" * 60)
    print(f"\nGOOGLE_SPREADSHEET_ID={spreadsheet_id}")
    print(f"\nGOOGLE_SERVICE_ACCOUNT_JSON={key_json_str}")
    print(f"\nSpreadsheet URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print("\n" + "=" * 60)

    # Save to a local file for easy copy-paste
    output = {
        "GOOGLE_SPREADSHEET_ID": spreadsheet_id,
        "GOOGLE_SERVICE_ACCOUNT_JSON": key_json_str,
        "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
    }
    out_path = os.path.join(os.path.dirname(__file__), "google_sheets_env.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nAlso saved to: {out_path}")
    print("(Add both values to Render → Environment, then redeploy)\n")


if __name__ == "__main__":
    main()
