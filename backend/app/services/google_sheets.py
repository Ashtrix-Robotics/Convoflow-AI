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
import re
from typing import Any

logger = logging.getLogger(__name__)

# Maps Lead ORM field names → possible header names in the Google Sheet (lowercase).
# First matching header wins when pushing updates back.
PUSH_FIELD_TO_COLUMN: dict[str, list[str]] = {
    "name": ["name"],
    "phone": ["phone", "phone number"],
    "email": ["email"],
    "source_campaign": ["campaign", "source_campaign"],
    "ad_set": ["ad set", "ad_set", "lead source"],
    "interest_level": ["interest level", "lead temperature"],
    "course_interested_in": ["course interested in", "academy preference"],
    "status": ["status"],
    "notes": ["notes", "detailed response"],
}

# Possible header names for the phone column (lowercase)
_PHONE_HEADERS = ("phone", "phone number")
# Possible header names for the timestamp column used as part of composite key (lowercase)
_TIMESTAMP_HEADERS = ("timestamp", "date of lead", "date", "created at")

_client = None         # lazy-initialised gspread client
_last_auth_error = ""  # last error from _get_client(), exposed via status endpoint


def _col_letter(col: int) -> str:
    """Convert a 1-based column number to an A1-notation column letter (e.g. 1→A, 27→AA)."""
    result = ""
    while col > 0:
        col, rem = divmod(col - 1, 26)
        result = chr(65 + rem) + result
    return result


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
        # Set a 60-second per-request timeout so that individual HTTP calls
        # (get_all_values, etc.) never hang indefinitely.
        # gspread Client.set_timeout() was added in v5.x and is present in 6.1.4.
        try:
            client.set_timeout(60)
        except Exception:
            pass  # best-effort — don't break auth if this fails
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


def _get_sheet():
    """
    Return the configured worksheet (google_source_sheet_name), 
    defaulting to 'Sheet1' if not set.
    """
    try:
        from app.core.config import settings
        if not settings.google_spreadsheet_id:
            return None
        client = _get_client()
        if not client:
            return None
        spreadsheet = client.open_by_key(settings.google_spreadsheet_id)
        
        # Use the sheet name configured in settings, default to 'Sheet1'
        sheet_name = settings.google_source_sheet_name or "Sheet1"
        try:
            return spreadsheet.worksheet(sheet_name)
        except Exception:
            # Tab doesn't exist yet — create it
            return spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=20)
    except Exception as exc:
        logger.error("Failed to open Google Sheet: %s", exc)
        return None


