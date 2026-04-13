---
name: fastapi-backend
description: "Use this skill for all FastAPI backend development in the Convoflow AI project. Covers project-specific route patterns, PyJWT OAuth2 authentication, file upload handling, SQLAlchemy 2.0 models and queries, Pydantic v2 schemas, BackgroundTasks for transcription, lifespan startup, CORS setup, and deployment via Docker. Trigger when working on any file in backend/app/ or when designing new API endpoints."
---

# FastAPI Backend Skill — Convoflow AI

## Quick Reference

| Task                                                     | Guide                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| App factory, lifespan, CORS, Pydantic Settings           | [app-entry.md](app-entry.md)                               |
| JWT auth, password hashing, deps.py, login route         | [auth-jwt.md](auth-jwt.md)                                 |
| SQLAlchemy engine, session, ORM models, Pydantic schemas | [database.md](database.md)                                 |
| Audio upload route, BackgroundTasks, follow-up routes    | [routes.md](routes.md)                                     |
| Full endpoint reference (paths, methods, params)         | [references/api-endpoints.md](references/api-endpoints.md) |
| DB model quick-reference (all fields + types)            | [references/db-models.md](references/db-models.md)         |

---

## When to Use This Skill

Trigger whenever working on **any file in `backend/app/`** — routes, models, auth, services, config, middleware.

Also trigger when:

- Designing or reviewing new API endpoints
- Adding authentication/authorization to routes
- Changing database schema (adding columns, new models)
- Debugging 4xx / 5xx responses from the API
- Setting up the backend from scratch

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app factory, lifespan, CORS, router wiring
│   ├── core/
│   │   ├── config.py        # Pydantic Settings v2 (reads .env)
│   │   ├── database.py      # SQLAlchemy engine, SessionLocal, Base, get_db
│   │   └── security.py      # PyJWT encode/decode, bcrypt hashing
│   ├── models/
│   │   └── models.py        # Agent, Client, CallRecord, FollowUp (SA 2.0 Mapped)
│   ├── schemas/
│   │   └── schemas.py       # Pydantic v2 request/response models
│   ├── api/
│   │   ├── deps.py          # get_current_agent, AgentDep, DBDep
│   │   ├── auth.py          # POST /auth/register, POST /auth/login
│   │   ├── calls.py         # POST /calls/upload, GET /calls, GET /calls/{id}
│   │   ├── clients.py       # /clients CRUD
│   │   └── followups.py     # /followups CRUD + Pabbly trigger
│   └── services/
│       ├── transcription.py # OpenAI Whisper + GPT-4 insight extraction
│       └── pabbly.py        # Outbound webhook sender
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Key Conventions

Follow these rules across all backend files. They are load-bearing — the mobile app and web dashboard depend on them.

- **All route handlers**: `async def` (OpenAI calls are async)
- **Protected routes**: always use `AgentDep` — never check auth inline
- **CallRecord statuses**: exactly `pending` → `transcribing` → `completed` | `failed` — no other values
- **All IDs**: UUID strings (not integers)
- **Audio upload**: always return `202 Accepted` + queue background task; never block the request
- **Background tasks**: always catch all exceptions; set `status = "failed"` on error; never re-raise
- **JWT library**: `PyJWT` (`import jwt`) — not `python-jose`
- **Datetime**: `datetime.now(timezone.utc)` everywhere — never `datetime.utcnow()` (deprecated Python 3.12)
- **Response schemas**: use `response_model=` on the decorator, not the return type annotation, when returning ORM objects

---

## Running the Backend

```bash
# Development
cd backend
uvicorn app.main:app --reload --port 8000

# Production (Docker)
docker build -t convoflow-backend .
docker run -p 8000:8000 --env-file .env convoflow-backend
```

Swagger UI: `http://localhost:8000/docs`

---

