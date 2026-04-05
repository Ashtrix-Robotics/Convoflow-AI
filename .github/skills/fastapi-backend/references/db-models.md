# Convoflow AI — Database Models Reference

Quick-reference for all SQLAlchemy models and Pydantic schemas used in the backend.

---

## SQLAlchemy Models

### Agent

```python
class Agent(Base):
    __tablename__ = "agents"
    id            # String (UUID)  — PK
    email         # String         — unique, indexed
    full_name     # String
    hashed_pw     # String         — bcrypt hash
    created_at    # DateTime       — default=datetime.now(timezone.utc)
```

---

### Client

```python
class Client(Base):
    __tablename__ = "clients"
    id            # String (UUID)  — PK
    name          # String         — not null
    email         # String         — nullable
    phone         # String         — nullable
    company       # String         — nullable
    agent_id      # String         — FK → agents.id
    created_at    # DateTime       — default=datetime.now(timezone.utc)
```

---

### CallRecord

```python
class CallRecord(Base):
    __tablename__ = "call_records"
    id               # String (UUID)  — PK
    agent_id         # String         — FK → agents.id
    client_id        # String         — FK → clients.id (nullable)
    status           # String         — see Status Values below
    audio_filename   # String         — stored under UPLOAD_DIR
    raw_transcript   # Text           — nullable until transcription done
    summary          # Text           — nullable until transcription done
    action_items     # JSON           — list[str], nullable
    sentiment        # String         — nullable ("positive"|"neutral"|"negative")
    next_step        # String         — nullable
    duration_seconds # Integer        — nullable
    created_at       # DateTime       — default=datetime.now(timezone.utc)
    updated_at       # DateTime       — onupdate=datetime.now(timezone.utc)
```

#### Status Values

| Value          | Meaning                             |
| -------------- | ----------------------------------- |
| `pending`      | Upload received, not yet processing |
| `transcribing` | Background task running             |
| `completed`    | Transcript + insights extracted     |
| `failed`       | Background task raised exception    |

State machine: `pending` → `transcribing` → `completed` | `failed`

---

### FollowUp

```python
class FollowUp(Base):
    __tablename__ = "followups"
    id          # String (UUID)  — PK
    call_id     # String         — FK → call_records.id
    agent_id    # String         — FK → agents.id
    due_date    # DateTime
    notes       # Text           — nullable
    completed   # Boolean        — default=False
    created_at  # DateTime       — default=datetime.now(timezone.utc)
```

---

## Pydantic Schemas

### AgentCreate / AgentOut

```python
class AgentCreate(BaseModel):
    email:     EmailStr
    password:  str = Field(min_length=8)
    full_name: str

class AgentOut(BaseModel):
    id:         str
    email:      EmailStr
    full_name:  str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

### CallRecordOut

```python
class CallRecordOut(BaseModel):
    id:               str
    status:           str
    audio_filename:   str
    raw_transcript:   str | None
    summary:          str | None
    action_items:     list[str] | None
    sentiment:        str | None
    next_step:        str | None
    duration_seconds: int | None
    created_at:       datetime
    agent_id:         str
    client_id:        str | None
    model_config = ConfigDict(from_attributes=True)
```

---

### ClientCreate / ClientOut

```python
class ClientCreate(BaseModel):
    name:    str
    email:   EmailStr | None = None
    phone:   str | None      = None
    company: str | None      = None

class ClientOut(ClientCreate):
    id:         str
    agent_id:   str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

### FollowUpCreate / FollowUpOut

```python
class FollowUpCreate(BaseModel):
    call_id:  str
    due_date: datetime
    notes:    str | None = None

class FollowUpOut(BaseModel):
    id:         str
    call_id:    str
    agent_id:   str
    due_date:   datetime
    notes:      str | None
    completed:  bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

## Settings (Pydantic v2)

```python
class Settings(BaseSettings):
    OPENAI_API_KEY:        str
    PABBLY_WEBHOOK_URL:    str = ""
    PABBLY_WEBHOOK_SECRET: str = ""
    SECRET_KEY:            str   # min 32 chars
    ALGORITHM:             str   = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    DATABASE_URL:          str   = "sqlite:///./convoflow.db"
    UPLOAD_DIR:            str   = "./uploads"
    model_config = SettingsConfigDict(env_file=".env")
```

---

## Directory Structure (Backend)

```
backend/
├── app/
│   ├── main.py          # App factory, CORS, routers
│   ├── database.py      # Engine, session, Base, get_db
│   ├── models.py        # All SQLAlchemy models
│   ├── schemas.py       # All Pydantic schemas
│   ├── security.py      # JWT encode/decode, password hash
│   ├── deps.py          # get_current_agent dependency
│   ├── config.py        # Settings singleton
│   ├── routes/
│   │   ├── auth.py      # /auth/*
│   │   ├── calls.py     # /calls/*
│   │   ├── clients.py   # /clients/*
│   │   └── followups.py # /followups/*
│   └── services/
│       ├── transcription.py  # OpenAI Whisper + GPT-4
│       └── pabbly.py         # Webhook dispatch
├── .env
├── requirements.txt
└── alembic/             # (optional) migrations
```
