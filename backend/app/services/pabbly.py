from __future__ import annotations
"""
Pabbly Connect webhook service — fires outbound events that trigger automations
(WhatsApp, email, Google Sheets sync, calendar, etc.)
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Generic event sender
# ---------------------------------------------------------------------------

async def fire_event(event_type: str, data: dict) -> bool:
    """
    Send an event payload to the Pabbly Connect webhook URL.
    Returns True if delivery succeeded, False otherwise.
    Never raises — callers should not fail because of webhook issues.
    """
    if not settings.pabbly_webhook_url:
        logger.warning("Pabbly webhook URL not configured — skipping event %s", event_type)
        return False

    payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }

    payload_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    signature = _sign_payload(payload_json)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                settings.pabbly_webhook_url,
                content=payload_json,
                headers={
                    "Content-Type": "application/json",
                    "X-Pabbly-Signature": signature,
                    "X-Pabbly-Event": event_type,
                },
            )
            success = response.status_code < 400
            if not success:
                logger.error("Pabbly webhook %s failed: %d", event_type, response.status_code)
            return success
    except Exception:
        logger.exception("Pabbly webhook %s delivery error", event_type)
        return False


# ---------------------------------------------------------------------------
# Convenience wrappers for specific events
# ---------------------------------------------------------------------------

async def fire_call_analyzed(
    call_id: str,
    lead_data: dict,
    insights: dict,
    agent_name: str,
    agent_email: str,
) -> bool:
    """Fired after transcription + AI intent classification completes."""
    return await fire_event("call.analyzed", {
        "call_id": call_id,
        "agent_name": agent_name,
        "agent_email": agent_email,
        **lead_data,
        "summary": insights.get("summary", ""),
        "action_items": insights.get("action_items", "[]"),
        "intent_category": insights.get("intent_category", "undecided"),
        "intent_confidence": insights.get("intent_confidence", 0.5),
        "sentiment": insights.get("sentiment", "neutral"),
        "interest_level": insights.get("interest_level", "low"),
        "next_action": insights.get("next_action", ""),
        "payment_ready": insights.get("payment_ready", False),
        "course_interested_in": insights.get("course_interested_in", ""),
        "callback_time": insights.get("callback_time"),
        "objections": json.dumps(insights.get("objections", [])),
    })


async def fire_lead_interested(lead_data: dict, payment_link: str | None = None) -> bool:
    """Fired when AI classifies lead as interested — triggers WA course details + email."""
    data = {**lead_data}
    if payment_link:
        data["payment_link_url"] = payment_link
    return await fire_event("lead.interested", data)


async def fire_lead_callback_scheduled(lead_data: dict, callback_time: str, agent_name: str) -> bool:
    """Fired when AI detects callback request — triggers calendar + WA confirmation."""
    return await fire_event("lead.callback_scheduled", {
        **lead_data,
        "callback_time": callback_time,
        "agent_name": agent_name,
    })


async def fire_lead_not_interested(lead_data: dict, objections: list[str]) -> bool:
    """Fired when AI classifies not interested — triggers Sheet update + 30-day drip."""
    return await fire_event("lead.not_interested", {
        **lead_data,
        "objections": json.dumps(objections),
    })


async def fire_lead_future_planning(lead_data: dict, course: str | None = None) -> bool:
    """Fired when lead wants next batch/year — triggers nurture sequence."""
    return await fire_event("lead.future_planning", {
        **lead_data,
        "course_interested_in": course or "",
    })


# ---------------------------------------------------------------------------
# Legacy convenience wrappers (kept for backward compat)
# ---------------------------------------------------------------------------

async def send_transcription_webhook(call_data: dict) -> bool:
    return await fire_event("transcription.completed", call_data)


async def send_followup_webhook(followup_data: dict) -> bool:
    return await fire_event("followup.scheduled", followup_data)


# ---------------------------------------------------------------------------
# Signing
# ---------------------------------------------------------------------------

def _sign_payload(payload: str) -> str:
    """HMAC-SHA256 signature for Pabbly webhook verification."""
    return hmac.new(
        settings.pabbly_secret_key.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
