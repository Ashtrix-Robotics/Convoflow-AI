# Database — Session, Models & Schemas

## Database Session (core/database.py)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite only — remove for Postgres
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

`get_db` is a FastAPI dependency — use via `DBDep = Annotated[Session, Depends(get_db)]`
(defined in `api/deps.py`). Never instantiate `SessionLocal()` in routes directly.

> **For production**: Switch SQLite → PostgreSQL by changing `DATABASE_URL` in `.env`.
> Remove `connect_args={"check_same_thread": False}` (SQLite-specific).
> Use Alembic for schema migrations rather than `Base.metadata.create_all()`.

---

## SQLAlchemy Models (models/models.py)

```python
from sqlalchemy import String, Text, DateTime, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship, mapped_column, Mapped
from datetime import datetime, timezone
from app.core.database import Base

class Agent(Base):
    __tablename__ = "agents"

    id:         Mapped[str] = mapped_column(String, primary_key=True)
    email:      Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name:  Mapped[str] = mapped_column(String, nullable=False)
    hashed_pw:  Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    calls:   Mapped[list["CallRecord"]] = relationship(back_populates="agent")
    clients: Mapped[list["Client"]]    = relationship(back_populates="agent")


class Client(Base):
    __tablename__ = "clients"

    id:         Mapped[str]      = mapped_column(String, primary_key=True)
    agent_id:   Mapped[str]      = mapped_column(ForeignKey("agents.id"), nullable=False)
    name:       Mapped[str]      = mapped_column(String, nullable=False)
    email:      Mapped[str|None] = mapped_column(String, nullable=True)
    phone:      Mapped[str|None] = mapped_column(String, nullable=True)
    company:    Mapped[str|None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    agent: Mapped["Agent"]          = relationship(back_populates="clients")
    calls: Mapped[list["CallRecord"]] = relationship(back_populates="client")


class CallRecord(Base):
    __tablename__ = "call_records"

    id:               Mapped[str]      = mapped_column(String, primary_key=True)
    agent_id:         Mapped[str]      = mapped_column(ForeignKey("agents.id"), nullable=False)
    client_id:        Mapped[str|None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    audio_filename:   Mapped[str]      = mapped_column(String, nullable=False)
    status:           Mapped[str]      = mapped_column(String, default="pending")
    raw_transcript:   Mapped[str|None] = mapped_column(Text, nullable=True)
    summary:          Mapped[str|None] = mapped_column(Text, nullable=True)
    action_items:     Mapped[list|None]= mapped_column(JSON, nullable=True)
    sentiment:        Mapped[str|None] = mapped_column(String, nullable=True)
    next_step:        Mapped[str|None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[int|None] = mapped_column(Integer, nullable=True)
    created_at:       Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    agent:     Mapped["Agent"]         = relationship(back_populates="calls")
    client:    Mapped["Client|None"]   = relationship(back_populates="calls")
    followups: Mapped[list["FollowUp"]] = relationship(back_populates="call")


class FollowUp(Base):
    __tablename__ = "followups"

    id:         Mapped[str]      = mapped_column(String, primary_key=True)
    call_id:    Mapped[str]      = mapped_column(ForeignKey("call_records.id"), nullable=False)
    agent_id:   Mapped[str]      = mapped_column(ForeignKey("agents.id"), nullable=False)
    due_date:   Mapped[datetime] = mapped_column(DateTime, nullable=False)
    notes:      Mapped[str|None] = mapped_column(Text, nullable=True)
    completed:  Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    call:  Mapped["CallRecord"] = relationship(back_populates="followups")
```

### CallRecord Status Values

| Value          | Meaning                          |
| -------------- | -------------------------------- |
| `pending`      | Upload received, not yet started |
| `transcribing` | Background task running          |
| `completed`    | Transcript + insights extracted  |
| `failed`       | Background task raised exception |

State machine: `pending` → `transcribing` → `completed` **or** `failed`.
Never set any other status value — the frontend and Pabbly webhooks depend on exactly these four.

> **Why `lambda: datetime.now(timezone.utc)`?** SQLAlchemy evaluates `default=` once at
> class-definition time if given a bare callable result (like `datetime.utcnow()` — now
> deprecated). Using a `lambda` ensures each new record gets the current time at insert.
> `datetime.utcnow()` is also removed in Python 3.12+ in favour of `datetime.now(timezone.utc)`.

---

## Pydantic Schemas (schemas/schemas.py)

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from datetime import datetime

# ── Agent ────────────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    email:     EmailStr
    password:  str = Field(min_length=8)
    full_name: str

class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:         str
    email:      str
    full_name:  str
    created_at: datetime

# ── Client ───────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    name:    str
    email:   str | None = None
    phone:   str | None = None
    company: str | None = None

class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:      str
    name:    str
    email:   str | None
    phone:   str | None
    company: str | None

# ── CallRecord ────────────────────────────────────────────────────────────────

class CallRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           str
    status:       str
    summary:      str | None
    action_items: list[str] | None
    sentiment:    str | None
    next_step:    str | None
    created_at:   datetime

# ── FollowUp ──────────────────────────────────────────────────────────────────

class FollowUpCreate(BaseModel):
    call_id:  str
    due_date: datetime
    notes:    str | None = None

class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:        str
    call_id:   str
    due_date:  datetime
    notes:     str | None
    completed: bool
```

Always use `model_config = ConfigDict(from_attributes=True)` on schemas that map to
SQLAlchemy ORM objects. This replaces the old `class Config: orm_mode = True`.

Use `response_model=FollowUpOut` on the route decorator (not a return type annotation) when
the function internally works with ORM objects and only the serialized version should be sent.
