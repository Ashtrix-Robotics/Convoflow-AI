# Convoflow AI — Conversation Recording & Automation Platform

> **Record → Transcribe → Follow Up → Automate**
> A full-stack mobile + web application for sales teams powered by AI transcription and Pabbly Connect automation.

---

## Overview

Convoflow AI allows sales agents to:

1. **Record** client conversations directly from their phone
2. **Transcribe** conversations using OpenAI Whisper
3. **Review** transcriptions on a web dashboard
4. **Automate** follow-up emails, WhatsApp messages, and CRM updates via **Pabbly Connect**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CONVOFLOW AI PLATFORM                  │
├─────────────────┬───────────────────┬───────────────────┤
│   Mobile App    │   Backend API     │   Web Dashboard   │
│  (React Native  │   (FastAPI +      │   (React/Next.js) │
│   + Expo)       │    Python)        │                   │
│                 │                   │                   │
│  • Audio Record │  • REST API       │  • View Calls     │
│  • Auto Upload  │  • Transcription  │  • Search/Filter  │
│  • View History │  • Pabbly Webhook │  • Analytics      │
│  • Agent Auth   │  • JWT Auth       │  • Follow-up Mgmt │
└────────┬────────┴────────┬──────────┴─────────┬─────────┘
         │                 │                     │
         └────── API ──────┘                     │
                  │                              │
         ┌────────▼────────┐            ┌────────▼────────┐
         │  OpenAI Whisper │            │  Pabbly Connect │
         │  (Transcription)│            │  (Automation)   │
         └─────────────────┘            │  • Email/WA     │
                                        │  • CRM Update   │
                                        │  • Slack Notif  │
                                        └─────────────────┘
```

---

## Project Structure

```
convoflow-ai/
├── .github/
│   ├── skills/                  # Copilot skills
│   │   ├── brand-guidelines/
│   │   ├── doc-coauthoring/
│   │   ├── docx/
│   │   ├── mcp-builder/
│   │   ├── mobile-recording/    # NEW: Mobile audio recording skill
│   │   ├── pdf/
│   │   ├── pptx/
│   │   ├── pabbly-automation/   # NEW: Pabbly integration skill
│   │   ├── transcription-ai/    # NEW: AI transcription skill
│   │   └── xlsx/
│   └── copilot-instructions.md
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/                 # Route handlers
│   │   ├── models/              # DB models (SQLAlchemy)
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   │   ├── transcription.py
│   │   │   └── pabbly.py
│   │   ├── core/                # Config, security, DB
│   │   └── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── mobile/                      # React Native + Expo app
│   ├── app/                     # Expo Router screens
│   │   ├── (auth)/
│   │   ├── (tabs)/
│   │   └── _layout.tsx
│   ├── components/
│   ├── services/
│   │   ├── api.ts
│   │   └── audio.ts
│   ├── package.json
│   └── app.json
├── web/                         # React web dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── architecture.md
│   ├── api-spec.md
│   ├── pabbly-setup.md
│   └── deployment.md
├── venv/                        # Python virtual environment
├── .gitignore
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## Tech Stack

| Layer            | Technology                       | Purpose              |
| ---------------- | -------------------------------- | -------------------- |
| Mobile           | React Native + Expo              | iOS/Android app      |
| Web              | React + Vite + TailwindCSS       | Browser dashboard    |
| Backend          | FastAPI + Python                 | REST API             |
| Database         | SQLite (dev) / PostgreSQL (prod) | Data persistence     |
| Auth             | JWT + OAuth2                     | Agent authentication |
| Transcription    | OpenAI Whisper API               | Audio-to-text        |
| Automation       | Pabbly Connect                   | Follow-up workflows  |
| Storage          | Local (dev) / AWS S3 (prod)      | Audio files          |
| Containerization | Docker + Docker Compose          | Deployment           |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- OpenAI API Key
- Pabbly Connect Account

### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env       # Fill in your keys
uvicorn app.main:app --reload
```

### 2. Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

### 3. Web Dashboard Setup

```bash
cd web
npm install
npm run dev
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required configuration values.

Required:

- `OPENAI_API_KEY` — For Whisper transcription
- `PABBLY_WEBHOOK_URL` — Your Pabbly Connect webhook endpoint
- `SECRET_KEY` — JWT signing secret

---

## Pabbly Connect Integration

Transcription events are sent to Pabbly Connect as webhooks. See [`docs/pabbly-setup.md`](docs/pabbly-setup.md) for full setup instructions.

Supported triggers:

- `transcription.completed` — New call transcribed
- `followup.scheduled` — Follow-up task created
- `agent.activity` — Agent performance event

---

## Skills

This project is configured for GitHub Copilot with specialized skills:

- **`mobile-recording`** — React Native audio recording guidance
- **`transcription-ai`** — AI transcription API patterns
- **`pabbly-automation`** — Pabbly webhook automation patterns
- **`brand-guidelines`** — Consistent UI styling
- **`mcp-builder`** — MCP server integration patterns

---

## License

Proprietary. All rights reserved.
