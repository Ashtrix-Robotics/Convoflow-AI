from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import openai
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import create_db_session
from app.models.models import AisensyWebhookEvent, AppSetting, CampaignKnowledge, Lead, WhatsAppConversation, WhatsAppMessage
from app.services.phone_numbers import format_phone_e164, normalize_phone_number, phones_match

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json_dumps(payload: dict) -> str:
    return json.dumps(payload, default=str, separators=(",", ":"), sort_keys=True)


def _safe_json_loads(content: str) -> dict:
    if not content:
        return {}
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _coerce_datetime(value) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp /= 1000.0
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            if value.isdigit():
                return _coerce_datetime(int(value))
    return None


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    if not settings.aisensy_webhook_secret:
        return True
    if not signature:
        return False
    expected = hmac.new(
        settings.aisensy_webhook_secret.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_lead_conversation(db: Session, lead_id: str) -> WhatsAppConversation | None:
    return db.query(WhatsAppConversation).filter(WhatsAppConversation.lead_id == lead_id).first()


def get_message_count(db: Session, conversation_id: str) -> int:
    return db.query(func.count(WhatsAppMessage.id)).filter(WhatsAppMessage.conversation_id == conversation_id).scalar() or 0


def upsert_conversation(db: Session, lead: Lead, contact_id: str | None = None) -> WhatsAppConversation:
    normalized_phone = normalize_phone_number(lead.phone, settings.aisensy_default_country_code)
    conversation = get_lead_conversation(db, lead.id)
    if not conversation and contact_id:
        conversation = (
            db.query(WhatsAppConversation)
            .filter(WhatsAppConversation.aisensy_contact_id == contact_id)
            .first()
        )
    if not conversation:
        conversation = WhatsAppConversation(
            lead_id=lead.id,
            phone_number=normalized_phone,
        )
        db.add(conversation)
    conversation.phone_number = normalized_phone
    if contact_id:
        conversation.aisensy_contact_id = contact_id
    conversation.updated_at = _utcnow()
    return conversation


def find_matching_lead(db: Session, phone_number: str) -> Lead | None:
    normalized_phone = normalize_phone_number(phone_number, settings.aisensy_default_country_code)
    if not normalized_phone:
        return None

    candidate_suffix = normalized_phone[-10:]
    candidates = db.query(Lead).filter(Lead.phone.like(f"%{candidate_suffix}%")).all()
    return next(
        (
            lead for lead in candidates
            if phones_match(lead.phone, normalized_phone, settings.aisensy_default_country_code)
        ),
        None,
    )


def _extract_contact(payload: dict) -> dict:
    if isinstance(payload.get("contact"), dict):
        return payload["contact"]
    if isinstance(payload.get("data"), dict) and isinstance(payload["data"].get("contact"), dict):
        return payload["data"]["contact"]
    if isinstance(payload.get("data"), dict) and payload["data"].get("phone_number"):
        return payload["data"]
    return {}


def _extract_message(payload: dict) -> dict:
    if isinstance(payload.get("message"), dict):
        return payload["message"]
    if isinstance(payload.get("data"), dict) and isinstance(payload["data"].get("message"), dict):
        return payload["data"]["message"]
    return {}


def _extract_lookup_state(payload: dict) -> dict:
    contact = _extract_contact(payload)
    first_message = contact.get("first_message") or {}
    messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
    first_user_message_at = _coerce_datetime(
        first_message.get("added_at")
        or payload.get("first_user_message_at")
        or payload.get("last_active")
    )
    has_existing_chat = bool(
        first_user_message_at
        or contact.get("has_user_initiated")
        or contact.get("initiated_by_customer")
        or any((message or {}).get("sender") == "USER" for message in messages)
    )
    return {
        "contact_id": contact.get("id") or payload.get("contact_id"),
        "phone_number": contact.get("phone_number") or payload.get("phone_number"),
        "first_user_message_at": first_user_message_at,
        "last_message_at": _coerce_datetime(contact.get("last_message") or payload.get("last_message")),
        "is_intervened": bool(contact.get("is_intervened")),
        "is_closed": bool(contact.get("is_closed")),
        "has_existing_chat": has_existing_chat,
    }


async def lookup_contact_by_phone(phone_number: str, lead_name: str | None = None) -> dict | None:
    if not settings.use_aisensy_lookup:
        return None

    method = settings.aisensy_lookup_method.upper().strip() or "GET"
    destination = format_phone_e164(phone_number, settings.aisensy_default_country_code)
    url = settings.aisensy_lookup_url.format(phone=destination, name=lead_name or "")
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {settings.aisensy_api_key}",
        "X-AiSensy-API-Key": settings.aisensy_api_key,
    }

    params = None
    json_payload = None
    if method == "GET":
        if "{phone" not in settings.aisensy_lookup_url and "{name" not in settings.aisensy_lookup_url:
            params = {"phone_number": destination}
            if lead_name:
                params["name"] = lead_name
    else:
        json_payload = {"phone_number": destination, "apiKey": settings.aisensy_api_key}
        if lead_name:
            json_payload["name"] = lead_name

    try:
        async with httpx.AsyncClient(timeout=settings.aisensy_request_timeout_seconds) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_payload,
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else None
    except Exception as exc:
        logger.warning("AiSensy lookup failed for %s: %s", destination, exc)
        return None