## HTTP Status Codes Used

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 200  | Success (GET, PUT, PATCH)                        |
| 201  | Created (POST for new resources)                 |
| 202  | Accepted (audio upload — async processing)       |
| 204  | No Content (DELETE)                              |
| 401  | Unauthorized (missing or invalid JWT)            |
| 403  | Forbidden (agent accessing another agent's data) |
| 409  | Conflict (duplicate email on register)           |
| 413  | Payload Too Large (audio file over limit)        |
| 422  | Unprocessable Entity (validation error)          |

---

## Security Checklist

Before deploying to production, verify all of the following:

1. `SECRET_KEY` is at least 32 random chars — generate with `secrets.token_hex(32)`
2. `allow_origins` restricted to specific domains — never `["*"]` with `allow_credentials=True`
3. `TrustedHostMiddleware` added with your API domain (see [app-entry.md](app-entry.md))
4. Audio MIME type validated before saving to disk
5. `AgentDep` on every protected route — no inline auth checks anywhere
6. JWT tokens never logged
7. All webhook signature comparisons use `hmac.compare_digest`, never `==`

---

## Performance Patterns

### SQL Aggregation — GROUP BY instead of query loops

**Never** query a loop of individual counts. Use a single SQL query with `GROUP BY` + conditional `SUM(CASE WHEN ...)`:

```python
# ❌ BAD — 120+ queries for a dashboard analytics endpoint
result = {}
for status in ["new", "contacted", "qualified", "lost"]:
    result[status] = db.query(Lead).filter(Lead.status == status).count()

# ✅ GOOD — single query, all aggregates at once
from sqlalchemy import func, case

rows = (
    db.query(
        Lead.status,
        func.count(Lead.id).label("count"),
        func.sum(case((Lead.intent_category == "high", 1), else_=0)).label("high_intent"),
    )
    .filter(Lead.agent_id == agent_id)
    .group_by(Lead.status)
    .all()
)
```

This pattern collapses 120–150 queries into ≤8. Applied to the analytics endpoint, warm response time dropped from ~8s to ~1.3s.

### Bulk Operations — batch `.in_()` instead of per-ID queries

```python
# ❌ BAD — N queries for N affected rows
for lead_id in payload.lead_ids:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    lead.status = payload.status

# ✅ GOOD — one batch fetch, then update in-memory
leads = db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).all()
lead_map = {str(l.id): l for l in leads}
for lead_id in payload.lead_ids:
    if lead_id in lead_map:
        lead_map[lead_id].status = payload.status
db.commit()
```

### GZipMiddleware — placement matters

Add `GZipMiddleware` **before** CORS middleware and **before** router registration:

```python
# main.py
from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # ← add first
app.add_middleware(CORSMiddleware, ...)                # ← then CORS
```

Verify it's working: check `Content-Encoding: gzip` in the response headers on any JSON endpoint returning >1KB.

### DB Connection Pool — Supabase free tier settings

```python
# core/database.py
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,   # drop stale connections before use
)
```

Supabase free tier supports ~25 direct connections. `pool_size=10, max_overflow=20` gives a safe headroom with 5 buffer connections.

---

## Alembic Migration Chain Management

### Finding the Current HEAD before creating a migration

Before running `alembic revision`, verify the current chain tip:

```bash
# Option 1: use alembic CLI
alembic heads

# Option 2: grep all down_revision values and find the revision
#            that NO other migration points to as its down_revision
grep -r "down_revision" backend/alembic/versions/
```

The revision that appears in `revision = "..."` but **never** in `down_revision = "..."` anywhere else is the current HEAD.

### Multiple heads error — how it happens and how to fix it

**Cause**: A new migration file is created with `down_revision` pointing to an old ancestor instead of the actual chain tip. This creates two parallel chains, both claiming to be HEAD.

```
ERROR [alembic.util.exc] Multiple head revisions are present for given argument 'head'
```

**Fix**:

1. Find the actual current HEAD: `alembic heads`
2. Edit the new migration's `down_revision` to point to the correct HEAD revision
3. Run `alembic upgrade head` to validate the chain is now linear

**Prevention rule**: Never hardcode a `down_revision` from memory. Always grep or CLI-check first.

### Deployment verification shortcut

On Render, the start command is `alembic upgrade head && uvicorn app.main:app ...`. If the API is alive and responding, **both** the migration and the server start succeeded. No separate migration check needed.

```bash
# Confirm migration succeeded + API is alive
curl https://your-api.onrender.com/health
# → {"status": "ok", "version": "1.2.3"}
```
