from __future__ import annotations
"""
Analytics API — aggregations for the web dashboard.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Agent, CallRecord, Lead, WhatsAppConversation
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

    # Array shapes for charts
    campaign_breakdown = [
        {
            "campaign": campaign,
            "leads": cnt,
            "converted": (
                db.query(func.count(Lead.id))
                .filter(Lead.source_campaign == campaign, Lead.status == "converted")
                .scalar() or 0
            ),
            "conversion_rate": round(
                (
                    (db.query(func.count(Lead.id))
                     .filter(Lead.source_campaign == campaign, Lead.status == "converted")
                     .scalar() or 0)
                    / cnt * 100
                ) if cnt > 0 else 0.0,
                1,
            ),
        }
        for campaign, cnt in leads_by_campaign.items()
    ]

    intent_distribution = [
        {"intent": intent, "count": cnt}
        for intent, cnt in leads_by_intent.items()
        if intent
    ]

    # Daily stats — last 30 days
    thirty_days_ago = today - timedelta(days=29)
    daily_stats: list[dict] = []
    for offset in range(30):
        day_start = thirty_days_ago + timedelta(days=offset)
        day_end = day_start + timedelta(days=1)
        new_leads = (
            db.query(func.count(Lead.id))
            .filter(Lead.created_at >= day_start, Lead.created_at < day_end)
            .scalar() or 0
        )
        calls_made = (
            db.query(func.count(CallRecord.id))
            .filter(CallRecord.created_at >= day_start, CallRecord.created_at < day_end)
            .scalar() or 0
        )
        conversions = (
            db.query(func.count(Lead.id))
            .filter(
                Lead.created_at >= day_start,
                Lead.created_at < day_end,
                Lead.status == "converted",
            )
            .scalar() or 0
        )
        daily_stats.append({
            "date": day_start.strftime("%b %d"),
            "new_leads": new_leads,
            "calls_made": calls_made,
            "conversions": conversions,
        })

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
        campaign_breakdown=campaign_breakdown,
        intent_distribution=intent_distribution,
        daily_stats=daily_stats,
        total_calls_today=total_calls_today,
        total_conversions=total_conversions,
        conversion_rate=round(conversion_rate, 1),
        agent_stats=agent_stats,
        stale_leads_count=_count_stale_leads(db, today),
        followups_due_today=_count_followups_due_today(db, today),
        leads_without_contact=_count_leads_without_contact(db),
        whatsapp_active_count=_count_whatsapp_active(db),
        avg_followup_count=_avg_followup_count(db),
        status_funnel=_build_status_funnel(leads_by_status, total_leads),
    )


# ---------------------------------------------------------------------------
# Enhanced analytics helpers
# ---------------------------------------------------------------------------

def _count_stale_leads(db: Session, today: datetime) -> int:
    """Leads in new/contacted status last updated > 7 days ago (not acted on)."""
    cutoff = today - timedelta(days=7)
    return (
        db.query(func.count(Lead.id))
        .filter(
            Lead.status.in_(["new", "contacted"]),
            Lead.updated_at < cutoff,
        )
        .scalar() or 0
    )


def _count_followups_due_today(db: Session, today: datetime) -> int:
    """Leads with next_followup_at between start and end of today."""
    day_end = today + timedelta(days=1)
    return (
        db.query(func.count(Lead.id))
        .filter(
            Lead.next_followup_at >= today,
            Lead.next_followup_at < day_end,
        )
        .scalar() or 0
    )


def _count_leads_without_contact(db: Session) -> int:
    """New leads that have never been contacted (last_contacted_at is NULL)."""
    return (
        db.query(func.count(Lead.id))
        .filter(Lead.status == "new", Lead.last_contacted_at.is_(None))
        .scalar() or 0
    )


def _count_whatsapp_active(db: Session) -> int:
    """WhatsApp conversations that are currently active (not closed, not opted out)."""
    try:
        return (
            db.query(func.count(WhatsAppConversation.id))
            .filter(
                WhatsAppConversation.is_closed.is_(False),
                WhatsAppConversation.opted_out.is_(False),
            )
            .scalar() or 0
        )
    except Exception:
        return 0


def _avg_followup_count(db: Session) -> float:
    """Average number of follow-up attempts across all leads."""
    result = db.query(func.avg(Lead.followup_count)).scalar()
    return round(float(result), 1) if result else 0.0


def _build_status_funnel(leads_by_status: dict[str, int], total: int) -> list[dict]:
    """Build an ordered pipeline funnel: new → contacted → qualified → payment_sent → converted → lost."""
    stages = ["new", "contacted", "qualified", "payment_sent", "converted", "lost"]
    return [
        {
            "stage": stage,
            "count": leads_by_status.get(stage, 0),
            "pct": round(leads_by_status.get(stage, 0) / total * 100, 1) if total > 0 else 0.0,
        }
        for stage in stages
    ]