async def send_first_campaign(
    lead: Lead,
    campaign_name: str | None = None,
    template_params: list[str] | None = None,
) -> tuple[bool, dict]:
    selected_campaign = campaign_name or settings.aisensy_first_campaign_name
    if not settings.use_aisensy or not selected_campaign:
        return False, {"detail": "AiSensy campaign sending is not configured."}
    if not settings.allow_aisensy_outbound:
        return False, {"detail": "Outbound WhatsApp sending is disabled until approved."}

    payload: dict = {
        "apiKey": settings.aisensy_api_key,
        "campaignName": selected_campaign,
        "destination": format_phone_e164(lead.phone, settings.aisensy_default_country_code),
        "userName": lead.name,
        "source": lead.source_campaign or "Convoflow AI",
        "attributes": {
            "lead_id": lead.id,
            "lead_status": lead.status,
        },
    }
    if template_params:
        payload["templateParams"] = template_params

    try:
        async with httpx.AsyncClient(timeout=settings.aisensy_request_timeout_seconds) as client:
            response = await client.post(
                settings.aisensy_campaign_url,
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            content = _safe_json_loads(response.text)
            if response.status_code >= 400:
                content.setdefault("detail", response.text or f"HTTP {response.status_code}")
                return False, content
            return True, content or {"status_code": response.status_code}
    except Exception as exc:
        logger.warning("AiSensy campaign send failed for lead %s: %s", lead.id, exc)
        return False, {"detail": str(exc)}


async def initiate_lead_campaign(
    db: Session,
    lead: Lead,
    initiated_by_agent_id: str | None = None,
    force: bool = False,
    campaign_name: str | None = None,
    template_params: list[str] | None = None,
) -> WhatsAppConversation:
    conversation = upsert_conversation(db, lead)
    selected_campaign = campaign_name or settings.aisensy_first_campaign_name

    if not settings.use_aisensy or not selected_campaign:
        conversation.status = "campaign_unconfigured"
        conversation.last_sync_at = _utcnow()
        conversation.is_automated = False
        return conversation

    if not settings.allow_aisensy_outbound:
        conversation.initiated_by_agent_id = initiated_by_agent_id or conversation.initiated_by_agent_id
        conversation.initiation_source = conversation.initiation_source or "lead_import"
        conversation.last_sync_at = _utcnow()
        conversation.status = "awaiting_approval"
        conversation.is_automated = False
        return conversation

    existing_template = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conversation.id,
            WhatsAppMessage.direction == "outbound",
            WhatsAppMessage.message_type == "template",
            WhatsAppMessage.campaign_name == selected_campaign,
        )
        .first()
    )
    if existing_template and not force:
        conversation.status = conversation.status or "awaiting_reply"
        return conversation

    success, provider_payload = await send_first_campaign(
        lead,
        campaign_name=selected_campaign,
        template_params=template_params,
    )
    message = WhatsAppMessage(
        conversation_id=conversation.id,
        direction="outbound",
        sender_type="SYSTEM",
        message_type="template",
        status="sent" if success else "failed",
        campaign_name=selected_campaign,
        template_name=selected_campaign,
        content=selected_campaign,
        failure_reason=None if success else provider_payload.get("detail"),
        raw_payload=_json_dumps(provider_payload),
        sent_at=_utcnow() if success else None,
    )
    db.add(message)

    conversation.initiated_by_agent_id = initiated_by_agent_id or conversation.initiated_by_agent_id
    conversation.initiated_at = _utcnow()
    conversation.initiation_source = conversation.initiation_source or "lead_import"
    conversation.last_outbound_message_preview = selected_campaign
    conversation.last_message_at = message.sent_at or conversation.last_message_at
    conversation.last_sync_at = _utcnow()
    conversation.status = "awaiting_reply" if success else "template_failed"
    conversation.is_automated = False
    return conversation