def _phone_suffix(phone: str) -> str:
    """Extract the last 10 digits from a phone string for suffix matching."""
    digits = re.sub(r"\D+", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else digits


def _build_phone_row_index(
    all_values: list[list[str]],
    col_index: dict[str, int],
) -> dict[str, int]:
    """
    Build a mapping of phone-suffix → sheet row number from the sheet data.
    Uses the last 10 digits of each phone so that +91XXXXXXXXXX, 91XXXXXXXXXX,
    and XXXXXXXXXX all resolve to the same row.
    """
    phone_col = next(
        (col_index[h] for h in _PHONE_HEADERS if h in col_index),
        None,
    )
    if not phone_col:
        return {}

    index: dict[str, int] = {}
    for row_idx, row in enumerate(all_values[1:], start=2):
        cell_val = row[phone_col - 1].strip() if len(row) >= phone_col else ""
        suffix = _phone_suffix(cell_val)
        if suffix:
            index[suffix] = row_idx
    return index


def _find_row_by_phone(
    lead_phone: str,
    phone_row_index: dict[str, int],
) -> int | None:
    """Look up a row number from the phone suffix index."""
    suffix = _phone_suffix(lead_phone)
    return phone_row_index.get(suffix) if suffix else None


def _collect_field_pairs(
    lead: Any,
    col_index: dict[str, int],
) -> list[tuple[int, str]]:
    """Build (1-based column index, value) pairs for all mappable fields."""
    pairs: list[tuple[int, str]] = []
    for field, candidates in PUSH_FIELD_TO_COLUMN.items():
        value = getattr(lead, field, None)
        if value is None:
            continue
        for hdr in candidates:
            if hdr in col_index:
                pairs.append((col_index[hdr], str(value)))
                break
    if lead.extra_data:
        for key, value in lead.extra_data.items():
            if value is None:
                continue
            nk = key.strip().lower()
            if nk in col_index:
                pairs.append((col_index[nk], str(value)))
    return pairs


def upsert_lead(lead: Any) -> None:
    """
    Update a lead's row in the configured Google Sheet.

    Reads the sheet's actual column headers and maps standard Lead fields + extra_data
    keys to matching columns. Locates the existing row by matching the phone number
    suffix (last 10 digits). If the lead is not found, a new row is appended.
    Called as a background task — never raises.
    """
    sheet = _get_sheet()
    if not sheet:
        return

    try:
        all_values = sheet.get_all_values()
        if not all_values:
            logger.warning("Sheet has no data; cannot sync lead %s", lead.id)
            return

        header_row = all_values[0]
        col_index: dict[str, int] = {
            h.strip().lower(): i + 1 for i, h in enumerate(header_row)
        }

        phone_row_index = _build_phone_row_index(all_values, col_index)
        target_row = _find_row_by_phone(str(lead.phone or ""), phone_row_index)
        pairs = _collect_field_pairs(lead, col_index)

        if target_row:
            updates = [
                {"range": f"{_col_letter(col)}{target_row}", "values": [[value]]}
                for col, value in pairs
            ]
            if updates:
                sheet.batch_update(updates, value_input_option="RAW")
        else:
            new_row = [""] * len(header_row)
            for col, value in pairs:
                new_row[col - 1] = value
            sheet.append_row(new_row, value_input_option="RAW")

    except Exception as exc:
        logger.error("Google Sheets upsert failed for lead %s: %s", lead.id, exc)


def bulk_sync(leads: list[Any]) -> int:
    """
    Push all leads to the configured Google Sheet in a single batch operation.
    Updates existing rows matched by phone number suffix.
    Appends new rows for leads not found in the sheet.
    Returns count of leads processed.
    """
    sheet = _get_sheet()
    if not sheet:
        return 0

    try:
        all_values = sheet.get_all_values()
        if not all_values:
            logger.warning("Sheet is empty; cannot bulk sync")
            return 0

        header_row = all_values[0]
        col_index: dict[str, int] = {
            h.strip().lower(): i + 1 for i, h in enumerate(header_row)
        }

        phone_row_index = _build_phone_row_index(all_values, col_index)

        all_updates: list[dict] = []
        appends: list[list[str]] = []

        for lead in leads:
            target_row = _find_row_by_phone(str(lead.phone or ""), phone_row_index)
            pairs = _collect_field_pairs(lead, col_index)

            if target_row:
                for col, value in pairs:
                    all_updates.append({
                        "range": f"{_col_letter(col)}{target_row}",
                        "values": [[value]],
                    })
            else:
                new_row = [""] * len(header_row)
                for col, value in pairs:
                    new_row[col - 1] = value
                appends.append(new_row)

        if all_updates:
            sheet.batch_update(all_updates, value_input_option="RAW")
        for row in appends:
            sheet.append_row(row, value_input_option="RAW")

        return len(leads)

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
    Uses a direct HTTP REST call with an explicit 60s timeout.
    Runs in a daemon thread so Python can exit cleanly if the request hangs.
    """
    import threading
    import urllib.parse

    def _fetch():
        from app.core.config import settings
        import requests
        from google.oauth2.service_account import Credentials
        from google.auth.transport.requests import Request

        if not settings.google_service_account_json or not settings.google_spreadsheet_id:
            return []

        raw = settings.google_service_account_json.strip()
        try:
            creds_dict = json.loads(raw)
        except json.JSONDecodeError:
            try:
                creds_dict = json.loads(raw.replace('\\"', '"'))
            except Exception:
                return []

        if "private_key" in creds_dict:
            creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
        ]
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        # Refresh credentials to get a valid access token.
        # Wrap Request in a session with a 30s timeout — the default session
        # has no timeout and can hang indefinitely on Render's free tier.
        _session = requests.Session()
        _session.verify = True

        class _TimeoutRequest(Request):
            """Force a 30s timeout on every HTTP call made during token refresh."""
            def __call__(self, url, method="GET", body=None, headers=None, timeout=30, **kw):
                return super().__call__(url, method=method, body=body, headers=headers, timeout=timeout, **kw)

        creds.refresh(_TimeoutRequest(session=_session))

        encoded_sheet = urllib.parse.quote(sheet_name, safe="")
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets"
            f"/{settings.google_spreadsheet_id}/values/{encoded_sheet}!A:Z"
        )
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        all_values = data.get("values", [])
        if not all_values:
            return []
        headers = [str(h).strip() for h in all_values[0]]
        return [
            {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
            for row in all_values[1:]
            if any(cell.strip() for cell in row)
        ]

    result_container: list = [None]
    exc_container: list = [None]

    def _run():
        try:
            result_container[0] = _fetch()
        except Exception as e:
            exc_container[0] = e

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=timeout_seconds)

    if t.is_alive():
        logger.error("Timed out pulling leads from sheet '%s' after %ds", sheet_name, timeout_seconds)
        # Invalidate the cached gspread client — its TCP connection may be in a broken state.
        global _client
        _client = None
        raise TimeoutError(f"Google Sheets API timed out after {timeout_seconds}s for sheet '{sheet_name}'")

    if exc_container[0] is not None:
        logger.error("Failed to pull leads from sheet '%s': %s", sheet_name, exc_container[0])
        return []

    return result_container[0] or []
