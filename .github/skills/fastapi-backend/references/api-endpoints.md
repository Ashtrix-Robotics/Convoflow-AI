# Convoflow AI — API Endpoint Reference

Complete request/response reference for all backend endpoints.

---

## Authentication

### POST /auth/register

Register a new sales agent.

**Request** (JSON):

```json
{
  "email": "agent@company.com",
  "password": "SecurePass123!",
  "full_name": "Jane Smith"
}
```

**Response** 201:

```json
{
  "id": "uuid",
  "email": "agent@company.com",
  "full_name": "Jane Smith",
  "created_at": "2025-01-01T10:00:00Z"
}
```

---

### POST /auth/login

Obtain JWT token. Uses OAuth2 form encoding (not JSON).

**Request** (`application/x-www-form-urlencoded`):

```
username=agent@company.com&password=SecurePass123!
```

**Response** 200:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

## Calls

### POST /calls/upload

Upload audio file for transcription. Returns 202 immediately — transcription runs async.

**Request** (`multipart/form-data`):

- `audio` (file, required) — audio file
- `client_id` (string, optional) — existing client UUID
- `duration_seconds` (int, optional) — recording duration

**Response** 202:

```json
{
  "id": "uuid",
  "status": "pending",
  "audio_filename": "uuid.m4a",
  "created_at": "2025-01-01T10:00:00Z",
  "agent_id": "agent-uuid",
  "client_id": null
}
```

**Errors:**

- `422` — Unsupported audio format (allowed: mp3, mp4, mpeg, m4a, wav, webm)
- `413` — File too large (default limit: 100MB)

---

### GET /calls

List all calls for the authenticated agent.

**Headers:** `Authorization: Bearer <token>`

**Response** 200:

```json
[
  {
    "id": "uuid",
    "status": "completed",
    "summary": "Agent discussed Q2 pricing...",
    "action_items": ["Send pricing PDF", "Schedule demo"],
    "sentiment": "positive",
    "next_step": "Send updated pricing PDF",
    "created_at": "2025-01-01T10:00:00Z",
    "client_id": "client-uuid"
  }
]
```

Status values: `pending` | `transcribing` | `completed` | `failed`

---

### GET /calls/{id}

Get a single call record. Poll this endpoint every 3s until `status === "completed"`.

**Response** 200:

```json
{
  "id": "uuid",
  "status": "completed",
  "raw_transcript": "Agent: Hello, this is Jane from...\nClient: Hi, yes...",
  "summary": "Executive summary of the call",
  "action_items": ["Action 1", "Action 2"],
  "sentiment": "positive",
  "next_step": "Most important next action",
  "audio_filename": "uuid.m4a",
  "created_at": "2025-01-01T10:00:00Z",
  "agent_id": "agent-uuid",
  "client_id": "client-uuid"
}
```

**Errors:** `404` — Call not found or belongs to a different agent

---

## Clients

### GET /clients

List all clients for the authenticated agent.

**Response** 200:

```json
[
  {
    "id": "uuid",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "phone": "+1-555-1234",
    "company": "Acme Corporation",
    "created_at": "2025-01-01T10:00:00Z"
  }
]
```

---

### POST /clients

Create a new client.

**Request** (JSON):

```json
{
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "phone": "+1-555-1234",
  "company": "Acme Corporation"
}
```

**Response** 201: Client object

---

## Follow-Ups

### POST /followups

Create a follow-up task. Fires `followup.scheduled` Pabbly event automatically.

**Request** (JSON):

```json
{
  "call_id": "call-uuid",
  "due_date": "2025-01-10T09:00:00",
  "notes": "Call back to confirm receipt of pricing PDF"
}
```

**Response** 201:

```json
{
  "id": "uuid",
  "call_id": "call-uuid",
  "due_date": "2025-01-10T09:00:00",
  "notes": "Call back to confirm receipt of pricing PDF",
  "completed": false,
  "created_at": "2025-01-01T10:00:00Z"
}
```

---

### GET /followups

List all follow-ups for the authenticated agent.

**Query params:** `?completed=false` (filter by completion status)

---

### PATCH /followups/{id}/complete

Mark a follow-up as completed.

**Response** 200: Updated follow-up object with `completed: true`

---

## HTTP Status Code Reference

| Code | Meaning               | When Used                              |
| ---- | --------------------- | -------------------------------------- |
| 200  | OK                    | Successful GET, PATCH                  |
| 201  | Created               | Successful POST (new resource)         |
| 202  | Accepted              | Call upload (async processing started) |
| 204  | No Content            | Successful DELETE                      |
| 400  | Bad Request           | Malformed request body                 |
| 401  | Unauthorized          | Missing or invalid JWT                 |
| 403  | Forbidden             | Accessing another agent's resource     |
| 404  | Not Found             | Resource doesn't exist                 |
| 413  | Payload Too Large     | Audio file exceeds size limit          |
| 422  | Unprocessable Entity  | Validation error (wrong format/type)   |
| 500  | Internal Server Error | Unexpected server error                |

---

## Authentication Header

All endpoints except `/auth/register` and `/auth/login` require:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
