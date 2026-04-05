from __future__ import annotations
"""
Analytics API — aggregations for the web dashboard.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Agent, CallRecord, Lead
from app.schemas.schemas import AnalyticsOverview
from app.api.deps import get_current_agent

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def get_overview(
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_leads = db.query(func.count(Lead.id)).scalar() or 0

    # Leads by status
    status_rows = (
        db.query(Lead.status, func.count(Lead.id))
        .group_by(Lead.status)
        .all()
    )
    leads_by_status = {s: c for s, c in status_rows}

    # Leads by intent
    intent_rows = (
        db.query(Lead.intent_category, func.count(Lead.id))
        .group_by(Lead.intent_category)
        .all()
    )
    leads_by_intent = {i: c for i, c in intent_rows}

    # Leads by campaign
    campaign_rows = (
        db.query(Lead.source_campaign, func.count(Lead.id))
        .filter(Lead.source_campaign.isnot(None))
        .group_by(Lead.source_campaign)
        .all()
    )
    leads_by_campaign = {c or "Unknown": cnt for c, cnt in campaign_rows}

    # Today's calls
    total_calls_today = (
        db.query(func.count(CallRecord.id))
        .filter(CallRecord.created_at >= today)
        .scalar() or 0
    )

    # Conversions
    total_conversions = (
        db.query(func.count(Lead.id))
        .filter(Lead.status == "converted")
        .scalar() or 0
    )
    conversion_rate = (total_conversions / total_leads * 100) if total_leads > 0 else 0.0

    # Agent stats
    agent_rows = (
        db.query(
            Agent.id,
            Agent.name,
            func.count(CallRecord.id).label("calls_made"),
        )
        .outerjoin(CallRecord, CallRecord.agent_id == Agent.id)
        .filter(Agent.is_active.is_(True))
        .group_by(Agent.id, Agent.name)
        .all()
    )

    agent_stats = []
    for agent_id, agent_name, calls_made in agent_rows:
        agent_leads = db.query(func.count(Lead.id)).filter(Lead.assigned_agent_id == agent_id).scalar() or 0
        agent_conversions = (
            db.query(func.count(Lead.id))
            .filter(Lead.assigned_agent_id == agent_id, Lead.status == "converted")
            .scalar() or 0
        )
        agent_stats.append({
            "agent_id": agent_id,
            "agent_name": agent_name,
            "calls_made": calls_made,
            "leads_assigned": agent_leads,
            "conversions": agent_conversions,
            "conversion_rate": (agent_conversions / agent_leads * 100) if agent_leads > 0 else 0.0,
        })

    return AnalyticsOverview(
        total_leads=total_leads,
        leads_by_status=leads_by_status,
        leads_by_intent=leads_by_intent,
        leads_by_campaign=leads_by_campaign,
        total_calls_today=total_calls_today,
        total_conversions=total_conversions,
        conversion_rate=round(conversion_rate, 1),
        agent_stats=agent_stats,
    )
