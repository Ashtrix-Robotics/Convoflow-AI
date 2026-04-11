from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api import admin, aisensy, analytics, auth, calls, clients, followups, leads, agents_admin
from app.api.deps import get_current_agent

# Auto-create tables only in development.
# In production, run: alembic upgrade head
if settings.environment == "development":
    Base.metadata.create_all(bind=engine)

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    redirect_slashes=False,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


# ─── Security headers middleware ──────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=3600,
)

# ─── Public routes (no auth required) ────────────────────────────────────────
app.include_router(auth.router)

# ─── Protected routes (all require JWT auth) ─────────────────────────────────
_protected = [Depends(get_current_agent)]
app.include_router(calls.router, dependencies=_protected)
app.include_router(clients.router, dependencies=_protected)
app.include_router(followups.router, dependencies=_protected)
app.include_router(leads.router)  # has own auth + webhook routes
app.include_router(aisensy.router)  # has own auth + webhook routes
app.include_router(analytics.router, dependencies=_protected)
app.include_router(admin.router)  # has per-route auth
app.include_router(agents_admin.router)  # has router-level auth


@app.get("/health")
@limiter.limit("30/minute")
def health_check(request: Request):
    return {"status": "ok", "service": "Convoflow AI API", "version": "5"}
