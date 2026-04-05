from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_agent
from app.core.database import get_db
from app.models.models import Agent, Lead, WhatsAppConversation, WhatsAppMessage
from app.schemas.schemas import (
    WhatsAppConversationSummaryOut,
    WhatsAppMessageListOut,
    WhatsAppMessageSendIn,
)
from app.services.aisensy import (
    get_lead_conversation,
    get_message_count,
    initiate_lead_campaign,
    process_webhook_notification,
    sync_lead_whatsapp_state,
    verify_webhook_signature,
)

router = APIRouter(tags=["aisensy"])


def _build_conversation_summary(
    db: Session,
    conversation: WhatsAppConversation,
) -> dict:
    return {
        "id": conversation.id,
        "lead_id": conversation.lead_id,
        "phone_number": conversation.phone_number,
        "status": conversation.status,
        "aisensy_contact_id": conversation.aisensy_contact_id,
        "initiation_source": conversation.initiation_source,
        "initiated_at": conversation.initiated_at,
        "first_user_message_at": conversation.first_user_message_at,
        "last_message_at": conversation.last_message_at,
        "last_sync_at": conversation.last_sync_at,
        "is_automated": conversation.is_automated,
        "is_intervened": conversation.is_intervened,
        "is_closed": conversation.is_closed,
        "opted_out": conversation.opted_out,
        "last_inbound_message_preview": conversation.last_inbound_message_preview,
        "last_outbound_message_preview": conversation.last_outbound_message_preview,
        "message_count": get_message_count(db, conversation.id),
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }


@router.post("/integrations/aisensy/webhook", status_code=status.HTTP_202_ACCEPTED)
async def aisensy_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_aisensy_signature: str | None = Header(None),
):
    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, x_aisensy_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid AiSensy webhook signature")

    try:
        notification = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload") from exc

    if not isinstance(notification, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload")

    background_tasks.add_task(process_webhook_notification, notification)
    return {"status": "accepted"}


@router.get("/leads/{lead_id}/whatsapp", response_model=WhatsAppConversationSummaryOut)
def get_lead_whatsapp_summary(
    lead_id: str,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    conversation = get_lead_conversation(db, lead_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WhatsApp conversation not found")
    return _build_conversation_summary(db, conversation)


@router.get("/leads/{lead_id}/whatsapp/messages", response_model=WhatsAppMessageListOut)
def get_lead_whatsapp_messages(
    lead_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    conversation = get_lead_conversation(db, lead_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WhatsApp conversation not found")

    query = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conversation.id)
    total = query.count()
    messages = (
        query.order_by(WhatsAppMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "count": len(messages),
        "skip": skip,
        "limit": limit,
        "has_more": total > skip + len(messages),
        "messages": messages,
    }


@router.post("/leads/{lead_id}/whatsapp/initiate", response_model=WhatsAppConversationSummaryOut)
async def initiate_lead_whatsapp(
    lead_id: str,
    payload: WhatsAppMessageSendIn | None = None,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    conversation = await initiate_lead_campaign(
        db,
        lead,
        initiated_by_agent_id=agent.id,
        force=True,
        campaign_name=payload.template_name if payload else None,
        template_params=payload.template_params if payload else None,
    )
    db.commit()
    db.refresh(conversation)
    return _build_conversation_summary(db, conversation)


@router.post("/leads/{lead_id}/whatsapp/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_lead_whatsapp(
    lead_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    background_tasks.add_task(sync_lead_whatsapp_state, lead_id, False, agent.id)
    return {"status": "accepted"}