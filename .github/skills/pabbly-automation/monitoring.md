# Workflow Monitoring & Debugging

## Task History Dashboard

All workflow executions are logged in Pabbly's **Task History** — your primary debugging tool.

1. Open your workflow at [connect.pabbly.com](https://connect.pabbly.com)
2. Click the **History** tab (top of the workflow editor)
3. Each row shows: timestamp, trigger event, execution status, and step-by-step breakdown
4. Click any row to expand and see the exact payload at each step

**What to look for:**

- A green row = all steps succeeded
- A red row = one or more steps failed — click to see which step and the error message
- A grey row = workflow was skipped by a Filter condition (that's expected, not an error)

---

## Re-executing Failed Workflows

If a downstream service was temporarily unavailable (e.g., HubSpot API timeout):

1. In Task History, find the failed execution row
2. Click **Re-execute** — Pabbly re-runs the entire workflow with the original payload
3. No need to re-trigger from FastAPI — the event data is preserved

This is far faster than debugging by uploading another audio file.

---

## Error Notifications

Set up automatic alerts so you don't have to manually watch Task History:

1. Open the workflow → click the **Settings** (gear) icon
2. Enable **Error Notifications**
3. Enter the email to notify on failure
4. Optionally set a threshold (e.g., only notify after 2 consecutive failures)

---

## Debugging Checklist

When a webhook fires from FastAPI but the Pabbly action doesn't run:

1. **Check Task History** — did the workflow receive the payload at all?
   - If no entry appears → the POST request from FastAPI failed; check backend logs
   - If entry appears with error → read the step-level error message in the expanded row

2. **Verify the Webhook URL** — confirm `PABBLY_WEBHOOK_URL` in `.env` matches the URL shown in the Trigger step

3. **Check Filter conditions** — if you have a Filter step, it may be blocking all executions;
   temporarily disable it to confirm data is flowing

4. **Re-send a test payload** — use `POST /calls/upload` from Swagger UI with a short audio
   file to generate a fresh `transcription.completed` event end-to-end

5. **Check field mapping** — in Task History, compare the payload fields to what your action
   step expects; a misspelled `{{field_name}}` silently sends an empty string

---

## Developer API

Pabbly exposes a REST API for programmatic workflow management: **https://apidocs.pabbly.com/**

Useful for:

- Listing workflows and their status programmatically
- Checking monthly task usage via API (to alert before hitting plan limits)
- Integrating Pabbly workflow health checks into your CI/CD pipeline
- Triggering workflows from server-side code without the UI

Authentication: API key from your Pabbly account settings.
