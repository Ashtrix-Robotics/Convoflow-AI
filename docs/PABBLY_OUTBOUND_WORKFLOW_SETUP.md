# Pabbly Connect — Outbound Workflow Setup Guide

> **Status as of April 2026**
>
> - Configured webhook URL in `backend/.env` is returning **404** — the Pabbly workflow was deleted or never created.
> - Session cookies provided for verification were expired (server-side invalidated).
> - **Action required:** Log into Pabbly, create a new workflow, update `PABBLY_WEBHOOK_URL` in `backend/.env` and Render.

---

## Overview — What This Workflow Does

The backend fires events every time something meaningful happens (call analyzed, lead classified, schedule shared). A **single Pabbly "Webhook by Pabbly" workflow** receives all events and uses a **Path Router** to branch on the `event` field.

```
Convoflow API (FastAPI)
        │
        │  POST PABBLY_WEBHOOK_URL
        │  { "event": "call.analyzed", "data": { ... } }
        ▼
Pabbly Webhook Trigger
        │
        ▼
   Path Router (branching on `event` field)
        ├── call.analyzed         → (optional) update Google Sheet row
        ├── lead.interested       → WhatsApp: send course details + fee
        ├── lead.callback_scheduled → WhatsApp: "We'll call you at <time>"
        ├── lead.not_interested   → (optional) add to cold drip sequence
        ├── lead.future_planning  → (optional) add to nurture sequence
        ├── transcription.completed → (legacy, optional)
        ├── followup.scheduled    → WhatsApp: follow-up reminder to agent
        └── class.schedule_shared → WhatsApp: send center + batch details to parent
```

---

## Step 1 — Create the Pabbly Workflow

1. Log in to [Pabbly Connect](https://connect.pabbly.com)
2. Click **Create Workflow**
3. Name it: `Convoflow AI — Event Router`
4. **Trigger App**: `Webhook by Pabbly`
5. **Trigger Event**: `Catch Hook`
6. Copy the webhook URL shown — it looks like:
   ```
   https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjcwNTZm...
   ```

---

## Step 2 — Update the Webhook URL

### Local dev (`backend/.env`):
```env
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/workflow/sendwebhookdata/<YOUR_NEW_ID>
```

### Production (Render):
1. Go to https://dashboard.render.com → **convoflow-api** → **Environment**
2. Update `PABBLY_WEBHOOK_URL` with the new URL
3. Click **Save Changes** → Render auto-redeploys

---

## Step 3 — Fire Sample Events to Capture All Schemas

Once the URL is updated in `backend/.env`, run the setup script from the project root:

```powershell
.\scripts\setup-pabbly-workflows.ps1
```

This fires **8 sample events** (one per event type) so Pabbly captures the full schema for each. Once complete, all 8 will appear in the workflow's **Test Data** panel.

---

## Step 4 — Add Path Router

After the webhook trigger:

1. Add step → **Path Router**
2. Create 8 paths, one per event type:

| Path Name              | Filter: `event` equals              |
| ---------------------- | ----------------------------------- |
| Call Analyzed          | `call.analyzed`                     |
| Lead Interested        | `lead.interested`                   |
| Callback Scheduled     | `lead.callback_scheduled`           |
| Not Interested         | `lead.not_interested`               |
| Future Planning        | `lead.future_planning`              |
| Transcription Done     | `transcription.completed`           |
| Follow-up Scheduled    | `followup.scheduled`                |
| Class Schedule Shared  | `class.schedule_shared`             |

---

## Step 5 — Configure Each Path's Actions

### Path: `lead.interested`
**Goal:** Send WhatsApp with course info + fee structure

| Step | App       | Action                    | Map Fields                             |
| ---- | --------- | ------------------------- | -------------------------------------- |
| 1    | AiSensy   | Send Template Message     | phone → `data.phone`, name → `data.name` |

Template variables to map:
- `{{1}}` → `data.name`
- `{{2}}` → `data.course_interested_in`
- `{{3}}` → `data.agent_name`
- `{{4}}` → `data.payment_link_url` (if set)

---

### Path: `lead.callback_scheduled`
**Goal:** WhatsApp confirmation of callback time

Template variables:
- `{{1}}` → `data.name`
- `{{2}}` → `data.callback_time` (format: `2026-04-20T10:00:00`)
- `{{3}}` → `data.agent_name`

---

### Path: `class.schedule_shared` ⭐ NEW
**Goal:** WhatsApp message to parent with full batch + center details

Fields available in `data`:
```
data.lead_name         — parent name
data.lead_phone        — parent phone (for WhatsApp)
data.lead_email        — parent email
data.center_name       — e.g. "Velachery"
data.center_address    — e.g. "45 Anna Salai, Velachery, Chennai 600042"
data.center_map_url    — Google Maps link
data.batch_label       — e.g. "Batch 2 — May 5–16"
data.start_date        — e.g. "2026-05-05"
data.end_date          — e.g. "2026-05-16"
data.time_slot         — e.g. "5:30 PM – 6:30 PM"
data.mode              — "offline" | "online"
data.agent_name        — sales agent who clicked Share Schedule
data.agent_email       — agent email
```

**Suggested WhatsApp template message:**
```
Hi {{1}},

Your child's *Robotics Class* details at *{{2}}*:

🗓 Batch: {{3}}
📅 Dates: {{4}} to {{5}}
⏰ Time: {{6}}
📍 Address: {{7}}

📌 View on Maps: {{8}}

For any questions, contact {{9}}.
See you there! 🤖
```

Map:
- `{{1}}` → `data.lead_name`
- `{{2}}` → `data.center_name`
- `{{3}}` → `data.batch_label`
- `{{4}}` → `data.start_date`
- `{{5}}` → `data.end_date`
- `{{6}}` → `data.time_slot`
- `{{7}}` → `data.center_address`
- `{{8}}` → `data.center_map_url`
- `{{9}}` → `data.agent_name`

---

### Path: `followup.scheduled`
**Goal:** Notify agent via WhatsApp about a pending follow-up

Fields:
- `data.agent_name`, `data.followup_due`, `data.followup_note`, `data.name` (lead)

---

### Path: `call.analyzed`
**Goal:** (Optional) Update Google Sheet with call summary + intent

Fields: all `data.*` fields including `summary`, `intent_category`, `action_items`

---

## Step 6 — Save and Activate

- Click **Save** on the workflow
- Toggle the workflow to **ON**
- The workflow is now live and will handle every event from the backend

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `PABBLY_WEBHOOK_URL` stays 404 | Old workflow was deleted | Create new workflow, update URL |
| Backend logs `Pabbly webhook ... failed after 3 attempts` | Webhook URL wrong or workflow off | Check URL + toggle workflow ON |
| Events arrive in Pabbly but path doesn't trigger | Path Router condition wrong | Check filter field: `event` (not `data.event`) |
| `class.schedule_shared` never fires | Lead has no enrollment assigned | Assign center + batch first in Lead Detail |

---

## Webhook Payload Format (for reference)

All events follow the same envelope:

```json
{
  "event": "class.schedule_shared",
  "timestamp": "2026-04-14T10:23:44.123+00:00",
  "data": { ... event-specific fields ... }
}
```

The `X-Pabbly-Signature` header contains an HMAC-SHA256 signature using `PABBLY_SECRET_KEY` — Pabbly does not validate this (it is for your own verification if needed).
