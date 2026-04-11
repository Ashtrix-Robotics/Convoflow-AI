from __future__ import annotations
"""
Google Sheets sync service — pushes every lead create/update into a Google Spreadsheet.

Setup:
  1. Create a Google Cloud service account with Sheets + Drive API enabled.
  2. Download the JSON key and set GOOGLE_SERVICE_ACCOUNT_JSON=<contents> in Render env.
  3. Create a Google Sheet and set GOOGLE_SPREADSHEET_ID=<id> in Render env.
  4. Share the sheet with the service account email (Editor).
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Column layout — MUST match HEADERS order below
HEADERS = [
    "Lead ID",
    "Name",
    "Phone",
    "Email",
    "Campaign",
    "Ad Set",
    "Status",
    "Intent",
    "Assigned Agent",
    "Interest Level",
    "Course Interested In",
    "Notes",
    "Follow-up Count",
    "Created At",
    "Updated At",
]

_client = None         # lazy-initialised gspread client
_last_auth_error = ""  # last error from _get_client(), exposed via status endpoint


def _get_client():
    """Return authenticated gspread client (cached). Returns None if not configured."""
    global _client, _last_auth_error
    if _client is not None:
        return _client

    try:
        from app.core.config import settings  # local import avoids circular dependency
        if not settings.google_service_account_json:
            _last_auth_error = "GOOGLE_SERVICE_ACCOUNT_JSON is empty"
            return None

        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
        ]
        raw = settings.google_service_account_json.strip()
        # Try parsing directly first (correct format: {"type":"service_account",...})
        try:
            creds_dict = json.loads(raw)
        except json.JSONDecodeError:
            # Fallback: value was copy-pasted from a JSON file with backslash-escaped
            # internal quotes e.g. {\"type\":\"service_account\",...}
            # Fix by replacing \" with " — \n sequences remain as-is for json.loads to handle
            try:
                creds_dict = json.loads(raw.replace('\\"', '"'))
            except Exception as inner_exc:
                raise ValueError(
                    f"GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. "
                    f"Paste the raw JSON (starting with {{) without surrounding quotes. "
                    f"Inner error: {inner_exc}"
                ) from inner_exc

        # Normalize private_key newlines: when copied from a .json file the key may
        # have literal \\n (backslash+n) instead of real newline chars in the PEM.
        # This is always safe to apply — if the key already has real newlines
        # the replace finds nothing to substitute.
        if "private_key" in creds_dict:
            creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        client = gspread.authorize(creds)
        # Set a 90-second timeout on all HTTP requests to prevent indefinite hangs
        client.session.timeout = 90
        _client = client
        _last_auth_error = ""
        return _client
    except Exception as exc:
        _last_auth_error = str(exc)
        logger.error("Google Sheets auth failed: %s", exc)
        return None


def get_auth_error() -> str:
    """Return the last authentication error string (empty = no error)."""
    return _last_auth_error


WORKSHEET_NAME = "Convoflow Leads"


def _get_sheet():
    """
    Return the 'Convoflow Leads' worksheet, creating it if it doesn't exist.
    This leaves the user's existing sheets (Sheet1, etc.) untouched.
    """
    try:
        from app.core.config import settings
        if not settings.google_spreadsheet_id:
            return None
        client = _get_client()
        if not client:
            return None
        spreadsheet = client.open_by_key(settings.google_spreadsheet_id)
        try:
            return spreadsheet.worksheet(WORKSHEET_NAME)
        except Exception:
            # Tab doesn't exist yet — create it
            return spreadsheet.add_worksheet(title=WORKSHEET_NAME, rows=1000, cols=20)
    except Exception as exc:
        logger.error("Failed to open Google Sheet: %s", exc)
        return None


def _ensure_headers(sheet) -> None:
    """Write header row on row 1 if the sheet is empty."""
    try:
        if not sheet.row_values(1):
            sheet.append_row(HEADERS, value_input_option="RAW")
    except Exception as exc:
        logger.error("Failed to write sheet headers: %s", exc)


def _lead_row(lead: Any) -> list[str]:
    """Serialize a Lead ORM object to a flat row matching HEADERS."""
    agent_name = ""
    try:
        agent_name = lead.assigned_agent.name if lead.assigned_agent else ""
    except Exception:
        pass

    return [
        str(lead.id),
        str(lead.name or ""),
        str(lead.phone or ""),
        str(lead.email or ""),
        str(lead.source_campaign or ""),
        str(lead.ad_set or ""),
        str(lead.status or ""),
        str(lead.intent_category or ""),
        agent_name,
        str(lead.interest_level or ""),
        str(lead.course_interested_in or ""),
        str(lead.notes or ""),
        str(lead.followup_count),
        lead.created_at.isoformat() if lead.created_at else "",
        lead.updated_at.isoformat() if lead.updated_at else "",
    ]


def upsert_lead(lead: Any) -> None:
    """
    Insert or update a lead's row in Google Sheets.
    Keyed on column A (Lead ID). Called as a background task — never raises.
    """
    sheet = _get_sheet()
    if not sheet:
        return

    try:
        _ensure_headers(sheet)
        row = _lead_row(lead)
        lead_id = str(lead.id)

        try:
            cell = sheet.find(lead_id, in_column=1)
            # Update in place — gspread 6.x: values first, range second
            end_col = chr(ord("A") + len(HEADERS) - 1)
            sheet.update(
                [row],
                f"A{cell.row}:{end_col}{cell.row}",
                value_input_option="RAW",
            )
        except Exception:
            # Cell not found → append as new row
            sheet.append_row(row, value_input_option="RAW")

    except Exception as exc:
        logger.error("Google Sheets upsert failed for lead %s: %s", lead.id, exc)


def bulk_sync(leads: list[Any]) -> int:
    """
    Bulk-write all leads to the sheet (clears existing data, rewrites from scratch).
    Returns number of rows written. Called from admin endpoint.
    """
    sheet = _get_sheet()
    if not sheet:
        return 0

    try:
        rows = [HEADERS] + [_lead_row(lead) for lead in leads]
        sheet.clear()
        # gspread 6.x: values first, range_name second
        sheet.update(rows, "A1", value_input_option="RAW")
        return len(rows) - 1  # exclude header
    except Exception as exc:
        logger.error("Google Sheets bulk sync failed: %s", exc)
        return 0


def list_worksheets() -> list[str]:
    """Return a list of worksheet tab names in the configured spreadsheet."""
    try:
        from app.core.config import settings
        client = _get_client()
        if not client or not settings.google_spreadsheet_id:
            return []
        spreadsheet = client.open_by_key(settings.google_spreadsheet_id)
        return [ws.title for ws in spreadsheet.worksheets()]
    except Exception as exc:
        logger.error("Failed to list worksheets: %s", exc)
        return []


def pull_leads_from_sheet(sheet_name: str, timeout_seconds: int = 120) -> list[dict[str, str]]:
    """
    Read all rows from a specific worksheet tab and return them as a list of dicts.
    The first row is treated as the header.
    Returns an empty list on any error.
    Uses a thread-level timeout to prevent hanging on slow sheets.
    """
    import concurrent.futures

    def _fetch():
        from app.core.config import settings
        client = _get_client()
        if not client or not settings.google_spreadsheet_id:
            return []
        spreadsheet = client.open_by_key(settings.google_spreadsheet_id)
        ws = spreadsheet.worksheet(sheet_name)
        return ws.get_all_records(expected_headers=[])

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_fetch)
            return future.result(timeout=timeout_seconds)
    except concurrent.futures.TimeoutError:
        logger.error("Timed out pulling leads from sheet '%s' after %ds", sheet_name, timeout_seconds)
        raise TimeoutError(f"Google Sheets API timed out after {timeout_seconds}s for sheet '{sheet_name}'")
    except Exception as exc:
        logger.error("Failed to pull leads from sheet '%s': %s", sheet_name, exc)
        return []
