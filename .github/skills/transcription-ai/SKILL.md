---
name: transcription-ai
description: "Use this skill for all AI transcription work in the Convoflow AI project. Covers OpenAI Whisper (whisper-1), gpt-4o-transcribe, gpt-4o-mini-transcribe, speaker diarization (gpt-4o-transcribe-diarize), streaming transcription, audio chunking for files >25MB, GPT-4 insight extraction (summary + action items), and async FastAPI background task patterns. Trigger when working on: backend/app/services/transcription.py, audio processing, AI summarization, or any transcription-related feature."
---

# AI Transcription Skill — Convoflow AI

## Project Context

Audio files uploaded by agents are transcribed using the OpenAI Audio API. The flow is:

1. Agent uploads `.m4a` via mobile app to `POST /calls/upload`
2. Backend saves the file locally and queues transcription as a **background task**
3. `transcribe_audio()` in `backend/app/services/transcription.py` calls OpenAI
4. GPT-4 extracts a summary and action items from the raw transcript
5. A Pabbly Connect webhook fires with the results

---

## Available Models (2026)

| Model                       | Use Case                            | Max Input                            |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| `gpt-4o-transcribe`         | Best quality, multilingual          | 25 MB                                |
| `gpt-4o-mini-transcribe`    | Faster, cheaper, still high quality | 25 MB                                |
| `gpt-4o-transcribe-diarize` | Speaker identification              | 25 MB (requires `chunking_strategy`) |
| `whisper-1`                 | Legacy, supports translations       | 25 MB                                |

**Recommended for this project:** `gpt-4o-mini-transcribe` (cost-effective for sales calls).

---

## Core Transcription

### Simple transcription (text output)

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.openai_api_key)

with open(audio_file_path, "rb") as f:
    transcription = await client.audio.transcriptions.create(
        model="gpt-4o-mini-transcribe",
        file=f,
        response_format="text",
    )

raw_text = str(transcription)
```

### With sales call context prompt (improves accuracy)

```python
transcription = await client.audio.transcriptions.create(
    model="gpt-4o-mini-transcribe",
    file=f,
    response_format="text",
    prompt="This is a sales call between an agent and a client discussing products, pricing, and follow-up actions.",
)
```

The prompt helps the model:

- Correct product names and company names
- Preserve punctuation
- Recognize sales-specific terms ("follow up", "proposal", "close the deal")

### With timestamps (word-level, whisper-1 only)

```python
transcription = await client.audio.transcriptions.create(
    file=f,
    model="whisper-1",
    response_format="verbose_json",
    timestamp_granularities=["word"],
)
words = transcription.words  # [{word, start, end}]
```

---

## Speaker Diarization (Agent vs Client)

```python
import base64

def to_data_url(path: str) -> str:
    with open(path, "rb") as fh:
        return "data:audio/wav;base64," + base64.b64encode(fh.read()).decode("utf-8")

transcript = await client.audio.transcriptions.create(
    model="gpt-4o-transcribe-diarize",
    file=audio_file,
    response_format="diarized_json",
    chunking_strategy="auto",  # required for audio > 30 seconds
    extra_body={
        "known_speaker_names": ["agent"],
        "known_speaker_references": [to_data_url("agent_sample.wav")],
    },
)

for segment in transcript.segments:
    print(f"{segment.speaker}: {segment.text} [{segment.start:.1f}s - {segment.end:.1f}s]")
```

---

## Handling Files > 25MB (Chunking)

```python
from pydub import AudioSegment

def chunk_audio(file_path: str, chunk_minutes: int = 10) -> list[str]:
    """Split audio into chunks under 25MB for Whisper."""
    audio = AudioSegment.from_file(file_path)
    chunk_ms = chunk_minutes * 60 * 1000
    chunk_paths = []
    for i, start in enumerate(range(0, len(audio), chunk_ms)):
        chunk = audio[start:start + chunk_ms]
        chunk_path = f"{file_path}_chunk_{i}.mp3"
        chunk.export(chunk_path, format="mp3")
        chunk_paths.append(chunk_path)
    return chunk_paths
```

Always split at silence boundaries when possible to preserve sentence context.

---

## GPT-4 Insight Extraction

After transcription, extract structured data for Pabbly automation:

```python
import json

async def extract_insights(client: AsyncOpenAI, transcription: str) -> dict:
    prompt = f"""
You are a sales intelligence assistant. Analyze this sales call transcription.

Transcription:
{transcription}

Return ONLY valid JSON in this exact format:
{{
    "summary": "3-5 sentence executive summary of the call",
    "action_items": ["specific followup 1", "specific followup 2"],
    "sentiment": "positive|neutral|negative",
    "key_topics": ["topic1", "topic2"],
    "next_step": "most important single next action"
}}
"""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content or "{}")
```

---

## Streaming Transcription (for real-time display)

```python
stream = await client.audio.transcriptions.create(
    model="gpt-4o-mini-transcribe",
    file=audio_file,
    response_format="text",
    stream=True,
)
async for event in stream:
    # event types: transcript.text.delta, transcript.text.done
    if hasattr(event, 'delta'):
        print(event.delta, end="", flush=True)
```

---

## Background Task Pattern (FastAPI)

The transcription runs asynchronously so the API returns `202 Accepted` immediately:

```python
from fastapi import BackgroundTasks

@router.post("/calls/upload", status_code=202)
async def upload_call(
    background_tasks: BackgroundTasks,
    audio: UploadFile,
    db: Session = Depends(get_db),
):
    call = CallRecord(status="pending", ...)
    db.add(call); db.commit()

    # Non-blocking — returns immediately
    background_tasks.add_task(process_transcription, call.id, file_path)
    return call  # status=pending


async def process_transcription(call_id: str, file_path: str):
    # 1. Set status = transcribing
    # 2. Call OpenAI Whisper
    # 3. Call GPT-4 for insights
    # 4. Update DB with results
    # 5. Fire Pabbly webhook
```

The mobile app polls `GET /calls/{id}` every 3 seconds until `status === "completed"`.

---

## Supported Audio Formats

OpenAI Audio API accepts: `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`

Expo's `HIGH_QUALITY` preset records `.m4a` — no conversion needed.

---

## File Size Limits

- OpenAI API: **25 MB maximum** per request
- Backend: configurable via `MAX_AUDIO_SIZE_MB` in `.env` (default: 100MB)
- For files > 25MB, use `pydub` to chunk before sending to OpenAI

---

## Error Handling

```python
try:
    result = await transcribe_audio(file_path)
    call.status = "completed"
except openai.RateLimitError:
    # Retry after delay
    call.status = "pending"
except openai.APIError:
    call.status = "failed"
finally:
    db.commit()
```

Status values: `pending` → `transcribing` → `completed` | `failed`

---

## Supported Languages

Whisper supports 90+ languages including Arabic, Hindi, Mandarin, Spanish, and all major South Asian and Southeast Asian languages. Ideal for multilingual sales teams.

To force a specific language:

```python
transcription = await client.audio.transcriptions.create(
    model="gpt-4o-mini-transcribe",
    file=f,
    language="en",  # ISO 639-1 code
)
```
