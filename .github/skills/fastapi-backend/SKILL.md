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
