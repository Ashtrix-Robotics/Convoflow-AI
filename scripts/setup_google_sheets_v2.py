"""
Google Sheets Setup Script for Convoflow AI (Service Account version)
=====================================================================

This script does NOT use browser OAuth — it uses a service account JSON key
that you download directly from Google Cloud Console.

Steps:
  1. Run:  pip install gspread google-auth
  2. Follow the Google Cloud Console steps printed below to get your key file.
  3. Run:  python scripts/setup_google_sheets_v2.py <path-to-key.json>

The script will:
  - Validate the credentials
  - Write headers to your existing Google Sheet
  - Print the two env vars to paste into Render

Your sheet: https://docs.google.com/spreadsheets/d/1cgzWHrIQwf_16qzAWkX5B8UniuQ9vPiBMJeuUOAk4lk/edit
"""

import json
import os
import sys

SPREADSHEET_ID = "1cgzWHrIQwf_16qzAWkX5B8UniuQ9vPiBMJeuUOAk4lk"

HEADERS = [
    "Lead ID", "Name", "Phone", "Email", "Campaign", "Ad Set",
    "Status", "Intent", "Assigned Agent", "Interest Level",
    "Course Interested In", "Notes", "Follow-up Count", "Created At", "Updated At",
]

INSTRUCTIONS = """
╔══════════════════════════════════════════════════════════════════════════════╗
║         HOW TO GET YOUR SERVICE ACCOUNT KEY (5 minutes)                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  1. Open: https://console.cloud.google.com                                   ║
║                                                                              ║
║  2. Select or create a project (any name, e.g. "convoflow-ai")               ║
║                                                                              ║
║  3. Enable APIs (search for each in the top bar → click Enable):             ║
║       - Google Sheets API                                                    ║
║       - Google Drive API                                                     ║
║                                                                              ║
║  4. Create a Service Account:                                                ║
║       - Left menu → IAM & Admin → Service Accounts                          ║
║       - Click "Create Service Account"                                       ║
║       - Name: convoflow-sheets                                               ║
║       - Click "Create and Continue" → "Done" (no role needed)                ║
║                                                                              ║
║  5. Download the JSON key:                                                   ║
║       - Click on the service account you just created                        ║
║       - Go to "Keys" tab → "Add Key" → "Create new key" → JSON              ║
║       - Save the downloaded file somewhere accessible                        ║
║                                                                              ║
║  6. Note the service account email (looks like):                             ║
║       convoflow-sheets@<project-id>.iam.gserviceaccount.com                  ║
║                                                                              ║
║  7. Share your Google Sheet with that email (Editor access):                 ║
║       - Open your sheet                                                      ║
║       - Click Share → paste the service account email → Editor → Send       ║
║                                                                              ║
║  8. Run this script again with the key file path:                            ║
║       python scripts/setup_google_sheets_v2.py path/to/key.json             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""


def main():
    # ── Check deps ──────────────────────────────────────────────────────────
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print("Missing dependencies. Install with:")
        print("  pip install gspread google-auth")
        sys.exit(1)

    # ── Get key file path ────────────────────────────────────────────────────
    if len(sys.argv) < 2:
        print(INSTRUCTIONS)
        print("Usage:  python scripts/setup_google_sheets_v2.py path/to/service-account-key.json")
        sys.exit(0)

    key_path = sys.argv[1]
    if not os.path.isfile(key_path):
        print(f"\n❌  File not found: {key_path}")
        sys.exit(1)

    # ── Load and validate key ────────────────────────────────────────────────
    try:
        with open(key_path, "r", encoding="utf-8") as f:
            key_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"\n❌  Invalid JSON in key file: {e}")
        sys.exit(1)

    if key_data.get("type") != "service_account":
        print('\n❌  Key file does not look like a service account JSON.')
        print('    Make sure you downloaded "JSON" key type from Google Cloud Console.')
        sys.exit(1)

    service_account_email = key_data.get("client_email", "unknown")
    print(f"\n✅  Loaded service account: {service_account_email}")

    # ── Authenticate ─────────────────────────────────────────────────────────
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
    ]
    try:
        creds = Credentials.from_service_account_info(key_data, scopes=scopes)
        gc = gspread.authorize(creds)
        print("✅  Authenticated with Google Sheets API")
    except Exception as e:
        print(f"\n❌  Authentication failed: {e}")
        print("    Double-check the JSON key file is valid and not expired.")
        sys.exit(1)

    # ── Open the sheet ───────────────────────────────────────────────────────
    try:
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        sheet = spreadsheet.sheet1
        print(f"✅  Opened sheet: {spreadsheet.title}")
    except Exception as e:
        print(f"\n❌  Could not open spreadsheet: {e}")
        print()
        print("  Most likely cause: the sheet is not shared with the service account.")
        print(f"  Share your sheet (Editor access) with:  {service_account_email}")
        print()
        print("  Sheet URL:")
        print(f"  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
        print()
        print("  Then run this script again.")
        sys.exit(1)

    # ── Write headers if row 1 is empty ─────────────────────────────────────
    try:
        existing_row1 = sheet.row_values(1)
    except Exception:
        existing_row1 = []

    if existing_row1 and existing_row1[0] == "Lead ID":
        print("✅  Headers already set up correctly")
    elif existing_row1:
        print(f"⚠️   Row 1 already has content: {existing_row1[:3]}...")
        resp = input("   Overwrite row 1 with Convoflow headers? [y/N]: ").strip().lower()
        if resp == "y":
            sheet.insert_row(HEADERS, 1)
            print("✅  Headers inserted at row 1")
        else:
            print("   Skipped — headers not changed.")
    else:
        sheet.insert_row(HEADERS, 1)
        print("✅  Headers written to row 1")

    # ── Output env vars ──────────────────────────────────────────────────────
    key_json_str = json.dumps(key_data, separators=(",", ":"))

    print()
    print("═" * 78)
    print("  ADD THESE TWO VARIABLES TO RENDER ENVIRONMENT")
    print("  Render Dashboard → convoflow-api → Environment → Edit → Add variable")
    print("═" * 78)
    print()
    print(f"  GOOGLE_SPREADSHEET_ID")
    print(f"  {SPREADSHEET_ID}")
    print()
    print(f"  GOOGLE_SERVICE_ACCOUNT_JSON")
    print(f"  {key_json_str}")
    print()
    print("═" * 78)

    # ── Save to file ─────────────────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(__file__), "google_sheets_env.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "GOOGLE_SPREADSHEET_ID": SPREADSHEET_ID,
            "GOOGLE_SERVICE_ACCOUNT_JSON": key_json_str,
        }, f, indent=2)

    print(f"\n✅  Also saved to: {output_path}")
    print()
    print("  NEXT STEPS:")
    print("  1. Copy both env vars above into Render → Environment")
    print("  2. Click 'Save Changes' (Render auto-redeploys)")
    print("  3. Wait ~2 min, then open Admin Settings in the web dashboard")
    print("  4. Click 'Bulk Sync All Leads → Sheet' to do the first sync")
    print()
    print(f"  Your sheet: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
    print()


if __name__ == "__main__":
    main()
