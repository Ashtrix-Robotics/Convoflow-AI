# Sending Webhooks — pabbly.py

## Full Implementation

```python
# services/pabbly.py
# Install: pip install httpx
import asyncio
import hashlib
import hmac
import json
import logging
import httpx
from datetime import datetime, timezone
from app.core.config import settings
from app.models.models import CallRecord, FollowUp

logger = logging.getLogger(__name__)


def _sign_payload(payload: dict, secret: str) -> str:
    """HMAC-SHA256 signature over the canonical JSON body."""
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


async def fire_transcription_completed(call: CallRecord) -> None:
    payload = {
        "event": "transcription.completed",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "call_id": str(call.id),
        "agent_id": str(call.agent_id),
        "client_name": call.client.name if call.client else None,
        "summary": call.summary,
        "action_items": call.action_items or [],
        "sentiment": call.sentiment,
        "next_step": call.next_step,
    }
    await _send_with_retry(payload)


async def fire_followup_scheduled(followup: FollowUp) -> None:
    payload = {
        "event": "followup.scheduled",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "followup_id": str(followup.id),
        "call_id": str(followup.call_id),
        "client_name": followup.call.client.name if followup.call.client else None,
        "due_date": followup.due_date.isoformat(),
        "notes": followup.notes,
    }
    await _send_with_retry(payload)


async def _send(payload: dict) -> None:
    signature = _sign_payload(payload, settings.pabbly_webhook_secret)
    headers = {
        "Content-Type": "application/json",
        "X-Pabbly-Signature": signature,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(settings.pabbly_webhook_url, json=payload, headers=headers)
        resp.raise_for_status()


async def _send_with_retry(payload: dict, max_retries: int = 3) -> None:
    """
    Exponential backoff retry. Never raises to the caller — webhook failure
    must not break the API response or background task.
    """
    for attempt in range(max_retries):
        try:
            await _send(payload)
            return
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            if attempt == max_retries - 1:
                logger.error(
                    f"Pabbly webhook failed after {max_retries} attempts "
                    f"(event={payload.get('event')}): {exc}"
                )
                return
            await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s
```

---

## Payload Signing — Why & How

Every outbound payload is signed with HMAC-SHA256 using `PABBLY_WEBHOOK_SECRET`.
The signature is sent in the `X-Pabbly-Signature` header.

Key points:

- `sort_keys=True` and `separators=(",",":")` ensure canonical JSON — the same dict always
  produces the same signature regardless of key insertion order
- The secret is never sent in the payload
- Rotate the secret in `.env` without changing code

---

## Inbound Signature Verification

If you add a Pabbly workflow that POSTs back to your FastAPI (e.g., a processed result or
an external event trigger), verify the signature before processing:

```python
# api/webhooks.py
import hashlib, hmac, json
from fastapi import APIRouter, Request, HTTPException
from app.core.config import settings

router = APIRouter()

@router.post("/webhooks/pabbly")
async def receive_pabbly(request: Request):
    body = await request.body()
    sig = request.headers.get("X-Pabbly-Signature", "")
    expected = hmac.new(
        settings.pabbly_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    # Use compare_digest to prevent timing attacks
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")
    data = json.loads(body)
    # process data...
```

> **Always use `hmac.compare_digest`** — never `==` for signature comparison.
> String equality short-circuits on the first differing character, allowing timing
> attacks that can leak the secret byte by byte.

---

## Environment Variables

```env
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/workflow/sendwebhookdata/XXXXXXX
PABBLY_WEBHOOK_SECRET=your-32-char-random-secret
```

Generate a strong secret: `python -c "import secrets; print(secrets.token_hex(32))"`

**Never hardcode** these values. They can be rotated in `.env` without code changes.
