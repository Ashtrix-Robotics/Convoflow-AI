# Pabbly Connect — Workflow Reference

> Last verified: 2026-04-17 by Copilot via Playwright browser automation

## Account Access

| Field | Value |
|-------|-------|
| **Account Owner** | Rohit N (`pabbly@ashtrix.in`) |
| **Team Member Access** | Sreenath R (`sreenath@ashtrix.in`) — has workflow edit access |
| **Dashboard URL** | https://connect.pabbly.com/v2/app/dashboard |
| **Folder** | `ConvoFlow` (2 workflows) |
| **Task Quota** | 10,000 allotted / ~8,939 remaining |

> **Note:** Settings page (`/v2/app/setting`) is NOT accessible from team member accounts. API keys and account-level config require logging in as the account owner (`pabbly@ashtrix.in`).

---

## API Availability

**Pabbly Connect does NOT have a public REST API for workflow management.** Unlike Zapier or Make.com, there is no endpoint to list, read, or modify workflows programmatically.

- **Pabbly API docs** (https://apidocs.pabbly.com/) cover Email Marketing, Subscription Billing, Hook, Chatflow, and Email Verification — but NOT Connect.
- **No community MCP server** exists for Pabbly Connect (verified on GitHub).
- **Action Builder** (https://connect.pabbly.com/action-builder/) is for building custom action steps to use WITHIN workflows (e.g., custom API calls), not for managing workflows externally.

### How to Edit Workflows

1. **Browser UI** — Log in at https://connect.pabbly.com and edit workflows manually
2. **Playwright MCP** — Use the `mcp_microsoft_pla_browser_*` tools in VS Code to automate browser interactions with the Pabbly UI (this is how previous fixes were done)
3. **TinyMCE API** — For editing mapped fields in action steps, use `tinymce.get('editorId').setContent(html)` + `.fire('change')` via browser evaluate

---

## Workflow 1: Google Sheets Inbound Leads

| Field | Value |
|-------|-------|
| **Name** | Convoflow - Google Sheets Inbound Leads |
| **Status** | Active (ON) |
| **URL** | https://connect.pabbly.com/workflow/mapping/IjU3NjcwNTZmMDYzZjA0MzU1MjZjNTUzYzUxMzIi_pc |
| **Webhook URL** | https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjcwNTZmMDYzZjA0MzU1MjZjNTUzYzUxMzIi_pc |

### Trigger: Google Sheets — New or Updated Spreadsheet Row

The Google Sheet uses the **Pabbly Connect Webhooks** add-on to send data when rows are added/updated.

**Captured columns (Response A):**

| Label | Sample Value | Notes |
|-------|-------------|-------|
| Timestamp | 2026-04-10 | Date the lead was captured |
| Source Campaign | Summer Camp 2026 | Maps to `source_campaign` |
| Phone | 9999999999 | Maps to `phone` |
| Name | Test Lead | Maps to `name` |
| Google Sheet Row Id | 2 | Maps to `google_sheet_row_id` |
| Email | test@example.com | Maps to `email` |
| Ad Set | Chennai - Parents | Maps to `ad_set` |

### Action: API (Pabbly) — Execute API Request

**Target endpoint:** `POST https://convoflow-api.onrender.com/leads/inbound`

**Content-Type:** `application/json`

**Request body field mappings (6 fields):**

| API Field | Pabbly Dynamic Value | Source |
|-----------|---------------------|--------|
| `name` | `{{step1.Name}}` | Google Sheet "Name" column |
| `phone` | `{{step1.Phone}}` | Google Sheet "Phone" column |
| `email` | `{{step1.Email}}` | Google Sheet "Email" column |
| `source_campaign` | `{{step1.Source Campaign}}` | Google Sheet "Source Campaign" column |
| `ad_set` | `{{step1.Ad Set}}` | Google Sheet "Ad Set" column |
| `google_sheet_row_id` | `{{step1.Google Sheet Row Id}}` | Google Sheet "Google Sheet Row Id" column |

> **Note:** The `Timestamp` column from Google Sheets is NOT mapped to the API — it's available but unused. The backend uses `created_at` from the database instead.

---

## Workflow 2: Call Analyzed

| Field | Value |
|-------|-------|
| **Name** | Convoflow - Call Analyzed |
| **Status** | Inactive (OFF) |
| **URL** | (available via workflow dropdown) |

This workflow is designed to trigger after call transcription/analysis is complete. Currently inactive — needs setup when the call recording feature is in active use.

---

## Backend Integration

### POST /leads/inbound (LeadInbound Schema)

```python
class LeadInbound(BaseModel):
    model_config = ConfigDict(extra="allow")  # Extra fields → lead.extra_data JSON
    name: str
    phone: str
    email: str | None = None
    source_campaign: str | None = None
    ad_set: str | None = None
    google_sheet_row_id: str | None = None
```

**Backend behavior:**
1. Verifies optional HMAC signature (`x_pabbly_signature` header)
2. Normalizes phone number (strips non-digits, adds `91` prefix)
3. Deduplicates by last 10 digits using `phone_lookup_variants()`
4. **If existing lead:** Updates name, email, source_campaign; merges extra fields into `extra_data`
5. **If new lead:** Creates with round-robin agent assignment (agent with fewest active leads)
6. Runs background tasks: `sync_lead_whatsapp_state`, `sheets_upsert`

### Outbound Webhooks (backend → Pabbly)

The backend's `pabbly.py` service fires signed webhooks:
- `transcription.completed` — after Groq Whisper finishes
- `followup.scheduled` — after agent creates a follow-up

Signed with HMAC-SHA256 using `PABBLY_SECRET_KEY`.

---

## Google Sheets ↔ Database Column Mapping

### Inbound (Sheet → DB via Pabbly)

| Sheet Column | Pabbly Label | API Field | DB Column |
|-------------|-------------|-----------|-----------|
| Name | Name | `name` | `leads.name` |
| Phone / Phone Number | Phone | `phone` | `leads.phone` |
| Email | Email | `email` | `leads.email` |
| Campaign / Source Campaign | Source Campaign | `source_campaign` | `leads.source_campaign` |
| Ad Set / Lead Source | Ad Set | `ad_set` | `leads.ad_set` |
| Google Sheet Row Id | Google Sheet Row Id | `google_sheet_row_id` | `leads.google_sheet_row_id` |
| Timestamp | Timestamp | *(not mapped)* | *(not stored)* |

### Outbound (DB → Sheet via google_sheets.py)

`PUSH_FIELD_TO_COLUMN` mapping in `backend/app/services/google_sheets.py`:

| DB Field | Matched Sheet Column Names |
|----------|---------------------------|
| `name` | "name" |
| `phone` | "phone", "phone number" |
| `email` | "email" |
| `source_campaign` | "campaign", "source_campaign" |
| `ad_set` | "ad set", "ad_set", "lead source" |
| `interest_level` | "interest level", "lead temperature" |
| `course_interested_in` | "course interested in", "academy preference" |
| `status` | "status" |
| `notes` | "notes", "detailed response" |

---

## Troubleshooting

### Common Issues

1. **Leads not syncing from Sheet → App**
   - Check if the Pabbly Connect Webhooks add-on is enabled in Google Sheets
   - Verify the webhook URL matches the one in the trigger step
   - Check Pabbly History for failed tasks

2. **Fields arriving empty**
   - Verify the TinyMCE editors in the action step have correct dynamic_value spans
   - Use browser evaluate: `tinymce.get('editorId').getContent()` to check

3. **Duplicate leads**
   - The backend deduplicates by last 10 digits of phone number
   - If a phone matches, it updates the existing lead instead of creating new

4. **Settings page inaccessible**
   - You're likely logged in as a team member — Settings requires the account owner login

### Editing Field Mappings via Playwright

To edit a field mapping in the action step:

```javascript
// 1. Find the TinyMCE editor ID for the field
const editors = tinymce.get();
editors.forEach(e => console.log(e.id, e.getContent()));

// 2. Set new content with dynamic value
tinymce.get('EDITOR_ID').setContent(
  '<span class="dynamic_value" data-attr="0<=-+*/@/*+-=>field_name" contenteditable="false">1. Field Name : Sample Value</span>'
);
tinymce.get('EDITOR_ID').fire('change');

// 3. Save the step
```
