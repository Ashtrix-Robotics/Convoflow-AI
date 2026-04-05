# Pabbly Connect — Integration Reference

Quick setup guide for all supported CRM and communication integrations using Convoflow AI webhook events.

---

## Supported Webhook Events

| Event                     | Trigger                           | Best Used For                     |
| ------------------------- | --------------------------------- | --------------------------------- |
| `transcription.completed` | Call fully transcribed + analyzed | CRM update, Slack notification    |
| `followup.scheduled`      | Agent creates a follow-up task    | Calendar event, WhatsApp reminder |

---

## Available Field Variables by Event

### transcription.completed fields

```
{{event}}             → "transcription.completed"
{{timestamp}}         → ISO 8601 datetime
{{call_id}}           → UUID string
{{agent_id}}          → UUID string
{{client_name}}       → "Acme Corp"
{{client_id}}         → UUID string (may be null)
{{summary}}           → Full AI-generated summary
{{action_items}}      → JSON array of strings
{{action_items[0]}}   → First action item
{{sentiment}}         → "positive" | "neutral" | "negative"
{{next_step}}         → Single most important action
{{key_topics}}        → JSON array of keywords
{{duration_seconds}}  → Integer
```

### followup.scheduled fields

```
{{event}}             → "followup.scheduled"
{{timestamp}}         → ISO 8601 datetime
{{followup_id}}       → UUID string
{{call_id}}           → UUID string
{{agent_id}}          → UUID string
{{client_name}}       → Client name string
{{client_id}}         → UUID string (may be null)
{{due_date}}          → "YYYY-MM-DDTHH:MM:SS"
{{notes}}             → Free-text reminder notes
```

---

## Integration Setup Matrix

### HubSpot CRM

- **Trigger event**: `transcription.completed`
- **Action**: Create or Update Contact → Create Note
- **Map**: `{{client_name}}` → Contact Name, `{{summary}}` → Note Body, `{{next_step}}` → Task Title

### Salesforce

- **Trigger event**: `transcription.completed`
- **Action**: Create Activity → Update Opportunity
- **Map**: `{{summary}}` → Activity Description, `{{sentiment}}` → Custom Field

### Google Sheets

- **Trigger event**: Either event
- **Action**: Add Row
- **Map**: All fields to columns; use `{{timestamp}}` for sorting

### Gmail

- **Trigger event**: `transcription.completed`
- **Action**: Send Email (to agent)
- **Subject template**: `Call Summary: {{client_name}} — {{sentiment}}`
- **Body**: Include `{{summary}}`, `{{action_items}}`, `{{next_step}}`

### WhatsApp (via Twilio or WATI)

- **Trigger event**: `followup.scheduled`
- **Action**: Send WhatsApp Message
- **Message template**: `Reminder: Follow up with {{client_name}} on {{due_date}}. Note: {{notes}}`

### Slack

- **Trigger event**: `transcription.completed`
- **Action**: Send Channel Message
- **Channel**: `#sales-summaries`
- **Message**: `*New Call Summary*\nClient: {{client_name}}\nSentiment: {{sentiment}}\nNext step: {{next_step}}`

### Calendly / Calendar

- **Trigger event**: `followup.scheduled`
- **Action**: Create Calendar Event
- **Map**: `{{due_date}}` → Start Time, `{{notes}}` → Description, `{{client_name}}` → Event Title

### ActiveCampaign

- **Trigger event**: `transcription.completed`
- **Action**: Add Tag to Contact, Update Deal Stage
- **Map tag**: `{{sentiment}}` → tag name (e.g., "positive-lead")

### Airtable

- **Trigger event**: Either event
- **Action**: Create Record in CRM base
- **Map**: All fields to table columns; `{{call_id}}` as record ID for deduplication

---

## Webhook Signature Verification

All requests include header:

```
X-Pabbly-Signature: sha256=<hmac_hex>
```

Verification (Python):

```python
import hmac, hashlib

def verify_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

> Always use `hmac.compare_digest` — never `==` — to prevent timing attacks.

---

## Rate Limits and Retry

| Platform | Rate Limit     | Pabbly Retry |
| -------- | -------------- | ------------ |
| HubSpot  | 100/10s        | 3 attempts   |
| Slack    | 1/s per method | 3 attempts   |
| Gmail    | 100/day        | 3 attempts   |
| WhatsApp | Varies by tier | 3 attempts   |

Backend retry in `pabbly.py`: 3 attempts with 2s → 4s → 8s exponential backoff.
