# Convoflow AI — GitHub Copilot Instructions

## Project Overview

**Convoflow AI** is a platform for sales teams to record, transcribe, and automate follow-ups from sales calls.

- **Mobile app** (React Native + Expo): sales agents record calls on their phone
- **Backend API** (FastAPI + Python): transcribes audio using OpenAI Whisper, extracts action items with GPT-4
- **Web dashboard** (React + Vite): managers view call summaries, transcripts, and follow-up status
- **Automation** (Pabbly Connect): webhooks trigger CRM updates, emails, WhatsApp reminders

---

## Automation & Pabbly Connect

- Pabbly Connect acts as the primary automation engine.
- **CRITICAL RESTRICTION**: You are strictly prohibited from modifying, deleting, or altering any existing Pabbly Connect workflows, tasks, or automation steps.
- Use the Pabbly Connect MCP server (configured in `.vscode/mcp.json`) strictly for monitoring and reading workflow statuses.
- Webhooks are triggered from the backend using signed HMAC-SHA256 payloads.

---

## Tech Stack Quick Reference

| Layer      | Tech                                                        |
| ---------- | ----------------------------------------------------------- |
| Mobile     | React Native, Expo SDK 53, Expo Router v4, expo-av          |
| Backend    | FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT                 |
| AI         | OpenAI gpt-4o-mini-transcribe + gpt-4o-mini                 |
| Automation | Pabbly Connect webhooks                                     |
| Web        | React 18, Vite 6, TanStack Query v5, Recharts, Tailwind CSS |
| Auth       | JWT (HS256), bcrypt, OAuth2 password flow                   |

---

## Available Skills — When to Use Each

### Project-Specific Skills

| Skill                  | Use When...                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `mobile-recording`     | Working on expo-av recording, audio upload, permissions in mobile/app/           |
| `react-native-expo-ui` | Building mobile screens, navigation, Zustand store, Expo Router layouts          |
| `transcription-ai`     | Working on backend/app/services/transcription.py or any AI transcription feature |
| `pabbly-automation`    | Working on backend/app/services/pabbly.py or Pabbly Connect webhook flows        |
| `fastapi-backend`      | Working on any file in backend/app/ — models, routes, auth, schemas              |
| `web-dashboard`        | Working on any file in web/src/ — pages, components, API calls                   |

### Document & File Skills

| Skill              | Use When...                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `brand-guidelines` | Applying visual design, colors, typography to UI components               |
| `xlsx`             | Generating Excel reports from call data                                   |
| `pdf`              | Exporting call summaries or reports as PDFs                               |
| `pptx`             | Creating PowerPoint presentations from call analytics                     |
| `docx`             | Creating or editing Word documents (.docx), reports, memos, letters       |
| `doc-coauthoring`  | Structured co-authoring workflow for docs, proposals, and technical specs |

### Design & Creative Skills

| Skill                   | Use When...                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `ui-ux-pro-max`         | Comprehensive UI/UX design — 50+ styles, 161 palettes, 57 font pairings |
| `frontend-design`       | Building distinctive, production-grade web UI and components            |
| `canvas-design`         | Creating visual art, posters, or static designs as PNG/PDF              |
| `algorithmic-art`       | Creating generative/algorithmic artwork with code                       |
| `theme-factory`         | Creating and applying design themes across surfaces                     |
| `web-artifacts-builder` | Building bundled/standalone web artifacts and components                |

### Web & React Skills

| Skill                           | Use When...                                                          |
| ------------------------------- | -------------------------------------------------------------------- |
| `vercel-react-best-practices`   | Reviewing/optimizing React or Next.js performance patterns           |
| `vercel-composition-patterns`   | Refactoring boolean props, compound components, composition patterns |
| `vercel-react-view-transitions` | Adding page/route animations and view transitions in React           |
| `vercel-react-native-skills`    | Applying React Native-specific performance and UI patterns           |
| `web-design-guidelines`         | Auditing UI code for accessibility and UX best practices             |
| `vercel-deploy-to-vercel`       | Deploying projects to Vercel (CI/CD, environment, domains)           |
| `vercel-cli-with-tokens`        | Using Vercel CLI with auth tokens in scripts or CI                   |

