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

_client = None   # lazy-initialised gspread client


def _get_client():
    """Return authenticated gspread client (cached). Returns None if not configured."""
    global _client
    if _client is not None:
        return _client

    try:
        from app.core.config import settings  # local import avoids circular dependency
        if not settings.google_service_account_json:
            return None

        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
        ]
        creds_dict = json.loads(settings.google_service_account_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        _client = gspread.authorize(creds)
        return _client
    except Exception as exc:
        logger.error("Google Sheets auth failed: %s", exc)
        return None


def _get_sheet():
    """Return the first worksheet of the configured spreadsheet."""
    try:
        from app.core.config import settings
        if not settings.google_spreadsheet_id:
            return None
        client = _get_client()
        if not client:
            return None
        return client.open_by_key(settings.google_spreadsheet_id).sheet1
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
            import gspread
            cell = sheet.find(lead_id, in_column=1)
            # Update in place (row number is 1-based)
            end_col = chr(ord("A") + len(HEADERS) - 1)
            sheet.update(f"A{cell.row}:{end_col}{cell.row}", [row], value_input_option="RAW")
        except Exception:
            # Cell not found → append
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
        sheet.update("A1", rows, value_input_option="RAW")
        return len(rows) - 1  # exclude header
    except Exception as exc:
        logger.error("Google Sheets bulk sync failed: %s", exc)
        return 0
