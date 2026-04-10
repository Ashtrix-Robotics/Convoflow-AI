# Production Google Sheet Migration Guide

This guide explains how to switch from the temporary test Google Sheet to the actual production sheet where Meta ad leads flow in.

---

## Current Architecture

```
Meta Ads → Google Sheet (30-col intake)
                ↓  Pabbly WF1 watches new rows
           /leads/inbound API
                ↓
          Convoflow Database
                ↓  auto-sync on create/update
     "Convoflow Leads" tab (15-col app-managed)
```

**Two tabs exist in the spreadsheet:**

1. **Source tab** (e.g. "Sheet1") — Where Meta leads land via Zapier/Pabbly/direct integration. Has ~30 columns.
2. **"Convoflow Leads" tab** — Auto-created and managed by the app. Receives all lead data on create/update.

---

## Actual Production Sheet Columns (30)

```
Timestamp, Date of Calling, Closer Name, Date of Lead, Name, email,
Phone number, Whatsapp Number, Child name, Grade, Academy Preference,
Loc. Map Link, Proposed Batch, Status, Response, Follow-Up Day Count,
Automation Init Date, Init Follow-up, Mode, Follow Up Count,
Detailed Response, Location/Area, Parent's Profession, Lead Temperature,
Lead Source, Secondary Action plan, Challenges to enrol, Batch Enrolled,
Batch Time, Campaign
```

### Column Mapping to LeadInbound API

| Sheet Column     | API Field         | Notes                          |
| ---------------- | ----------------- | ------------------------------ |
| Name             | `name`            | Required                       |
| Phone number     | `phone`           | Required — normalized to E.164 |
| email            | `email`           | Optional                       |
| Campaign         | `source_campaign` | Maps to campaign tracking      |
| Lead Source      | `ad_set`          | Can use for ad set tracking    |
| Whatsapp Number  | `whatsapp_number` | If different from phone        |
| Lead Temperature | `intent_category` | hot/warm/cold                  |

**Currently unused columns** that could be mapped later:

- Child name, Grade, Academy Preference, Location/Area, Parent's Profession
- These would require adding new fields to the Lead model if needed.

---

## Migration Steps

### Step 1: Get the Production Google Sheet ID

Open your production Google Sheet. The ID is in the URL:

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

### Step 2: Share with Service Account

Share the production sheet with the service account email (as **Editor**):

```
convoflow-sheets@convoflow-ai-492912.iam.gserviceaccount.com
```

### Step 3: Update Render Environment Variables

On your [Render dashboard](https://dashboard.render.com):

1. Go to your `convoflow-api` service → **Environment**
2. Update `GOOGLE_SPREADSHEET_ID` to the new production sheet ID
3. Add `GOOGLE_SOURCE_SHEET_NAME` set to the exact tab name where leads arrive (e.g. `Sheet1` or `Leads`)
4. Click **Save Changes** — the service will redeploy

### Step 4: Configure Source Sheet Tab in Admin UI

1. Go to **Admin Settings** → **Google Sheets Sync** section
2. Enter the source sheet tab name in the **Source Sheet Tab Name** field
3. Click **Save**

### Step 5: Update Pabbly WF1 Google Sheets Trigger

> ⚠️ **Do NOT modify existing Pabbly workflows.** Create a new workflow or update the trigger configuration only.

In Pabbly Connect:

1. Open WF1 (the Google Sheets → Webhook workflow)
2. Update the **Google Sheets trigger** to point to the new spreadsheet
3. Select the correct worksheet tab
4. Update field mappings:

| Pabbly Field    | Sheet Column |
| --------------- | ------------ |
| name            | Name         |
| phone           | Phone number |
| email           | email        |
| source_campaign | Campaign     |
| ad_set          | Lead Source  |

5. Test the trigger to confirm it picks up new rows

### Step 6: Run Initial Bulk Sync

After deployment:

1. Go to **Admin Settings** → **Google Sheets Sync**
2. Click **Bulk Sync All Leads → Sheet**
3. This populates the "Convoflow Leads" tab in the new spreadsheet with all existing leads

### Step 7: Verify

1. Add a test row to the source tab in the production sheet
2. Confirm Pabbly WF1 triggers and creates the lead in Convoflow
3. Confirm the lead appears in the web dashboard
4. Confirm the "Convoflow Leads" tab is updated

---

## Environment Variables Reference

| Variable                      | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON key content of the service account            |
| `GOOGLE_SPREADSHEET_ID`       | The spreadsheet ID from the Google Sheets URL           |
| `GOOGLE_SOURCE_SHEET_NAME`    | Tab name where inbound leads arrive (default: "Sheet1") |

---

## Rollback

To revert to the test sheet:

1. Set `GOOGLE_SPREADSHEET_ID` back to the test sheet ID (`1cgzWHrIQwf_16qzAWkX5B8UniuQ9vPiBMJeuUOAk4lk`)
2. Redeploy on Render
3. Revert Pabbly WF1 trigger to the test sheet