def _get_app_setting(db: Session, key: str, default: str = "") -> str:
    """Read a value from the app_settings table."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


async def sync_lead_whatsapp_state(
    lead_id: str,
    force_template_send: bool = False,
    initiated_by_agent_id: str | None = None,
) -> None:
    db = create_db_session()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return

        conversation = upsert_conversation(db, lead)
        conversation.last_sync_at = _utcnow()

        if not settings.use_aisensy:
            conversation.status = "disabled"
            db.commit()
            return

        # ── Check admin Auto WhatsApp Mode toggle ──────────────────────────
        auto_mode = _get_app_setting(db, "auto_whatsapp_mode", "false").lower() == "true"
        if not auto_mode and not force_template_send:
            # Auto mode is OFF — just record state, don't send anything
            conversation.status = "auto_mode_disabled"
            conversation.is_automated = False
            db.commit()
            return

        # ── Contact lookup (check if existing chat) ────────────────────────
        lookup_payload = await lookup_contact_by_phone(lead.phone, lead.name)
        if lookup_payload:
            lookup_state = _extract_lookup_state(lookup_payload)
            conversation = upsert_conversation(db, lead, lookup_state.get("contact_id"))
            conversation.is_intervened = lookup_state["is_intervened"]
            conversation.is_closed = lookup_state["is_closed"]
            conversation.first_user_message_at = lookup_state["first_user_message_at"] or conversation.first_user_message_at
            conversation.last_message_at = lookup_state["last_message_at"] or conversation.last_message_at
            if lookup_state["has_existing_chat"]:
                conversation.status = "existing_chat"
                conversation.is_automated = True
                db.commit()
                return

        # ── Outbound approval gate (env-level hard switch) ─────────────────
        if not settings.allow_aisensy_outbound:
            conversation.status = "awaiting_approval"
            conversation.is_automated = False
            db.commit()
            return

        if settings.use_aisensy_campaigns:
            # Use per-campaign override from admin settings if set
            override_campaign = _get_app_setting(db, "auto_whatsapp_campaign", "").strip() or None
            await initiate_lead_campaign(
                db,
                lead,
                initiated_by_agent_id=initiated_by_agent_id,
                force=force_template_send,
                campaign_name=override_campaign,
            )
        else:
            conversation.status = "lookup_unavailable" if not lookup_payload else "lookup_complete"

        db.commit()
    except Exception:
        logger.exception("AiSensy lead sync failed for lead %s", lead_id)
        db.rollback()
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# AI Conversation Reply Pipeline
# ─────────────────────────────────────────────────────────────────────────────

async def send_session_message(phone_number: str, text: str) -> bool:
    """
    Send a free-text (session) message to a WhatsApp user via AiSensy Project API.
    This is used for AI-generated conversational replies — NOT template messages.
    Requires AISENSY_PROJECT_ID + AISENSY_PROJECT_API_PWD in .env.
    Only works within the 24-hour customer service window after the user last messaged.
    """
    if not settings.use_aisensy_project_api:
        logger.warning("AiSensy Project API creds missing — cannot send session message")
        return False

    destination = format_phone_e164(phone_number, settings.aisensy_default_country_code)
    url = f"{settings.aisensy_project_api_url}/{settings.aisensy_project_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": destination,
        "type": "text",
        "text": {"body": text},
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-AiSensy-Project-API-Pwd": settings.aisensy_project_api_pwd,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.aisensy_request_timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.warning("AiSensy Project API send failed: %s %s", response.status_code, response.text[:300])
                return False
            return True
    except Exception as exc:
        logger.warning("AiSensy Project API send exception: %s", exc)
        return False


def _load_default_campaign_knowledge(db: Session) -> Optional[CampaignKnowledge]:
    """Return the default CampaignKnowledge record, or the first active one."""
    return (
        db.query(CampaignKnowledge)
        .filter(CampaignKnowledge.is_active == True, CampaignKnowledge.is_default == True)  # noqa: E712
        .first()
        or db.query(CampaignKnowledge)
        .filter(CampaignKnowledge.is_active == True)  # noqa: E712
        .first()
    )


def _build_conversation_history(db: Session, conversation_id: str, max_messages: int = 10) -> list[dict]:
    """Return the last N messages as [{"role":"user"|"assistant", "content":"..."}]."""
    messages = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conversation_id,
            WhatsAppMessage.content.isnot(None),
        )
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(max_messages)
        .all()
    )
    history = []
    for msg in reversed(messages):
        role = "user" if msg.direction == "inbound" else "assistant"
        if msg.content:
            history.append({"role": role, "content": msg.content})
    return history


def _build_ai_system_prompt(lead: Lead, knowledge: Optional[CampaignKnowledge]) -> str:
    """Build the GPT system prompt combining lead context + campaign knowledge."""
    parts = []

    if knowledge and knowledge.ai_persona_prompt:
        parts.append(knowledge.ai_persona_prompt.strip())
    else:
        parts.append(
            "You are a helpful and friendly sales assistant communicating with a potential customer via WhatsApp. "
            "Keep replies concise (2-4 sentences max), conversational, and focused on helping the customer."
        )

    parts.append(f"\nLead name: {lead.name}")
    if lead.phone:
        parts.append(f"Lead phone: {lead.phone}")
    if lead.source_campaign:
        parts.append(f"Lead source: {lead.source_campaign}")
    if lead.notes:
        parts.append(f"Notes about this lead: {lead.notes}")

    if knowledge:
        if knowledge.product_name:
            parts.append(f"\nProduct/Service: {knowledge.product_name}")
        if knowledge.product_description:
            parts.append(f"Description: {knowledge.product_description}")
        if knowledge.key_selling_points:
            parts.append(f"Key selling points: {knowledge.key_selling_points}")
        if knowledge.pricing_info:
            parts.append(f"Pricing: {knowledge.pricing_info}")
        if knowledge.target_audience:
            parts.append(f"Target audience: {knowledge.target_audience}")
        if knowledge.tone:
            tone_map = {
                "friendly": "warm and friendly",
                "professional": "professional and formal",
                "casual": "casual and relaxed",
                "energetic": "enthusiastic and energetic",
            }
            parts.append(f"Tone: {tone_map.get(knowledge.tone, knowledge.tone)}")
        if knowledge.faq_json:
            try:
                faqs = json.loads(knowledge.faq_json)
                if faqs:
                    faq_text = "\n".join(
                        f"Q: {faq.get('question', '')}\nA: {faq.get('answer', '')}"
                        for faq in faqs if faq.get("question")
                    )
                    if faq_text:
                        parts.append(f"\nFrequently Asked Questions:\n{faq_text}")
            except json.JSONDecodeError:
                pass
        if knowledge.objections_json:
            try:
                objections = json.loads(knowledge.objections_json)
                if objections:
                    obj_text = "\n".join(
                        f"Objection: {o.get('objection', '')}\nHandling: {o.get('handling', '')}"
                        for o in objections if o.get("objection")
                    )
                    if obj_text:
                        parts.append(f"\nHandling Common Objections:\n{obj_text}")
            except json.JSONDecodeError:
                pass

    parts.append(
        "\nIMPORTANT RULES:\n"
        "- Reply ONLY in the same language the customer uses (English or Tamil).\n"
        "- Never reveal you are an AI unless directly asked.\n"
        "- Keep replies under 150 words — this is a WhatsApp conversation.\n"
        "- If the customer wants to speak to a human, say: 'I'll connect you with our team shortly. Please hold on!'\n"
        "- Do NOT hallucinate pricing or program details not provided above."
    )

    return "\n".join(parts)


async def _call_llm_for_reply(system_prompt: str, history: list[dict], user_message: str) -> Optional[str]:
    """Call LLM (DeepSeek V3 → AI Gateway fallback) and return the AI reply text."""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # Use DeepSeek if available, else Vercel AI Gateway (gpt-4o-mini)
    if settings.use_deepseek:
        client = openai.AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        model = settings.deepseek_chat_model
        temperature = settings.deepseek_temperature
    else:
        client = openai.AsyncOpenAI(
            api_key=settings.ai_gateway_api_key,
            base_url=settings.ai_gateway_base_url,
        )
        model = settings.ai_gateway_chat_model
        temperature = settings.ai_gateway_temperature

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=300,
        )
        return (response.choices[0].message.content or "").strip() or None
    except Exception as exc:
        logger.warning("LLM call failed for WhatsApp reply: %s", exc)
        return None


async def generate_and_send_ai_reply(
    db: Session,
    lead: Lead,
    conversation: WhatsAppConversation,
    user_message: str,
    phone_number: str,
) -> bool:
    """
    Full pipeline: load context → call LLM → send reply via AiSensy Project API.
    Returns True if a reply was successfully sent.
    """
    if not settings.use_aisensy_project_api:
        logger.debug("Skipping AI reply — Project API not configured")
        return False

    ai_reply_enabled = _get_app_setting(db, "whatsapp_reply_ai_enabled", "false").lower() == "true"
    if not ai_reply_enabled:
        logger.debug("Skipping AI reply — whatsapp_reply_ai_enabled is OFF in admin settings")
        return False

    knowledge = _load_default_campaign_knowledge(db)
    history = _build_conversation_history(db, conversation.id, max_messages=8)
    system_prompt = _build_ai_system_prompt(lead, knowledge)

    ai_text = await _call_llm_for_reply(system_prompt, history, user_message)
    if not ai_text:
        logger.warning("LLM returned empty reply for lead %s", lead.id)
        return False

    sent = await send_session_message(phone_number, ai_text)
    if sent:
        ai_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="outbound",
            sender_type="AI",
            message_type="TEXT",
            content=ai_text,
            status="sent",
            sent_at=_utcnow(),
            raw_payload=_json_dumps({"ai_generated": True, "model": "llm"}),
        )
        db.add(ai_msg)
        conversation.last_outbound_message_preview = ai_text[:200]
        conversation.last_message_at = _utcnow()
        logger.info("AI reply sent to lead %s (%s chars)", lead.id, len(ai_text))
    else:
        logger.warning("AI reply generation succeeded but Project API send failed for lead %s", lead.id)

    return sent


def _notification_id(notification: dict, message: dict) -> str:
    if notification.get("id"):
        return str(notification["id"])
    if message.get("messageId"):
        return f"msg:{message['messageId']}"
    return f"topic:{notification.get('topic', 'unknown')}:{normalize_phone_number(message.get('phone_number') or '')}"


def _upsert_message_from_payload(
    db: Session,
    conversation: WhatsAppConversation,
    message_payload: dict,
) -> WhatsAppMessage:
    provider_message_id = message_payload.get("messageId") or message_payload.get("id")
    message = None
    if provider_message_id:
        message = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.aisensy_message_id == str(provider_message_id))
            .first()
        )

    if not message:
        sender = str(message_payload.get("sender") or "").upper()
        direction = "inbound" if sender == "USER" else "outbound"
        content = message_payload.get("text")
        if not content and isinstance(message_payload.get("message_content"), dict):
            content = json.dumps(message_payload["message_content"], default=str)
        message = WhatsAppMessage(
            conversation_id=conversation.id,
            aisensy_message_id=str(provider_message_id) if provider_message_id else None,
            direction=direction,
            sender_type=sender or None,
            message_type=message_payload.get("message_type"),
            content=content,
            campaign_name=(message_payload.get("campaign") or {}).get("name") if isinstance(message_payload.get("campaign"), dict) else None,
            status=(message_payload.get("status") or "received").lower(),
            raw_payload=_json_dumps(message_payload),
            sent_at=_coerce_datetime(message_payload.get("sent_at")),
            delivered_at=_coerce_datetime(message_payload.get("delivered_at")),
            read_at=_coerce_datetime(message_payload.get("read_at")),
            failure_reason=(message_payload.get("failureResponse") or {}).get("reason") if isinstance(message_payload.get("failureResponse"), dict) else None,
        )
        db.add(message)
    else:
        message.status = (message_payload.get("status") or message.status or "received").lower()
        message.delivered_at = _coerce_datetime(message_payload.get("delivered_at")) or message.delivered_at
        message.read_at = _coerce_datetime(message_payload.get("read_at")) or message.read_at
        if isinstance(message_payload.get("failureResponse"), dict):
            message.failure_reason = message_payload["failureResponse"].get("reason") or message.failure_reason
        message.raw_payload = _json_dumps(message_payload)
    return message


async def process_webhook_notification(notification: dict) -> None:
    db = create_db_session()
    try:
        topic = str(notification.get("topic") or "unknown")
        message_payload = _extract_message(notification)
        event_id = _notification_id(notification, message_payload)

        existing_event = db.query(AisensyWebhookEvent).filter(AisensyWebhookEvent.id == event_id).first()
        if existing_event:
            existing_event.delivery_attempt = max(existing_event.delivery_attempt, int(notification.get("delivery_attempt") or 1))
            db.commit()
            return

        event = AisensyWebhookEvent(
            id=event_id,
            topic=topic,
            project_id=notification.get("project_id"),
            delivery_attempt=int(notification.get("delivery_attempt") or 1),
            payload_json=_json_dumps(notification),
        )
        db.add(event)
        db.flush()

        contact = _extract_contact(notification)
        phone_number = contact.get("phone_number") or message_payload.get("phone_number")
        lead = find_matching_lead(db, phone_number) if phone_number else None
        if not lead:
            event.status = "ignored"
            event.processed_at = _utcnow()
            db.commit()
            return

        conversation = upsert_conversation(db, lead, contact.get("id") or message_payload.get("contact_id"))
        conversation.last_sync_at = _utcnow()

        if topic == "contact.first_message.updated":
            first_message = notification.get("data", {}).get("first_message", {}) if isinstance(notification.get("data"), dict) else {}
            conversation.first_user_message_at = _coerce_datetime(first_message.get("added_at")) or conversation.first_user_message_at
            conversation.status = "existing_chat"
            conversation.is_automated = True
        elif topic == "message.sender.user":
            message = _upsert_message_from_payload(db, conversation, message_payload)
            conversation.first_user_message_at = message.created_at if not conversation.first_user_message_at else conversation.first_user_message_at
            conversation.last_message_at = message.created_at
            conversation.last_inbound_message_preview = message.content
            conversation.status = "active"
            conversation.is_automated = True
            db.commit()  # Commit before AI call so message is saved even if AI fails

            # ── AI auto-reply ──────────────────────────────────────────────
            if message.content and lead:
                phone = (
                    contact.get("phone_number")
                    or message_payload.get("phone_number")
                    or lead.phone
                )
                await generate_and_send_ai_reply(
                    db, lead, conversation, message.content, phone
                )
            db.commit()
            return  # already committed above
        elif topic == "message.created":
            message = _upsert_message_from_payload(db, conversation, message_payload)
            conversation.last_message_at = message.created_at
            if message.direction == "inbound":
                conversation.last_inbound_message_preview = message.content
                conversation.first_user_message_at = conversation.first_user_message_at or message.created_at
                conversation.status = "active"
                conversation.is_automated = True
            else:
                conversation.last_outbound_message_preview = message.content or message.campaign_name
        elif topic == "message.status.updated":
            message = _upsert_message_from_payload(db, conversation, message_payload)
            conversation.last_outbound_message_preview = message.content or message.campaign_name or conversation.last_outbound_message_preview
        elif topic == "contact.chat.intervened":
            conversation.is_intervened = True
            conversation.status = "human_intervened"
        elif topic == "contact.chat.closed":
            conversation.is_closed = True
            conversation.status = "closed"
        elif topic == "contact.created":
            conversation.status = conversation.status or "lookup_complete"

        event.status = "processed"
        event.processed_at = _utcnow()
        db.commit()
    except Exception as exc:
        logger.exception("Failed to process AiSensy webhook topic=%s", notification.get("topic"))
        db.rollback()
        try:
            event_id = _notification_id(notification, _extract_message(notification))
            event = db.query(AisensyWebhookEvent).filter(AisensyWebhookEvent.id == event_id).first()
            if event:
                event.status = "failed"
                event.error_message = str(exc)
                event.processed_at = _utcnow()
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()