### Integration & Tooling Skills

| Skill            | Use When...                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `mcp-builder`    | Building MCP servers to integrate external services                      |
| `claude-api`     | Integrating the Claude API in Python, JavaScript, C#, or PHP             |
| `webapp-testing` | Testing local web apps with Playwright — browser automation, screenshots |
| `skill-creator`  | Creating, modifying, benchmarking, or improving skills                   |

### Communication Skills

| Skill               | Use When...                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `internal-comms`    | Writing internal memos, announcements, or team communication documents |
| `slack-gif-creator` | Creating animated GIFs for Slack messages or team communications       |

---

## Local Development & Setup

### Run Commands

| Component | Command | Notes |
| :--- | :--- | :--- |
| **Backend** | `./start-backend.ps1` | Runs FastAPI on :8000. Uses `.venv` with `requirements.txt`. |
| **Web** | `./start-web.ps1` | Runs Vite on :5173. Nuance: Proxies `/api` to :8000. |
| **Mobile** | `./start-mobile.ps1` | Runs Expo. Uses `--legacy-peer-deps` during install. |
| **Pabbly** | `scripts/setup-pabbly-workflows.ps1` | Automates local webhook setup. |

### Database Management
- Uses **SQLAlchemy 2.0** + **Alembic**.
- Migration command: `alembic upgrade head` in [backend/](backend/).
- Default DB: SQLite `convoflow.db` in [backend/](backend/).

---

## Code Conventions

### Backend (Python / FastAPI)

- Use `async def` for all route handlers and service functions (OpenAI calls are async)
- Always use `Depends(get_current_agent)` for protected routes — never check auth inline
- CallRecord statuses are EXACTLY: `pending`, `transcribing`, `completed`, `failed`
- All IDs are UUIDs stored as strings in SQLite
- `BackgroundTasks` for transcription — routes must return `202 Accepted` immediately
- Never raise unhandled exceptions inside background tasks — catch and set `status = "failed"`

### Mobile (TypeScript / React Native)

- Always use `expo-secure-store` for JWT storage — NEVER `AsyncStorage`
- API base URL from `process.env.EXPO_PUBLIC_API_URL`
- Audio format: `.m4a` using `Audio.RecordingOptionsPresets.HIGH_QUALITY`
- Poll `GET /calls/{id}` every 3 seconds using TanStack Query `refetchInterval`
- Set `staysActiveInBackground: true` in audio mode for reliable recording

### Web (TypeScript / React)

- All API calls go through `/api/*` (Vite proxies to FastAPI on port 8000)
- Store JWT in `localStorage.getItem("access_token")` (web only — mobile uses SecureStore)
- Protect all routes with the `ProtectedRoute` component pattern
- Use `refetchInterval` on call queries that may still be transcribing
- **Nuance:** `EXPO_PUBLIC_API_URL` for mobile MUST be the **Local IP** when using physical devices.

---

## Key Environment Variables

