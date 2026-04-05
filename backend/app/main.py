from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api import admin, aisensy, analytics, auth, calls, clients, followups, leads

# Auto-create tables only in development.
# In production, run: alembic upgrade head
if settings.environment == "development":
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calls.router)
app.include_router(clients.router)
app.include_router(followups.router)
app.include_router(leads.router)
app.include_router(aisensy.router)
app.include_router(analytics.router)
app.include_router(admin.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Convoflow AI API"}


@app.get("/db-check")
def db_check():
    """Temporary diagnostic endpoint — exposes DB connection errors for debugging."""
    import os
    db_url = os.environ.get("DATABASE_URL", "NOT SET")
    # Mask password
    import re
    masked = re.sub(r'://([^:]+):([^@]+)@', r'://\1:***@', db_url)
    try:
        from sqlalchemy import text, inspect
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        # Check tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        # Try a real query on agents
        try:
            from app.models.models import Agent
            from app.core.database import SessionLocal
            db = SessionLocal()
            count = db.query(Agent).count()
            db.close()
            return {"db": "ok", "url": masked, "tables": tables, "agents_count": count}
        except Exception as e2:
            return {"db": "partial", "url": masked, "tables": tables, "agents_error": str(e2)}
    except Exception as e:
        return {"db": "error", "url": masked, "error": str(e), "type": type(e).__name__}
