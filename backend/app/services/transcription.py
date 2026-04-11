from __future__ import annotations
"""
Transcription & EduTech intent-extraction service.

Model strategy (configured via .env — no hardcoding):
  • Audio  → Groq Whisper large-v3-turbo  (GROQ_API_KEY required)
  • LLM    → Vercel AI Gateway            (AI_GATEWAY_API_KEY required)
             Model: AI_GATEWAY_CHAT_MODEL  (default: deepseek/deepseek-chat)
             Change the env var to switch models without redeploying.
"""
import json
import logging
import uuid
from pathlib import Path

import openai

from app.core.config import settings

logger = logging.getLogger(__name__)


def _parse_json_object(content: str) -> dict:
    if not content:
        return {}

    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    try:
        parsed = json.loads(content[start:end + 1])
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# Client factories — built from .env, no hardcoded URLs / keys
# ---------------------------------------------------------------------------

def _get_transcription_client() -> tuple[openai.AsyncOpenAI, str]:
    """Return (client, model) for audio transcription via Groq Whisper."""
    return (
        openai.AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        ),
        settings.groq_whisper_model,
    )


def _get_llm_client() -> tuple[openai.AsyncOpenAI, str, float]:
    """Return (client, model, temperature) for text/LLM tasks via Vercel AI Gateway."""
    return (
        openai.AsyncOpenAI(
            api_key=settings.ai_gateway_api_key,
            base_url=settings.ai_gateway_base_url,
        ),
        settings.ai_gateway_chat_model,
        settings.ai_gateway_temperature,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def transcribe_audio(audio_file_path: str, lead_context: dict | None = None) -> dict:
    """
    Transcribe an audio file then run EduTech intent classification.
    Returns transcription text + structured insights dict.
    """
    # ---- 1. Audio → text via Groq Whisper ---------------------------------
    stt_client, stt_model = _get_transcription_client()
    logger.info("Transcribing with model=%s", stt_model)

    with open(audio_file_path, "rb") as f:
        transcription_resp = await stt_client.audio.transcriptions.create(
            model=stt_model,
            file=f,
            response_format="text",
            prompt=(
                "This is a sales call in English or Tamil between a sales agent "
                "and a prospective student or parent about summer camp and "
                "online/offline classes at an educational institution."
            ),
        )
    raw_text = str(transcription_resp)
    logger.info("Transcription complete, %d chars", len(raw_text))

    # ---- 2. Text → EduTech insights via Vercel AI Gateway ------------------
    insights = await extract_edutech_insights(raw_text, lead_context)

    return {
        "transcription": raw_text,
        **insights,
    }


async def extract_edutech_insights(transcription: str, lead_context: dict | None = None) -> dict:
    """
    Use Vercel AI Gateway (AI_GATEWAY_CHAT_MODEL) to analyse a sales call
    transcription and return structured EduTech intent data used to drive
    Pabbly automations.
    """
    llm_client, llm_model, temperature = _get_llm_client()
    logger.info("Extracting insights with model=%s", llm_model)

    context_block = ""
    if lead_context:
        import json
        context_block = f"""
Lead Context (Campaign Data / Extra Info):
---
{json.dumps(lead_context, indent=2)}
---
"""

    prompt = f"""You are an expert EduTech sales intelligence assistant.
Analyze the following sales call transcription between a sales agent and a lead
(prospective student or parent) about summer camp and online/offline classes.

{context_block}
Transcription:
---
{transcription}
---

Return ONLY valid JSON in this EXACT schema (no markdown, no extra keys):
{{
    "summary": "3-5 sentence executive summary of the call",
    "intent_category": "<one of: interested | not_interested | callback_requested | no_answer | future_planning | payment_pending | wrong_number | undecided>",
    "intent_confidence": <float 0.0-1.0>,
    "callback_time": "<ISO-8601 datetime if they asked for a callback, else null>",
    "interest_level": "<high | medium | low | none>",
    "objections": ["list of objections raised by the lead, if any"],
    "questions_asked": ["specific questions the lead asked"],
    "course_interested_in": "<course or camp name if mentioned, else null>",
    "next_action": "most important single next step the agent should take",
    "payment_ready": <true if the lead expressed readiness to pay, else false>,
    "sentiment": "<positive | neutral | negative>",
    "action_items": ["specific follow-up tasks"]
}}

Classification rules:
- "interested"          → clear interest, asks about details / pricing / scheduling
- "not_interested"      → explicitly declines
- "callback_requested"  → asks agent to call back at a specific time
- "future_planning"     → interested but for a future batch / next year
- "payment_pending"     → ready to pay but needs link / details
- "wrong_number"        → person says they didn't enquire / wrong number
- "undecided"           → unclear intent, neither yes nor no
"""

    try:
        response = await llm_client.chat.completions.create(
            model=llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        result = _parse_json_object(response.choices[0].message.content or "")
        if not result:
            logger.warning("LLM returned unparsable insight payload")
    except Exception as exc:
        logger.error("LLM insight extraction failed: %s", exc)
        result = {}

    return {
        "summary": result.get("summary", ""),
        "action_items": json.dumps(result.get("action_items", [])),
        "intent_category": result.get("intent_category", "undecided"),
        "intent_confidence": float(result.get("intent_confidence", 0.5)),
        "sentiment": result.get("sentiment", "neutral"),
        "callback_time": result.get("callback_time"),
        "interest_level": result.get("interest_level", "low"),
        "objections": result.get("objections", []),
        "questions_asked": result.get("questions_asked", []),
        "course_interested_in": result.get("course_interested_in"),
        "next_action": result.get("next_action", ""),
        "payment_ready": result.get("payment_ready", False),
    }