```env
# Backend .env
OPENAI_API_KEY=sk-...
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/workflow/...
PABBLY_WEBHOOK_SECRET=...
SECRET_KEY=...           # min 32 chars — use secrets.token_hex(32)
DATABASE_URL=sqlite:///./convoflow.db
UPLOAD_DIR=./uploads

# Mobile .env (Expo reads EXPO_PUBLIC_*)
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

---

## API Endpoint Summary

| Method   | Path                       | Description                             |
| -------- | -------------------------- | --------------------------------------- |
| POST     | `/auth/register`           | Register new agent                      |
| POST     | `/auth/login`              | Get JWT token (OAuth2 form)             |
| POST     | `/calls/upload`            | Upload audio file → start transcription |
| GET      | `/calls`                   | List agent's calls                      |
| GET      | `/calls/{id}`              | Get call status + results               |
| GET/POST | `/clients`                 | Client CRUD                             |
| POST     | `/followups`               | Create follow-up → fires Pabbly webhook |
| GET      | `/followups`               | List follow-ups                         |
| PATCH    | `/followups/{id}/complete` | Mark follow-up as done                  |

---

## Pabbly Webhook Events

Two events are fired automatically:

- `transcription.completed` — after OpenAI Whisper finishes
- `followup.scheduled` — after agent creates a follow-up

The Pabbly service (`backend/app/services/pabbly.py`) signs all payloads with HMAC-SHA256 using `PABBLY_WEBHOOK_SECRET`.

---

## Security Guidelines

1. Validate audio MIME types before saving to disk (only allow audio/\* types)
2. Use `hmac.compare_digest` for all webhook signature comparisons
3. Rate-limit `/auth/login` in production (add `slowapi` middleware)
4. The `SECRET_KEY` must be randomly generated — never a guessable string
5. In production, set `allow_origins` to specific domains, not `["*"]`

---

## Lessons Learned & Corrections (Updated During Development)

### Database
- **Production DB is PostgreSQL (Supabase), NOT SQLite.** `psycopg2` is the adapter. SQLite is only used for local dev when `DATABASE_URL` is not set. Never assume SQLite-specific behavior (e.g. `check_same_thread`) in production code paths.
- **PostgreSQL enforces constraints at `flush()` time inside a transaction**, not just at `commit()`. Adding multiple ORM objects with the same unique-constrained field value to a SQLAlchemy session (without flushing between each) will fail on `commit()` with `IntegrityError / UniqueViolation`.
- **Always flush or track in-memory** when doing bulk inserts where duplicates may appear in the same batch — do not rely on `db.query()` to find rows you just `db.add()`-ed but haven't committed yet.

### Background Tasks (FastAPI / Starlette)
- **Starlette `BackgroundTasks` for long-running sync functions can behave unpredictably** in some deployment environments. For operations that take >5s (like Google Sheets pulls), use `threading.Thread(target=fn, daemon=True)` directly instead of `bg.add_task()`.
- **Daemon threads are required** when background work could outlast the request cycle. Non-daemon threads prevent Python from exiting cleanly during Render deploys (SIGTERM is ignored until all threads finish), blocking the deployment pipeline.

### Google Sheets / External HTTP
- **Always set explicit timeouts on ALL HTTP calls**, including OAuth token refresh. `google.auth.transport.requests.Request()` uses a plain `requests.Session` with no default timeout — it will hang forever on Render's free tier if network connectivity is degraded.
- **gspread's `get_all_records()` / `get_all_values()` can hang indefinitely** on Render's Singapore region. Use the direct Google Sheets REST API v4 (`requests.get(url, timeout=60)`) instead of gspread for read operations.

### Duplicate Data / Business Logic
- **"Duplicate phone" doesn't always mean "duplicate person."** A parent enrolling two children may use the same phone for both rows. Never silently discard a row just because the phone already exists. Instead:
  - If the phone is already in the DB → update the existing lead's fields.
  - If the phone appeared earlier in the same import batch → merge non-empty fields into the same lead object.
  - Always report exact counts: `created`, `updated`, `merged`, `skipped` + reasons for skips.
- **Never silently drop data** — every skipped row must be accounted for in the API response/logs with a reason (missing name, missing phone, unparseable phone, etc.).

### Frontend / UX
- **Render free tier has 15-min inactivity spin-down.** Cold starts take 30–60s. The frontend must detect 502/503/network errors on GET requests, show a "Server is starting up…" banner, and auto-retry — never just show a blank error screen.
- **Only auto-retry safe (GET/HEAD) requests** during cold-start. Never auto-retry POST/PATCH/DELETE (mutations may have already executed server-side).
- **After any bulk operation (purge, pull, push)**, invalidate ALL related TanStack Query keys that could be stale — not just the most obvious one. E.g. purge invalidates `["leads"]`, `["calls"]`, AND `["analytics"]`.

### Render Deployment
- **Render deploy hook URL**: `https://api.render.com/deploy/srv-d79547450q8c73fc78p0?key=XmaLT81Svl4`
- **Version field in `/health`** is the canonical way to confirm which code is deployed.
- When deploys are stuck (process won't exit), it's almost always due to non-daemon threads holding open HTTP connections. Fix: use `daemon=True` on all background threads.
