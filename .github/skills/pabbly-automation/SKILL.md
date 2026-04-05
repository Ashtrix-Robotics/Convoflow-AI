---
name: pabbly-automation
description: "Use this skill for all Pabbly Connect webhook automation in the Convoflow AI project. Covers outbound webhook triggers (transcription.completed, followup.scheduled), HMAC-SHA256 payload signing, Pabbly Connect workflow setup (2,000+ integrations), CRM/email/WhatsApp integrations, Path Routers, Code by Pabbly, retry patterns, and workflow monitoring. Trigger when working on: backend/app/services/pabbly.py, automation workflows, webhook endpoints, or any Pabbly Connect integration."
---

# Pabbly Connect Automation — Convoflow AI

## Quick Reference

| Task                                                             | Guide                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `pabbly.py` implementation, signing, retry, inbound verification | [sending-webhooks.md](sending-webhooks.md)               |
| Pabbly UI workflow setup, action steps, field mapping            | [workflow-setup.md](workflow-setup.md)                   |
| Path Router, Code by Pabbly, Iterator, Delay, AI Assistant       | [advanced-features.md](advanced-features.md)             |
| Task History, debugging, re-execute, Developer API               | [monitoring.md](monitoring.md)                           |
| Integration recipes (HubSpot, Gmail, Slack, etc.)                | [references/integrations.md](references/integrations.md) |
| Payload schemas (JSON)                                           | [examples/](examples/)                                   |

---

## Architecture

Convoflow AI fires **outbound webhooks** to Pabbly Connect. Pabbly acts as the automation
hub routing events to 2,000+ connected apps.

```
FastAPI Backend
     │
     ├─ transcription completed → POST → Pabbly Webhook URL
     │                                        │
     │                                        ├→ Email agent with summary
     │                                        ├→ Update CRM contact
     │                                        └→ WhatsApp follow-up reminder
     │
     └─ followup scheduled    → POST → Pabbly Webhook URL
                                              │
                                              ├→ Google Calendar event
                                              └→ Slack notification
```

This is a **one-way push** from FastAPI → Pabbly. FastAPI does not wait for Pabbly's
response — webhooks are fire-and-forget with retry on failure.

---

## Event Types

| Event                     | Fires when                             | Key payload fields                                                                        |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `transcription.completed` | Background transcription task finishes | `call_id`, `agent_id`, `client_name`, `summary`, `action_items`, `sentiment`, `next_step` |
| `followup.scheduled`      | Agent creates a follow-up for a call   | `followup_id`, `call_id`, `client_name`, `due_date`, `notes`                              |

See [examples/](examples/) for full JSON payload samples.

---

## Task Model & Plans

Understanding Pabbly's task counting keeps you within plan limits:

| Step type                                                       | Counts as a task?        |
| --------------------------------------------------------------- | ------------------------ |
| **Trigger** (Webhook, Schedule, etc.)                           | **Free** — never counted |
| **Internal steps** (Filter, Router, Formatter, Iterator, Delay) | **Free** — never counted |
| **Action steps** (Gmail, HubSpot, Slack, etc.)                  | **Yes** — each execution |

A `transcription.completed` workflow with Email + HubSpot + WhatsApp = **3 tasks per call**.

| Plan      | Monthly tasks |
| --------- | ------------- |
| Standard  | 10,000        |
| Unlimited | Unlimited     |

Security: **SOC2 Type 2** + **ISO 27001:2022** certified.

---

## Environment Variables

```env
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/workflow/sendwebhookdata/XXXXXXX
PABBLY_WEBHOOK_SECRET=your-32-char-random-secret
```

**Never hardcode** these values in source code — they can be rotated in `.env` without
any code changes.

---

## Key Rules

- **Never raise exceptions from `fire_*` functions** — webhook failure must not break the API response or background task; log and swallow
- **Always use `hmac.compare_digest`** for inbound signature verification — never `==`
- **Payload size limit**: 10 MB per webhook POST
- **Canonical JSON for signing**: `sort_keys=True, separators=(",", ":")` — the exact same dict must always produce the same signature
- **Retry on the sender side**: Pabbly does not auto-retry failed inbound webhooks; the retry logic lives in `pabbly.py` (see [sending-webhooks.md](sending-webhooks.md))

Security: **SOC2 Type 2** + **ISO 27001:2022** certified.

---

## Environment Variables

```env
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/workflow/sendwebhookdata/XXXXXXX
PABBLY_WEBHOOK_SECRET=your-32-char-random-secret
```

**Never hardcode** these values in source code — they can be rotated in `.env` without
any code changes.

---

## Key Rules

- **Never raise exceptions from `fire_*` functions** — webhook failure must not break the API response or background task; log and swallow
- **Always use `hmac.compare_digest`** for inbound signature verification — never `==`
- **Payload size limit**: 10 MB per webhook POST
- **Canonical JSON for signing**: `sort_keys=True, separators=(",", ":")` — the exact same dict must always produce the same signature
- **Retry on the sender side**: Pabbly does not auto-retry failed inbound webhooks; the retry logic lives in `pabbly.py` (see [sending-webhooks.md](sending-webhooks.md))
