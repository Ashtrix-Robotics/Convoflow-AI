# Routes — File Upload & Background Tasks

## Audio Upload Route (api/calls.py)

```python
import os
import uuid
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException
from app.api.deps import AgentDep, DBDep
from app.models.models import CallRecord
from app.core.config import settings
from app.services.transcription import process_transcription

router = APIRouter()

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp4", "audio/m4a",
    "audio/wav", "audio/webm", "audio/ogg",
}

@router.post("/upload", status_code=202)
async def upload_call(
    audio: UploadFile,
    background_tasks: BackgroundTasks,
    agent: AgentDep,
    db: DBDep,
    client_id: str | None = None,
):
    # 1. Validate MIME type (check the declared content-type)
    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported audio format")

    # 2. Read and enforce size limit
    content = await audio.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_audio_size_mb:
        raise HTTPException(status_code=413, detail="File too large")

    # 3. Save to upload directory with UUID filename (no original filename in path)
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(audio.filename or "")[1] or ".m4a"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    # 4. Create DB record — status starts as "pending"
    call = CallRecord(
        id=str(uuid.uuid4()),
        agent_id=str(agent.id),
        client_id=client_id,
        audio_filename=filename,
        status="pending",
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    # 5. Queue background transcription and return 202 immediately
    background_tasks.add_task(process_transcription, call.id, filepath)
    return call
```

> **Why 202?** Transcription takes 5-60 seconds. Returning `202 Accepted` immediately lets
> the mobile app poll `GET /calls/{id}` every 3 seconds until `status == "completed"`.
> The client never blocks waiting for OpenAI.

---

## Background Transcription Task (services/transcription.py)

```python
import os
import logging
from app.core.database import SessionLocal
from app.models.models import CallRecord
from app.services.transcription import transcribe_audio, extract_insights
from app.services.pabbly import fire_transcription_completed

logger = logging.getLogger(__name__)

async def process_transcription(call_id: str, file_path: str):
    """
    Runs in FastAPI BackgroundTasks thread pool.
    Critical: never raise unhandled exceptions — they are silently swallowed
    and the call will remain stuck in 'transcribing' status.
    """
    db = SessionLocal()
    try:
        call = db.query(CallRecord).filter_by(id=call_id).first()
        call.status = "transcribing"
        db.commit()

        # AI work (OpenAI Whisper + GPT-4) — see transcription-ai skill
        transcript = await transcribe_audio(file_path)
        insights   = await extract_insights(transcript)

        call.raw_transcript = transcript
        call.summary        = insights.get("summary")
        call.action_items   = insights.get("action_items", [])
        call.sentiment      = insights.get("sentiment")
        call.next_step      = insights.get("next_step")
        call.status         = "completed"
        db.commit()

        # Fire Pabbly webhook (non-blocking, does not raise on failure)
        await fire_transcription_completed(call)

    except Exception as exc:
        logger.error(f"Transcription failed for {call_id}: {exc}", exc_info=True)
        if db:
            call = db.query(CallRecord).filter_by(id=call_id).first()
            if call:
                call.status = "failed"
                db.commit()
    finally:
        db.close()
        if os.path.exists(file_path):
            os.remove(file_path)  # Clean up audio file after processing
```

### BackgroundTasks Rules

- **Catch everything** — uncaught exceptions in background tasks are silently dropped by FastAPI
- **Open a new `SessionLocal()`** — the request's `db` session is closed by the time the task runs
- **Always close the db** in `finally` — background tasks don't have request lifecycle cleanup
- **Always delete the file** in `finally` — prevents disk filling up if transcription repeatedly fails
- **Never re-raise** — set `status = "failed"` and log; let the agent retry via the UI

> **Scaling note**: `BackgroundTasks` runs in FastAPI's thread pool — fine for light async work
> like calling OpenAI APIs. For CPU-heavy processing or guaranteed delivery, use Celery + Redis.

---

## Read / List Calls

```python
@router.get("/calls", response_model=list[CallRecordOut])
def list_calls(agent: AgentDep, db: DBDep):
    return (
        db.query(CallRecord)
        .filter_by(agent_id=agent.id)
        .order_by(CallRecord.created_at.desc())
        .all()
    )

@router.get("/calls/{call_id}", response_model=CallRecordOut)
def get_call(call_id: str, agent: AgentDep, db: DBDep):
    call = (
        db.query(CallRecord)
        .filter_by(id=call_id, agent_id=agent.id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call
```

The mobile app polls `GET /calls/{call_id}` every 3 seconds using TanStack Query's
`refetchInterval` until `status` is `"completed"` or `"failed"`.

---

## Follow-up Routes (api/followups.py)

```python
@router.post("/followups", response_model=FollowUpOut, status_code=201)
async def create_followup(body: FollowUpCreate, agent: AgentDep, db: DBDep):
    followup = FollowUp(
        id=str(uuid.uuid4()),
        agent_id=str(agent.id),
        **body.model_dump(),
    )
    db.add(followup); db.commit(); db.refresh(followup)
    # Trigger Pabbly webhook — fire-and-forget
    await fire_followup_scheduled(followup)
    return followup

@router.patch("/followups/{followup_id}/complete", response_model=FollowUpOut)
def complete_followup(followup_id: str, agent: AgentDep, db: DBDep):
    fu = db.query(FollowUp).filter_by(id=followup_id, agent_id=agent.id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    fu.completed = True
    db.commit(); db.refresh(fu)
    return fu
```
