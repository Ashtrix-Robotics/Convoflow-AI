from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut, TokenOut, SupabaseSessionIn
from app.api.deps import get_current_agent

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, agent_in: AgentCreate, db: Session = Depends(get_db)):
    existing = db.query(Agent).filter(Agent.email == agent_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    agent = Agent(
        name=agent_in.name,
        email=agent_in.email,
        hashed_password=hash_password(agent_in.password),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.email == form.username).first()
    if not agent or not agent.is_active or not verify_password(form.password, agent.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    token = create_access_token({"sub": agent.id, "email": agent.email})
    return {"access_token": token}


@router.post("/supabase-session", response_model=TokenOut)
@limiter.limit("20/minute")
def supabase_session(request: Request, body: SupabaseSessionIn, db: Session = Depends(get_db)):
    """Exchange a valid Supabase Auth JWT for a Convoflow platform JWT.

    Flow:
    1. Frontend signs in via Supabase Auth (email/password, OAuth, magic-link, etc.)
    2. Frontend sends the Supabase access_token to this endpoint.
    3. We validate the token against Supabase's servers using the service key.
    4. We look up the Agent by email; link supabase_uid on first visit.
    5. We return our own JWT so all existing API calls continue unchanged.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase auth not configured on this server.",
        )

    try:
        from supabase import create_client as _create_supabase_client
        sb = _create_supabase_client(settings.supabase_url, settings.supabase_service_key)
        user_response = sb.auth.get_user(body.supabase_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Supabase token"
        )

    sb_user = getattr(user_response, "user", None)
    if not sb_user or not sb_user.email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not retrieve user from Supabase token"
        )

    agent = db.query(Agent).filter(Agent.email == sb_user.email).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No agent account linked to this email. Ask your admin to create an account first.",
        )
    if not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended. Contact admin."
        )

    # Link supabase_uid on first Supabase login
    if not agent.supabase_uid:
        agent.supabase_uid = sb_user.id
        db.commit()

    token = create_access_token({"sub": agent.id, "email": agent.email})
    return {"access_token": token}


@router.get("/me", response_model=AgentOut)
def me(agent: Agent = Depends(get_current_agent)):
    return agent


class ResetPlatformPasswordIn(BaseModel):
    supabase_token: str
    new_password: str = Field(..., min_length=8)


@router.post("/reset-platform-password", status_code=200)
@limiter.limit("10/minute")
def reset_platform_password(
    request: Request,
    body: ResetPlatformPasswordIn,
    db: Session = Depends(get_db),
):
    """
    After a Supabase password-reset email flow, sync the new password to
    the platform DB so mobile (platform-JWT) login keeps working.

    Flow:
    1. Frontend calls supabase.auth.updateUser({ password: newPassword })
    2. Frontend sends the fresh Supabase access_token + new password here.
    3. We verify the token, find the Agent, and update hashed_password.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase auth not configured on this server.",
        )
    try:
        from supabase import create_client as _sc
        sb = _sc(settings.supabase_url, settings.supabase_service_key)
        user_response = sb.auth.get_user(body.supabase_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Supabase token")

    sb_user = getattr(user_response, "user", None)
    if not sb_user or not sb_user.email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify Supabase token")

    agent = db.query(Agent).filter(Agent.email == sb_user.email).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No platform account linked to this email")

    agent.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Platform password updated"}
