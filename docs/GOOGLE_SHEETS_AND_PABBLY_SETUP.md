# Google Sheets + Pabbly Integration Setup Guide

> **Status as of April 2026**
>
> - `/leads/inbound` endpoint: ✅ **LIVE and verified** (HTTP 201)
> - Google Sheets sync code: ✅ **Deployed** — waits for env vars
> - Pabbly integration code: ✅ **Deployed** — waits for Pabbly workflow config

---

## Part 1 — Google Cloud Setup (One-Time, ~15 minutes)

This connects the app → Google Sheets direction (when leads are updated in the app, the sheet reflects it).

### Step 1 — Install the setup script dependencies

Open a terminal in the project root:

```bash
pip install google-auth google-auth-oauthlib gspread google-api-python-client
```

### Step 2 — Run the setup script

```bash
python scripts/setup_google_sheets.py
```

What it does automatically:

- Opens your browser → asks you to sign in with your Google account
- Creates a Google Cloud service account named `convoflow-sheets@<project>.iam.gserviceaccount.com`
- Enables Sheets API + Drive API
- Creates a new spreadsheet: **"Convoflow AI — Leads"** with correct headers in row 1
- Shares the sheet with the service account (Editor access)
- Saves the two values you need to a file: `scripts/google_sheets_env.json`

### Step 3 — What you get from the script

After it finishes, it prints (and saves to `scripts/google_sheets_env.json`):

```
GOOGLE_SPREADSHEET_ID = 1BxiMVs0XRA5nFMdK...
GOOGLE_SERVICE_ACCOUNT_JSON = {"type":"service_account","project_id":"...","private_key":"...",...}
```

### Step 4 — Add these two values to Render

1. Go to: https://dashboard.render.com → **convoflow-api** → **Environment**
2. Add these two environment variables:

| Key                           | Value                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| `GOOGLE_SPREADSHEET_ID`       | The ID string from step 3                                                   |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire JSON string** from step 3 (paste as-is, including `{` and `}`) |

3. Click **Save Changes** → Render will automatically redeploy.

### Step 5 — Do the initial bulk sync

Once Render redeploys (~2 minutes):

1. Open: https://convoflow-web.vercel.app/admin/settings
2. Scroll to **Google Sheets** panel
3. Status should show: **CONFIGURED ✓**
4. Click **"Bulk Sync All Leads → Sheet"**

All existing leads will be written to the spreadsheet immediately.

> After this, every new lead or lead update automatically syncs in the background.

---

## Part 2 — Pabbly Connect Setup (One-Time, ~20 minutes)

This connects Google Sheets → App direction (when a new ad lead lands in your Google Sheet, Pabbly pushes it to the app).

### What Pabbly needs to do

Every time a new row is added to your **ads/lead capture Google Sheet** (e.g., from Facebook Ads, Google Ads, or a form), Pabbly should:

1. Detect the new row
2. Send an HTTP POST to: `https://convoflow-api.onrender.com/leads/inbound`

### Step 1 — Create a new workflow in Pabbly Connect

1. Log in to [Pabbly Connect](https://connect.pabbly.com)
2. Click **Create Workflow** → name it: `New Lead from Google Sheets`

### Step 2 — Set the Trigger

- **App**: Google Sheets
- **Event**: New or Updated Spreadsheet Row
- Connect your Google account
- Select the spreadsheet where your ad leads land (your ads intake sheet — **NOT** the Convoflow sync sheet created in Part 1)
- Select the sheet tab (usually "Sheet1" or "Leads")
- Test the trigger — it should show one row of data

### Step 3 — Set the Action

- **App**: HTTP
- **Method**: POST
- **URL**: `https://convoflow-api.onrender.com/leads/inbound`
- **Content-Type**: `application/json`
- **Body** (map from your sheet columns):

```json
{
  "name": "{{Full Name column}}",
  "phone": "{{Phone column}}",
  "email": "{{Email column}}",
  "source_campaign": "{{Campaign Name column}}",
  "ad_set": "{{Ad Set column}}",
  "google_sheet_row_id": "{{Row ID or row number}}"
}
```

> Only `name` and `phone` are required. Everything else is optional.

### Step 4 — Save and activate the workflow

Click **Save** → toggle the workflow **ON**.

### Step 5 — Test end-to-end

1. Add a test row to your ads intake Google Sheet
2. In Pabbly, go to the workflow → **History** tab → verify the HTTP POST shows **200** or **201**
3. Open https://convoflow-web.vercel.app → **Leads** page
4. The new lead should appear, auto-assigned to an agent

---

## Part 3 — Verified Endpoint Details (for reference)

**Endpoint**: `POST https://convoflow-api.onrender.com/leads/inbound`

**Verified working** (tested April 2026 — returned HTTP 201):

```json
{
  "name": "Lead Name",
  "phone": "+919876543210",
  "email": "optional@example.com",
  "source_campaign": "Facebook - Summer 2026",
  "ad_set": "18-25 Mumbai",
  "google_sheet_row_id": "ROW_1"
}
```

**What happens automatically on each inbound lead:**

1. Phone number is normalized and deduplicated (same number = update, not duplicate)
2. Lead is round-robin assigned to the active agent with fewest open leads
3. AiSensy WhatsApp state is synced (background)
4. Lead is upserted into Convoflow Sheets sync (background, once Google configured)
5. `lead.imported` event is fired to Pabbly outbound webhook

**No authentication required** on `/leads/inbound` — it's a public webhook endpoint.

---

## Part 4 — How the Two Directions Work Together

```
Your Ads Google Sheet
        │
        │  New row added (Facebook/Google Ads form submission)
        ▼
   Pabbly Connect
        │
        │  HTTP POST /leads/inbound
        ▼
  Convoflow API ─────────────────────────────────────┐
        │                                             │
        │  Lead saved to database                     │
        │  Agent auto-assigned                        │
        │                                             │
        │  (background)                               ▼
        │                              Convoflow Sync Sheet
        │                              (status, notes, agent
        │                               updated here as agents
        │                               work the lead)
        ▼
   Agent's Mobile App
   (gets lead, makes calls, updates status)
```

The **two sheets are separate**:

- **Ads/intake sheet** → your Google Ads / Facebook Ads lead capture sheet. Pabbly watches this.
- **Convoflow sync sheet** → auto-maintained by the app. Shows live status of every lead.

---

## Quick Checklist

- [ ] Run `python scripts/setup_google_sheets.py`
- [ ] Add `GOOGLE_SPREADSHEET_ID` to Render Environment
- [ ] Add `GOOGLE_SERVICE_ACCOUNT_JSON` to Render Environment
- [ ] Wait for Render auto-redeploy (~2 min)
- [ ] Go to Admin Settings → click "Bulk Sync All Leads → Sheet"
- [ ] In Pabbly: create workflow → Google Sheets trigger → HTTP POST to `/leads/inbound`
- [ ] Map fields (name, phone, email, source_campaign, ad_set, google_sheet_row_id)
- [ ] Test by adding a row to your intake sheet → verify lead appears in app
