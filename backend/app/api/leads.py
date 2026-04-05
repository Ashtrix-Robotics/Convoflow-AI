from __future__ import annotations
"""
Lead management API — inbound webhook from Pabbly (Google Sheets) + CRUD.
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Agent, CallRecord, Lead
from app.schemas.schemas import LeadCreate, LeadInbound, LeadOut, LeadUpdate
from app.api.deps import get_current_agent
from app.services.aisensy import sync_lead_whatsapp_state
from app.services.pabbly import fire_event
from app.services.phone_numbers import normalize_phone_number, phone_lookup_variants, phones_match

router = APIRouter(prefix="/leads", tags=["leads"])


# ---------------------------------------------------------------------------
# Inbound webhook — Pabbly fires this when a new Google Sheets row appears
# ---------------------------------------------------------------------------

@router.post("/inbound", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def inbound_lead(
    background_tasks: BackgroundTasks,
    lead_in: LeadInbound,
    request: Request,
    x_pabbly_signature: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """
    Receive a new lead from Pabbly Connect (Google Sheets new-row trigger).
    - Verifies HMAC signature when configured
    - Deduplicates by phone number (upserts)
    - Round-robin assigns to an active agent
    """
    # Verify signature if secret is configured
    if settings.pabbly_secret_key and x_pabbly_signature:
        body = await request.body()
        expected = hmac.new(
            settings.pabbly_secret_key.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_pabbly_signature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature"
            )

    normalized_phone = normalize_phone_number(
        lead_in.phone,
        settings.aisensy_default_country_code,
    )
    if not normalized_phone:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid phone number")

    candidate_suffix = normalized_phone[-10:]
    variants = phone_lookup_variants(normalized_phone, settings.aisensy_default_country_code)
    candidates = db.query(Lead).filter(Lead.phone.in_(variants)).all()
    if not candidates and candidate_suffix:
        candidates = db.query(Lead).filter(Lead.phone.like(f"%{candidate_suffix}%")).all()

    existing = next(
        (
            lead for lead in candidates
            if phones_match(lead.phone, normalized_phone, settings.aisensy_default_country_code)
        ),
        None,
    )
    if existing:
        existing.phone = normalized_phone
        # Update fields that may have changed
        if lead_in.name:
            existing.name = lead_in.name
        if lead_in.email:
            existing.email = lead_in.email
        if lead_in.source_campaign:
            existing.source_campaign = lead_in.source_campaign
        if lead_in.google_sheet_row_id:
            existing.google_sheet_row_id = lead_in.google_sheet_row_id
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        background_tasks.add_task(sync_lead_whatsapp_state, existing.id)
        return existing

    # Round-robin assignment: pick agent with fewest active (non-converted/lost) leads
    agents = db.query(Agent).filter(Agent.is_active.is_(True)).all()
    assigned_agent_id = None
    if agents:
        agent_lead_counts = (
            db.query(Lead.assigned_agent_id, func.count(Lead.id))
            .filter(Lead.status.notin_(["converted", "lost"]))
            .group_by(Lead.assigned_agent_id)
            .all()
        )
        count_map = {aid: cnt for aid, cnt in agent_lead_counts}
        assigned_agent_id = min(
            (a.id for a in agents),
            key=lambda aid: count_map.get(aid, 0),
        )

    lead = Lead(
        name=lead_in.name,
        phone=normalized_phone,
        email=lead_in.email,
        source_campaign=lead_in.source_campaign,
        ad_set=lead_in.ad_set,
        google_sheet_row_id=lead_in.google_sheet_row_id,
        assigned_agent_id=assigned_agent_id,
        status="new",
        intent_category="new",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Fire optional Pabbly event
    await fire_event("lead.imported", {
        "lead_id": lead.id,
        "name": lead.name,
        "phone": lead.phone,
        "email": lead.email or "",
        "source_campaign": lead.source_campaign or "",
        "assigned_agent": assigned_agent_id or "",
    })

    background_tasks.add_task(sync_lead_whatsapp_state, lead.id)

    return lead


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[LeadOut])
def list_leads(
    status_filter: str | None = None,
    intent: str | None = None,
    campaign: str | None = None,
    assigned_agent_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """List leads with optional filters. Sorted by priority: new first, then by next_followup_at."""
    q = db.query(Lead)
    if status_filter:
        q = q.filter(Lead.status == status_filter)
    if intent:
        q = q.filter(Lead.intent_category == intent)
    if campaign:
        q = q.filter(Lead.source_campaign == campaign)
    if assigned_agent_id:
        q = q.filter(Lead.assigned_agent_id == assigned_agent_id)

    # Priority sort: new leads first, then by next_followup_at ASC, then created_at ASC
    q = q.order_by(
        Lead.status == "new",  # False (0) sorts before True (1) — we want True first
        Lead.next_followup_at.asc().nullslast(),
        Lead.created_at.desc(),
    )
    return q.offset(skip).limit(limit).all()


@router.get("/my", response_model=list[LeadOut])
def my_leads(
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """Get leads assigned to the current agent (for mobile app queue)."""
    q = db.query(Lead).filter(Lead.assigned_agent_id == agent.id)
    if status_filter:
        q = q.filter(Lead.status == status_filter)

    # Priority: new → callback_requested (by callback time) → the rest
    q = q.order_by(
        Lead.status.desc(),
        Lead.callback_scheduled_at.asc().nullslast(),
        Lead.next_followup_at.asc().nullslast(),
        Lead.created_at.desc(),
    )
    return q.offset(skip).limit(limit).all()


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: str,
    update: LeadUpdate,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/assign", response_model=LeadOut)
def assign_lead(
    lead_id: str,
    agent_id: str,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    target = db.query(Agent).filter(Agent.id == agent_id, Agent.is_active.is_(True)).first()
    if not target:
        raise HTTPException(status_code=404, detail="Agent not found")
    lead.assigned_agent_id = agent_id
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead


# ---------------------------------------------------------------------------
# Quick-tag: No Answer (fires Pabbly event, no transcription)
# ---------------------------------------------------------------------------

@router.post("/{lead_id}/no-answer", response_model=LeadOut)
async def mark_no_answer(
    lead_id: str,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """Salesperson tags the lead as 'no answer' — fires automation immediately."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.intent_category = "no_answer"
    lead.status = "contacted"
    lead.followup_count += 1
    lead.last_contacted_at = datetime.now(timezone.utc)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)

    # Create a minimal call record for history
    call = CallRecord(
        agent_id=agent.id,
        lead_id=lead_id,
        status="completed",
        call_tag="no_answer",
        summary="No answer — automated follow-up triggered.",
    )
    db.add(call)
    db.commit()

    # Fire Pabbly
    await fire_event("lead.no_answer", {
        "lead_id": lead.id,
        "name": lead.name,
        "phone": lead.phone,
        "email": lead.email or "",
        "attempt_count": lead.followup_count,
        "agent_name": agent.name,
        "agent_email": agent.email,
    })

    return lead
