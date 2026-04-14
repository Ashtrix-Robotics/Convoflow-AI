from __future__ import annotations
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Form, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import create_db_session, get_db
from app.core.config import settings
from app.core.security import decode_token
from app.models.models import CallRecord, Agent, Lead
from app.schemas.schemas import CallLeadLinkIn, CallRecordOut
from app.services.transcription import extract_edutech_insights, transcribe_audio
from app.services.storage import upload_audio, get_local_temp_path, delete_audio, download_audio, extract_storage_path
from app.services.pabbly import (
    fire_call_analyzed,
    fire_lead_interested,
    fire_lead_callback_scheduled,
    fire_lead_not_interested,
    fire_lead_future_planning,
)
from app.api.deps import get_current_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calls", tags=["calls"])

# Separate router for audio streaming — uses its own auth (header or query param)
# so it can bypass the router-level OAuth2PasswordBearer dependency.
audio_router = APIRouter(prefix="/calls", tags=["calls"])


@router.post("/upload", response_model=CallRecordOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_call(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    client_id: str | None = Form(None),
    lead_id: str | None = Form(None),
    duration_seconds: int | None = Form(None),
    call_tag: str | None = Form(None),
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """Upload a recorded call audio file. Transcription runs in the background."""
    # ── MIME type validation (OWASP: restrict to audio only) ─────────────────
    _ALLOWED_AUDIO_TYPES = {
        "audio/m4a", "audio/mp4", "audio/mpeg", "audio/mp3",
        "audio/ogg", "audio/wav", "audio/webm", "audio/aac",
        "audio/x-m4a", "audio/3gpp",
    }
    content_type = (audio.content_type or "").lower().split(";")[0].strip()
    if content_type not in _ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Only audio files are accepted.",
        )

    content = await audio.read()
    max_bytes = settings.max_audio_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file exceeds {settings.max_audio_size_mb}MB limit",
        )

    # Upload to Supabase Storage (or local fallback) — fully config-driven
    original_name = Path(audio.filename or "recording.m4a").name
    store_result = upload_audio(content, original_name)

    call = CallRecord(
        agent_id=agent.id,
        client_id=client_id,
        lead_id=lead_id,
        audio_file_path=store_result["storage_path"],
        audio_url=store_result["audio_url"],
        audio_storage_backend=store_result["backend"],
        duration_seconds=duration_seconds,
        call_tag=call_tag or "connected",
        status="pending",
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    ext = Path(original_name).suffix or ".m4a"
    background_tasks.add_task(_process_transcription, call.id, content, ext)
    return call


@router.get("", response_model=list[CallRecordOut])
def list_calls(
    skip: int = 0,
    limit: int = 50,
    lead_id: str | None = None,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    q = db.query(CallRecord).filter(CallRecord.agent_id == agent.id)
    if lead_id:
        q = q.filter(CallRecord.lead_id == lead_id)
    return q.order_by(CallRecord.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{call_id}", response_model=CallRecordOut)
def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    call = db.query(CallRecord).filter(
        CallRecord.id == call_id, CallRecord.agent_id == agent.id
    ).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return call


@audio_router.get("/{call_id}/audio")
def stream_call_audio(
    call_id: str,
    request: Request,
    token: str | None = Query(None, description="JWT token (for native audio players)"),
    db: Session = Depends(get_db),
):
    """
    Stream the call audio file via the backend (proxied from Supabase Storage).
    Accepts auth via Authorization header (web) or ?token= query param (mobile).
    """
    # Resolve JWT from header or query param
    jwt_token = token
    if not jwt_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            jwt_token = auth_header[7:]
    if not jwt_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    payload = decode_token(jwt_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    agent = db.query(Agent).filter(Agent.id == payload.get("sub")).first()
    if not agent or not agent.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Agent not found")

    call = db.query(CallRecord).filter(
        CallRecord.id == call_id, CallRecord.agent_id == agent.id
    ).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    # Determine the storage path
    storage_path = call.audio_file_path
    if not storage_path and call.audio_url:
        storage_path = extract_storage_path(call.audio_url)
    if not storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No audio file available")

    try:
        audio_bytes = download_audio(storage_path)
    except Exception as exc:
        logger.error("Failed to download audio %s: %s", storage_path, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve audio file from storage",
        )

    # Determine content type from file extension
    ext = storage_path.rsplit(".", 1)[-1].lower() if "." in storage_path else "m4a"
    content_types = {
        "m4a": "audio/mp4",
        "mp4": "audio/mp4",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "webm": "audio/webm",
        "aac": "audio/aac",
    }
    media_type = content_types.get(ext, "audio/mp4")

    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.patch("/{call_id}/lead", response_model=CallRecordOut)
async def link_call_to_lead(
    call_id: str,
    payload: CallLeadLinkIn,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    call = db.query(CallRecord).filter(
        CallRecord.id == call_id,
        CallRecord.agent_id == agent.id,
    ).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    if call.lead_id == payload.lead_id:
        return call

    if payload.lead_id is None:
        call.lead_id = None
        db.commit()
        db.refresh(call)
        return call

    lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    call.lead_id = lead.id

    if call.status == "completed" and call.transcription:
        insights = await extract_edutech_insights(call.transcription, lead.extra_data)
        if not call.summary:
            call.summary = insights["summary"]
        if not call.action_items:
            call.action_items = insights["action_items"]
        if not call.intent_category or call.intent_category == "undecided":
            call.intent_category = insights["intent_category"]
            call.intent_confidence = insights["intent_confidence"]
            call.sentiment = insights["sentiment"]
        _apply_insights_to_lead(lead, insights)

    db.commit()
    db.refresh(call)
    return call


def _apply_insights_to_lead(lead: Lead, insights: dict) -> dict:
    lead.intent_category = insights.get("intent_category", "undecided")
    lead.intent_confidence = insights.get("intent_confidence", 0.5)
    lead.last_contacted_at = datetime.now(timezone.utc)
    lead.followup_count = (lead.followup_count or 0) + 1
    lead.updated_at = datetime.now(timezone.utc)

    if insights.get("course_interested_in"):
        lead.course_interested_in = insights["course_interested_in"]
    if insights.get("interest_level"):
        lead.interest_level = insights["interest_level"]
    if insights.get("objections"):
        lead.objections = json.dumps(insights["objections"])

    intent = insights.get("intent_category", "undecided")
    status_map = {
        "interested": "qualified",
        "payment_pending": "qualified",
        "callback_requested": "in_progress",
        "not_interested": "lost",
        "future_planning": "deferred",
        "wrong_number": "lost",
        "undecided": "in_progress",
        "no_answer": "contacted",
    }
    lead.status = status_map.get(intent, "contacted")

    if intent == "callback_requested" and insights.get("callback_time"):
        try:
            lead.callback_scheduled_at = datetime.fromisoformat(
                insights["callback_time"].replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            pass

    return {
        "lead_id": lead.id,
        "name": lead.name,
        "phone": lead.phone,
        "email": lead.email or "",
        "source_campaign": lead.source_campaign or "",
        "course_interested_in": lead.course_interested_in or "",
    }


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

async def _process_transcription(call_id: str, audio_bytes: bytes, ext: str):
    """
    Background task: write audio to temp file → transcribe → classify intent
    → update call + lead → fire Pabbly webhook events.
    All failures are caught; call status is set to 'failed' on error.
    """
    db = create_db_session()
    call = db.query(CallRecord).filter(CallRecord.id == call_id).first()
    if not call:
        db.close()
        return

    call.status = "transcribing"
    db.commit()

    tmp_path: str | None = None
    try:
        # Build lead context for AI if a lead is linked
        lead_context = None
        if call.lead_id:
            lead = db.query(Lead).filter(Lead.id == call.lead_id).first()
            if lead and lead.extra_data:
                lead_context = lead.extra_data

        # Write bytes to a local temp file for the STT API
        tmp_path = get_local_temp_path(audio_bytes, ext)
        result = await transcribe_audio(tmp_path, lead_context)

        # ---- Update CallRecord -------------------------------------------------
        call.transcription = result["transcription"]
        call.summary = result["summary"]
        call.action_items = result["action_items"]
        call.intent_category = result["intent_category"]
        call.intent_confidence = result["intent_confidence"]
        call.sentiment = result["sentiment"]
        call.status = "completed"
        db.commit()

        # ---- Update linked Lead ------------------------------------------------
        lead: Lead | None = None
        lead_data: dict = {}
        if call.lead_id:
            lead = db.query(Lead).filter(Lead.id == call.lead_id).first()

        if lead:
            lead_data = _apply_insights_to_lead(lead, result)
            db.commit()

        # ---- Fire Pabbly webhooks ---------------------------------------------
        agent_obj = db.query(Agent).filter(Agent.id == call.agent_id).first()
        agent_name = agent_obj.name if agent_obj else ""
        agent_email = agent_obj.email if agent_obj else ""

        sent = await fire_call_analyzed(
            call_id=call.id,
            lead_data=lead_data,
            insights=result,
            agent_name=agent_name,
            agent_email=agent_email,
        )
        call.pabbly_sent = sent

        intent = result["intent_category"]
        if lead_data:
            payment_url = lead.payment_link_url if lead else None
            if intent in ("interested", "payment_pending"):
                await fire_lead_interested(lead_data, payment_url)
            elif intent == "callback_requested" and result.get("callback_time"):
                await fire_lead_callback_scheduled(lead_data, result["callback_time"], agent_name)
            elif intent == "not_interested":
                await fire_lead_not_interested(lead_data, result.get("objections", []))
            elif intent == "future_planning":
                await fire_lead_future_planning(lead_data, result.get("course_interested_in"))

        db.commit()
        logger.info("Transcription completed for call %s, intent=%s", call_id, intent)

    except Exception:
        logger.exception("Transcription failed for call %s", call_id)
        call.status = "failed"
        db.commit()
    finally:
        db.close()
        # Always clean up temp file
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass
