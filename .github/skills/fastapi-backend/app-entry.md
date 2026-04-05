# App Entry Point & Configuration

## main.py — App Factory

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import auth, calls, clients, followups

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    # Use Alembic for production migrations — this is fine for dev/SQLite
    Base.metadata.create_all(engine)  # SA 2.0: no bind= keyword
    yield
    # Shutdown: add cleanup logic here if needed

def create_app() -> FastAPI:
    app = FastAPI(title="Convoflow AI API", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],          # Development — see production note below
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
    app.include_router(calls.router,     prefix="/calls",     tags=["calls"])
    app.include_router(clients.router,   prefix="/clients",   tags=["clients"])
    app.include_router(followups.router, prefix="/followups", tags=["followups"])

    return app

app = create_app()
```

> **Why lifespan over `@app.on_event("startup")`?** FastAPI officially deprecated
> `@app.on_event` in favour of the `@asynccontextmanager` lifespan pattern. It handles
> both startup and shutdown in one place and works correctly with testing tools that
> need clean setup/teardown.

---

## Production CORS

`allow_origins=["*"]` is fine for development but must be restricted before deploying.

```python
# Production: enumerate exact origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.convoflow.ai",
        "https://dashboard.convoflow.ai",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

> **Rule**: Never combine `allow_origins=["*"]` with `allow_credentials=True` — browsers
> reject it. You must list explicit origins when credentials are included.

---

## TrustedHostMiddleware (production)

Prevents host header injection attacks. Add alongside CORS:

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.convoflow.ai"])
```

---

## Settings — Pydantic Settings v2

```python
# core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openai_api_key: str
    pabbly_webhook_url: str
    pabbly_webhook_secret: str
    database_url: str = "sqlite:///./convoflow.db"
    secret_key: str                        # min 32 chars — secrets.token_hex(32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days
    upload_dir: str = "./uploads"
    max_audio_size_mb: int = 100

settings = Settings()
```

`pydantic-settings` reads directly from `.env` — no manual `os.environ.get()` needed.
Access anywhere in the project by importing `settings`.

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
ReDoc: `http://localhost:8000/redoc`
