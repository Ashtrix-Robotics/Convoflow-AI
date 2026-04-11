from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_agent
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/agents",
    tags=["admin-agents"],
    dependencies=[Depends(get_current_agent)],  # All routes require auth
)


class AgentUpdateAdmin(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


# ── Supabase helpers ─────────────────────────────────────────────────────────

def _supabase_admin():
    """Return a Supabase admin client, or None if not configured."""
    if not (settings.supabase_url and settings.supabase_service_key):
        return None
    try:
        from supabase import create_client as _sc
        return _sc(settings.supabase_url, settings.supabase_service_key)
    except Exception as exc:
        logger.warning("Supabase client init failed: %s", exc)
        return None


def _supabase_create_user(email: str, password: str) -> str | None:
    """Create a Supabase Auth user and return their UID, or None on failure."""
    sb = _supabase_admin()
    if not sb:
        return None
    try:
        res = sb.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
        return res.user.id if res.user else None
    except Exception as exc:
        logger.warning("Supabase create_user failed for %s: %s", email, exc)
        return None


def _supabase_update_user(supabase_uid: str, *, email: str | None = None, password: str | None = None, name: str | None = None) -> None:
    sb = _supabase_admin()
    if not sb or not supabase_uid:
        return
    patch: dict = {}
    if email:
        patch["email"] = email
    if password:
        patch["password"] = password
    if name:
        patch["user_metadata"] = {"full_name": name}
    if not patch:
        return
    try:
        sb.auth.admin.update_user_by_id(supabase_uid, patch)
    except Exception as exc:
        logger.warning("Supabase update_user failed (%s): %s", supabase_uid, exc)


def _supabase_delete_user(supabase_uid: str) -> None:
    sb = _supabase_admin()
    if not sb or not supabase_uid:
        return
    try:
        sb.auth.admin.delete_user(supabase_uid)
    except Exception as exc:
        logger.warning("Supabase delete_user failed (%s): %s", supabase_uid, exc)

@router.get("/", response_model=list[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    return db.query(Agent).all()

@router.post("/me/change-password", status_code=200)
def change_own_password(
    payload: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Logged-in agent changes their own password (requires current password).

    For accounts that have a platform hashed_password (created via API / mobile),
    the current password is verified locally.  For Supabase-only accounts (web
    admin created directly in Supabase dashboard) that have no hashed_password,
    we verify via supabase.auth.sign_in_with_password instead.
    """
    if current_agent.hashed_password:
        # Normal path — fast local bcrypt check
        if not verify_password(payload.current_password, current_agent.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Current password is incorrect")
    else:
        # Supabase-only account (no platform password hash set yet)
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cannot verify current password — Supabase not configured on this server.",
            )
        try:
            from supabase import create_client as _sc
            sb_anon = _sc(settings.supabase_url, settings.supabase_anon_key)
            sb_anon.auth.sign_in_with_password(
                {"email": current_agent.email, "password": payload.current_password}
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

    # Update platform hash (also initialises it for Supabase-only accounts)
    current_agent.hashed_password = hash_password(payload.new_password)
    db.commit()
    # Mirror to Supabase so web login also uses the new password
    _supabase_update_user(current_agent.supabase_uid or "", password=payload.new_password)
    return {"message": "Password updated successfully"}


@router.post("/", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(
    agent_in: AgentCreate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    if db.query(Agent).filter(Agent.email == agent_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    agent = Agent(
        name=agent_in.name,
        email=agent_in.email,
        hashed_password=hash_password(agent_in.password),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    # Create matching Supabase Auth account so the agent can log in via the web dashboard
    uid = _supabase_create_user(agent_in.email, agent_in.password)
    if uid:
        agent.supabase_uid = uid
        db.commit()
    return agent

@router.put("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: str,
    update_in: AgentUpdateAdmin,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    sb_patch: dict = {}
    if update_in.name is not None:
        agent.name = update_in.name
        sb_patch["name"] = update_in.name
    if update_in.email is not None:
        agent.email = update_in.email
        sb_patch["email"] = update_in.email
    if update_in.password:
        agent.hashed_password = hash_password(update_in.password)
        sb_patch["password"] = update_in.password
    if update_in.is_active is not None:
        agent.is_active = update_in.is_active
    db.commit()
    db.refresh(agent)
    # Mirror updates to Supabase
    if sb_patch and agent.supabase_uid:
        _supabase_update_user(
            agent.supabase_uid,
            email=sb_patch.get("email"),
            password=sb_patch.get("password"),
            name=sb_patch.get("name"),
        )
    return agent

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    from app.models.models import AppSetting, CallRecord, Lead, WhatsAppConversation
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.id == current_agent.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    supabase_uid = agent.supabase_uid
    # Nullify optional FK references
    db.query(Lead).filter(Lead.assigned_agent_id == agent_id).update(
        {"assigned_agent_id": None}, synchronize_session=False
    )
    db.query(WhatsAppConversation).filter(
        WhatsAppConversation.initiated_by_agent_id == agent_id
    ).update({"initiated_by_agent_id": None}, synchronize_session=False)
    db.query(AppSetting).filter(AppSetting.updated_by_agent_id == agent_id).update(
        {"updated_by_agent_id": None}, synchronize_session=False
    )
    # CallRecord.agent_id is non-nullable — cascade delete the agent's call records
    db.query(CallRecord).filter(CallRecord.agent_id == agent_id).delete(
        synchronize_session=False
    )
    db.delete(agent)
    db.commit()
    # Remove from Supabase Auth
    if supabase_uid:
        _supabase_delete_user(supabase_uid)
    return
