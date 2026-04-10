from __future__ import annotations
"""
Admin API — application settings, campaign knowledge base, and WhatsApp test send.
All endpoints require a valid agent JWT.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_agent
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Agent, AppSetting, CallRecord, CampaignKnowledge, Lead
from app.services.aisensy import initiate_lead_campaign, sync_lead_whatsapp_state
from app.services.google_sheets import bulk_sync as sheets_bulk_sync, get_auth_error as sheets_auth_error, list_worksheets as sheets_list_worksheets, pull_leads_from_sheet as sheets_pull_leads
from app.services.phone_numbers import normalize_phone_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

_utcnow = lambda: datetime.now(timezone.utc)  # noqa: E731


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


def _set_setting(db: Session, key: str, value: str, description: str | None = None, agent_id: str | None = None) -> AppSetting:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
        row.updated_by_agent_id = agent_id or row.updated_by_agent_id
        row.updated_at = _utcnow()
    else:
        row = AppSetting(
            key=key,
            value=value,
            description=description,
            updated_by_agent_id=agent_id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class SettingOut(BaseModel):
    key: str
    value: str
    description: str | None
    updated_at: datetime

    class Config:
        from_attributes = True


class SettingUpdateIn(BaseModel):
    value: str


class TemplateParamSchemaItem(BaseModel):
    label: str
    example: str = ""
    description: str = ""


class CampaignKnowledgeIn(BaseModel):
    aisensy_campaign_name: str
    display_name: str
    is_active: bool = True
    is_default: bool = False
    template_params_schema: list[TemplateParamSchemaItem] = []
    default_template_params: list[str] = []
    product_name: str | None = None
    product_description: str | None = None
    key_selling_points: str | None = None
    pricing_info: str | None = None
    target_audience: str | None = None
    tone: str = "friendly"
    ai_persona_prompt: str | None = None
    faq: list[dict] = []
    objections: list[dict] = []


class CampaignKnowledgeOut(BaseModel):
    id: str
    aisensy_campaign_name: str
    display_name: str
    is_active: bool
    is_default: bool
    template_params_schema: list[TemplateParamSchemaItem] = []
    default_template_params: list[str] = []
    product_name: str | None
    product_description: str | None
    key_selling_points: str | None
    pricing_info: str | None
    target_audience: str | None
    tone: str
    ai_persona_prompt: str | None
    faq: list[dict] = []
    objections: list[dict] = []
    created_at: datetime
    updated_at: datetime


class WhatsAppTestIn(BaseModel):
    name: str
    phone: str
    campaign_name: str | None = None
    template_params: list[str] = []


class WhatsAppTestOut(BaseModel):
    success: bool
    message: str
    phone_normalised: str
    campaign_used: str | None
    provider_response: dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: ORM ↔ schema conversion
# ─────────────────────────────────────────────────────────────────────────────

def _campaign_to_out(c: CampaignKnowledge) -> dict:
    def _load(v: str | None) -> list:
        if not v:
            return []
        try:
            parsed = json.loads(v)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    return {
        "id": c.id,
        "aisensy_campaign_name": c.aisensy_campaign_name,
        "display_name": c.display_name,
        "is_active": c.is_active,
        "is_default": c.is_default,
        "template_params_schema": _load(c.template_params_schema_json),
        "default_template_params": _load(c.default_template_params_json),
        "product_name": c.product_name,
        "product_description": c.product_description,
        "key_selling_points": c.key_selling_points,
        "pricing_info": c.pricing_info,
        "target_audience": c.target_audience,
        "tone": c.tone,
        "ai_persona_prompt": c.ai_persona_prompt,
        "faq": _load(c.faq_json),
        "objections": _load(c.objections_json),
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _apply_campaign_in(c: CampaignKnowledge, payload: CampaignKnowledgeIn) -> None:
    c.aisensy_campaign_name = payload.aisensy_campaign_name.strip()
    c.display_name = payload.display_name.strip()
    c.is_active = payload.is_active
    c.is_default = payload.is_default
    c.template_params_schema_json = json.dumps([p.model_dump() for p in payload.template_params_schema])
    c.default_template_params_json = json.dumps(payload.default_template_params)
    c.product_name = payload.product_name
    c.product_description = payload.product_description
    c.key_selling_points = payload.key_selling_points
    c.pricing_info = payload.pricing_info
    c.target_audience = payload.target_audience
    c.tone = payload.tone
    c.ai_persona_prompt = payload.ai_persona_prompt
    c.faq_json = json.dumps(payload.faq)
    c.objections_json = json.dumps(payload.objections)
    c.updated_at = _utcnow()


# ─────────────────────────────────────────────────────────────────────────────
# Settings endpoints
# ─────────────────────────────────────────────────────────────────────────────

# Pre-defined settings with descriptions and defaults
_KNOWN_SETTINGS = {
    "auto_whatsapp_mode": {
        "default": "false",
        "description": "When enabled, AI automatically initiates WhatsApp conversations with every new lead — no agent call required.",
    },
    "auto_whatsapp_campaign": {
        "default": "",
        "description": "AiSensy campaign name to use for auto-initiated messages (leave blank to use the default campaign).",
    },
    "whatsapp_reply_ai_enabled": {
        "default": "false",
        "description": "When enabled, AI will auto-reply to inbound WhatsApp messages from leads.",
    },
}


@router.get("/settings", response_model=list[SettingOut])
def get_all_settings(
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    """Return all settings, including defaults for known keys not yet saved."""
    saved = {row.key: row for row in db.query(AppSetting).all()}
    result = []
    # Ensure known settings always appear
    for key, cfg in _KNOWN_SETTINGS.items():
        if key in saved:
            result.append(saved[key])
        else:
            result.append(AppSetting(
                key=key,
                value=cfg["default"],
                description=cfg["description"],
                updated_at=_utcnow(),
            ))
    # Append any other saved settings not in the known list
    for key, row in saved.items():
        if key not in _KNOWN_SETTINGS:
            result.append(row)
    return result


@router.put("/settings/{key}", response_model=SettingOut)
def update_setting(
    key: str,
    payload: SettingUpdateIn,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    cfg = _KNOWN_SETTINGS.get(key)
    desc = cfg["description"] if cfg else None
    row = _set_setting(db, key, payload.value, description=desc, agent_id=agent.id)
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Campaign Knowledge endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=list[CampaignKnowledgeOut])
def list_campaigns(
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    campaigns = db.query(CampaignKnowledge).order_by(CampaignKnowledge.created_at.desc()).all()
    return [_campaign_to_out(c) for c in campaigns]


@router.post("/campaigns", response_model=CampaignKnowledgeOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignKnowledgeIn,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    existing = db.query(CampaignKnowledge).filter(
        CampaignKnowledge.aisensy_campaign_name == payload.aisensy_campaign_name.strip()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Campaign '{payload.aisensy_campaign_name}' already exists.",
        )
    if payload.is_default:
        # Clear default flag from others
        db.query(CampaignKnowledge).filter(CampaignKnowledge.is_default.is_(True)).update({"is_default": False})

    c = CampaignKnowledge()
    _apply_campaign_in(c, payload)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _campaign_to_out(c)


@router.get("/campaigns/{campaign_id}", response_model=CampaignKnowledgeOut)
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    c = db.query(CampaignKnowledge).filter(CampaignKnowledge.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return _campaign_to_out(c)


@router.put("/campaigns/{campaign_id}", response_model=CampaignKnowledgeOut)
def update_campaign(
    campaign_id: str,
    payload: CampaignKnowledgeIn,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    c = db.query(CampaignKnowledge).filter(CampaignKnowledge.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if payload.is_default and not c.is_default:
        db.query(CampaignKnowledge).filter(
            CampaignKnowledge.is_default.is_(True),
            CampaignKnowledge.id != campaign_id,
        ).update({"is_default": False})

    _apply_campaign_in(c, payload)
    db.commit()
    db.refresh(c)
    return _campaign_to_out(c)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    c = db.query(CampaignKnowledge).filter(CampaignKnowledge.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    db.delete(c)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp Test Send — only touches the specific phone number provided
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/whatsapp/test", response_model=WhatsAppTestOut)
async def whatsapp_test_send(
    payload: WhatsAppTestIn,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """
    Send a WhatsApp test message to ONE specific phone number.
    Creates a temporary lead record if it doesn't exist, sends the campaign,
    then marks it as a test so it doesn't pollute the live pipeline.
    """
    from app.core.config import settings
    from app.services.aisensy import send_first_campaign, upsert_conversation
    from app.services.phone_numbers import format_phone_e164

    if not settings.aisensy_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AiSensy API key is not configured.",
        )
    if not settings.aisensy_send_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Outbound WhatsApp is currently disabled. Set AISENSY_SEND_ENABLED=true in .env to enable.",
        )

    normalised = normalize_phone_number(payload.phone, settings.aisensy_default_country_code)
    if not normalised:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid phone number")

    # Resolve campaign name
    campaign_name = payload.campaign_name
    if not campaign_name:
        default_campaign = db.query(CampaignKnowledge).filter(
            CampaignKnowledge.is_default.is_(True),
            CampaignKnowledge.is_active.is_(True),
        ).first()
        if default_campaign:
            campaign_name = default_campaign.aisensy_campaign_name

    if not campaign_name:
        campaign_name = settings.aisensy_first_campaign_name

    if not campaign_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No campaign configured. Create a campaign in Admin → Campaigns first.",
        )

    # Find or create test lead (scoped to this phone only)
    from app.services.phone_numbers import phones_match
    test_lead = next(
        (
            lead for lead in db.query(Lead).filter(Lead.phone.like(f"%{normalised[-10:]}%")).all()
            if phones_match(lead.phone, normalised, settings.aisensy_default_country_code)
        ),
        None,
    )
    if not test_lead:
        test_lead = Lead(
            name=payload.name,
            phone=normalised,
            source_campaign="[TEST]",
            status="new",
            intent_category="new",
            assigned_agent_id=agent.id,
        )
        db.add(test_lead)
        db.commit()
        db.refresh(test_lead)

    # Resolve template params: payload > campaign defaults
    template_params = payload.template_params
    if not template_params:
        ck = db.query(CampaignKnowledge).filter(
            CampaignKnowledge.aisensy_campaign_name == campaign_name
        ).first()
        if ck and ck.default_template_params_json:
            try:
                template_params = json.loads(ck.default_template_params_json)
            except Exception:
                template_params = []

    # Send
    success, provider_response = await send_first_campaign(
        test_lead,
        campaign_name=campaign_name,
        template_params=template_params if template_params else None,
    )

    # Persist conversation state
    conv = upsert_conversation(db, test_lead)
    conv.status = "awaiting_reply" if success else "template_failed"
    conv.initiated_by_agent_id = agent.id
    conv.initiation_source = "admin_test"
    db.commit()

    return {
        "success": success,
        "message": "Message sent successfully!" if success else provider_response.get("detail", "Send failed"),
        "phone_normalised": format_phone_e164(normalised, settings.aisensy_default_country_code),
        "campaign_used": campaign_name,
        "provider_response": provider_response,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Google Sheets — manual bulk sync
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sheets/sync", tags=["admin"])
def sheets_sync(
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """
    Bulk-sync all leads into the configured Google Sheet (clears & rewrites).
    Useful after initial setup or if the sheet gets out of sync.
    """
    if not settings.use_google_sheets:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sheets is not configured (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SPREADSHEET_ID required)",
        )
    leads = db.query(Lead).order_by(Lead.created_at.asc()).all()
    written = sheets_bulk_sync(leads)
    return {
        "rows_written": written,
        "spreadsheet_id": settings.google_spreadsheet_id,
        "auth_error": sheets_auth_error() or None,
    }


@router.get("/sheets/status", tags=["admin"])
def sheets_status(agent: Agent = Depends(get_current_agent)):
    """Returns whether Google Sheets sync is configured and any auth error."""
    configured = settings.use_google_sheets
    auth_error = sheets_auth_error()
    return {
        "configured": configured,
        "spreadsheet_url": (
            f"https://docs.google.com/spreadsheets/d/{settings.google_spreadsheet_id}/edit"
            if configured else None
        ),
        "auth_error": auth_error or None,
        "source_sheet_name": settings.google_source_sheet_name or "",
    }


@router.put("/sheets/source-sheet", tags=["admin"])
def update_source_sheet_name(
    payload: SettingUpdateIn,
    agent: Agent = Depends(get_current_agent),
):
    """Update the source worksheet tab name (the tab Pabbly watches for inbound leads)."""
    settings.google_source_sheet_name = payload.value.strip()
    return {"source_sheet_name": settings.google_source_sheet_name}


@router.get("/sheets/worksheets", tags=["admin"])
def get_worksheets(agent: Agent = Depends(get_current_agent)):
    """List all worksheet tab names in the configured Google Sheet."""
    if not settings.use_google_sheets:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sheets is not configured",
        )
    tabs = sheets_list_worksheets()
    return {"worksheets": tabs}


@router.post("/sheets/pull", tags=["admin"])
def sheets_pull(
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """
    Pull leads from the source Google Sheet tab into the database.
    Maps sheet columns to lead fields, deduplicates by phone, and creates new leads.
    Does NOT delete existing leads — only adds/updates from the sheet.
    """
    if not settings.use_google_sheets:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sheets is not configured",
        )

    sheet_name = settings.google_source_sheet_name or "Sheet1"
    rows = sheets_pull_leads(sheet_name)
    if not rows:
        return {"created": 0, "updated": 0, "skipped": 0, "sheet_name": sheet_name, "total_rows": 0}

    # Column mapping: sheet header → Lead model field
    COLUMN_MAP = {
        "name": "name",
        "phone number": "phone",
        "phone": "phone",
        "email": "email",
        "campaign": "source_campaign",
        "source_campaign": "source_campaign",
        "lead source": "ad_set",
        "ad_set": "ad_set",
        "ad set": "ad_set",
        "lead temperature": "interest_level",
        "interest level": "interest_level",
        "course interested in": "course_interested_in",
        "academy preference": "course_interested_in",
        "status": "status",
        "notes": "notes",
        "detailed response": "notes",
    }

    created = 0
    updated = 0
    skipped = 0

    for row in rows:
        # Normalize column names to lowercase for matching
        mapped: dict[str, str] = {}
        for col, val in row.items():
            key = str(col).strip().lower()
            if key in COLUMN_MAP:
                field = COLUMN_MAP[key]
                if val and str(val).strip() and field not in mapped:
                    mapped[field] = str(val).strip()

        phone = mapped.get("phone", "")
        name = mapped.get("name", "")
        if not phone or not name:
            skipped += 1
            continue

        normalized = normalize_phone_number(phone, settings.aisensy_default_country_code)
        if not normalized:
            skipped += 1
            continue

        # Deduplicate by phone
        existing = db.query(Lead).filter(Lead.phone == normalized).first()
        if not existing:
            # Also check suffix match
            suffix = normalized[-10:]
            existing = db.query(Lead).filter(Lead.phone.like(f"%{suffix}")).first()

        if existing:
            # Update if fields have values
            for field in ("name", "email", "source_campaign", "ad_set", "interest_level", "course_interested_in"):
                if mapped.get(field):
                    setattr(existing, field, mapped[field])
            existing.updated_at = _utcnow()
            updated += 1
        else:
            lead = Lead(
                name=name,
                phone=normalized,
                email=mapped.get("email"),
                source_campaign=mapped.get("source_campaign"),
                ad_set=mapped.get("ad_set"),
                interest_level=mapped.get("interest_level"),
                course_interested_in=mapped.get("course_interested_in"),
                notes=mapped.get("notes"),
                status=mapped.get("status", "new") if mapped.get("status") in (
                    "new", "contacted", "in_progress", "qualified", "payment_sent", "converted", "lost", "deferred"
                ) else "new",
            )
            db.add(lead)
            created += 1

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_rows": len(rows),
        "sheet_name": sheet_name,
    }


@router.delete("/leads/purge", tags=["admin"])
def purge_all_leads(
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """
    Delete ALL leads from the database. This is irreversible.
    Associated call records and follow-ups remain but become orphaned.
    """
    count = db.query(Lead).count()
    # Delete all WhatsApp conversations and messages linked to leads first
    from app.models.models import WhatsAppConversation, WhatsAppMessage
    conv_ids = [c.id for c in db.query(WhatsAppConversation).all()]
    if conv_ids:
        db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
        db.query(WhatsAppConversation).delete(synchronize_session=False)
    # Unlink call records from leads
    db.query(CallRecord).filter(CallRecord.lead_id.isnot(None)).update({"lead_id": None}, synchronize_session=False)
    # Delete all leads
    db.query(Lead).delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}

