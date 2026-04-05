# Pabbly Connect — Workflow Setup

## Step 1: Create a New Workflow

1. Login at [connect.pabbly.com](https://connect.pabbly.com)
2. Click **Create Workflow** → name it clearly, e.g. `Convoflow AI – Transcription Completed`
3. Set **Trigger App** → **Webhook by Pabbly**
4. Select **Trigger Event** → **Catch Webhook**
5. Copy the generated Webhook URL → add to your `.env` as `PABBLY_WEBHOOK_URL`
6. Click **Save & Send Test Request** — paste a sample payload from [examples/](examples/) to validate

> **Tip**: Create separate workflows per event type (`transcription.completed` and
> `followup.scheduled`) — easier to maintain and debug.

---

## Step 2: Configure Action Steps

### For `transcription.completed`

Recommended action chain:

| Step | App                      | What it does                                   |
| ---- | ------------------------ | ---------------------------------------------- |
| 1    | **Filter by Pabbly**     | Only proceed if `sentiment != "negative"`      |
| 2    | **Gmail / Outlook**      | Email agent with call summary and action items |
| 3    | **HubSpot / Salesforce** | Update contact activity log                    |
| 4    | **WhatsApp (Twilio)**    | Send WhatsApp reminder to agent                |

> Filter steps are **free** (don't consume tasks) — use them to prevent sending
> unnecessary notifications.

### For `followup.scheduled`

| Step | App                 | What it does                                 |
| ---- | ------------------- | -------------------------------------------- |
| 1    | **Google Calendar** | Create event with `due_date` and client name |
| 2    | **Slack**           | Post message to `#sales-followups` channel   |

---

## Step 3: Map Webhook Fields

In each Action step, use Pabbly's **field mapper** (the `{{}}` variable picker) to reference
payload values. Available variables from Convoflow AI webhooks:

| Variable           | Value                                           |
| ------------------ | ----------------------------------------------- |
| `{{call_id}}`      | UUID of the call record                         |
| `{{agent_id}}`     | UUID of the agent                               |
| `{{client_name}}`  | Client company/person name                      |
| `{{summary}}`      | AI-generated call summary                       |
| `{{action_items}}` | Array of follow-up tasks                        |
| `{{sentiment}}`    | `positive` / `neutral` / `negative`             |
| `{{next_step}}`    | Primary action item                             |
| `{{timestamp}}`    | ISO 8601 datetime of the event                  |
| `{{followup_id}}`  | UUID of the follow-up (followup.scheduled only) |
| `{{due_date}}`     | ISO 8601 due date (followup.scheduled only)     |
| `{{notes}}`        | Agent notes (followup.scheduled only)           |

---

## Step 4: Test Your Workflow

1. In Pabbly, click **Capture Webhook Response** on the trigger step
2. From FastAPI Swagger UI (`/docs`), upload a test audio file to trigger a real webhook
3. Verify the payload appears in Pabbly's capture window
4. Step through each action to confirm field mapping is correct
5. Click **Save** when the full workflow is working

---

## Common Integration Examples

### Gmail — Send Summary Email

- **To**: `{{agent_email}}` (add this to your payload if needed, or use a fixed address)
- **Subject**: `Call recap: {{client_name}} – {{timestamp}}`
- **Body**:

  ```
  Summary: {{summary}}

  Action items:
  {{action_items}}

  Next step: {{next_step}}
  ```

### HubSpot — Log Activity

- **Action**: Create Engagement / Note
- **Contact**: Look up by `{{client_name}}` or pass `client_email` in the payload
- **Note body**: `{{summary}}`

### Slack — Post to Channel

- **Channel**: `#sales-followups`
- **Message**: `New follow-up for {{client_name}} — due {{due_date}}. Notes: {{notes}}`

### Google Calendar — Create Event

- **Title**: `Follow up: {{client_name}}`
- **Start time**: `{{due_date}}`
- **Description**: `{{notes}}`
