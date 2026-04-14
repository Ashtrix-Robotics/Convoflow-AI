from __future__ import annotations
"""
Audio file storage service — Supabase Storage.

All configuration comes from .env via settings — no hardcoded values.
"""
import logging
import uuid
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialise the Supabase client on first use.
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase_client


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upload_audio(file_bytes: bytes, original_filename: str) -> dict:
    """
    Upload audio bytes to Supabase Storage.

    Returns:
        {
            "storage_path": str,  # relative path inside bucket
            "audio_url": str,     # publicly accessible URL
            "backend": str,       # always "supabase"
        }
    """
    ext = Path(original_filename).suffix or ".m4a"
    unique_name = f"{uuid.uuid4()}{ext}"
    return _upload_to_supabase(file_bytes, unique_name)


def delete_audio(storage_path: str, backend: str = "supabase") -> None:
    """Best-effort deletion — errors are logged but never raised."""
    try:
        _get_supabase().storage.from_(settings.supabase_bucket).remove([storage_path])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not delete audio %s: %s", storage_path, exc)


def get_local_temp_path(file_bytes: bytes, suffix: str = ".m4a") -> str:
    """
    Write bytes to a temporary local file and return the path.
    Required for streaming audio to the Groq Whisper API (must be a file-like obj).
    The caller is responsible for deleting the file after use.
    """
    tmp_dir = Path(settings.upload_dir) / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / f"tmp_{uuid.uuid4()}{suffix}"
    tmp_path.write_bytes(file_bytes)
    return str(tmp_path)


# ---------------------------------------------------------------------------
# Storage backend
# ---------------------------------------------------------------------------

def _upload_to_supabase(file_bytes: bytes, filename: str) -> dict:
    storage_path = f"audio/{filename}"
    client = _get_supabase()
    # Ensure bucket exists (idempotent — fails silently if already present)
    try:
        client.storage.create_bucket(settings.supabase_bucket, options={"public": True})
    except Exception:
        pass

    client.storage.from_(settings.supabase_bucket).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "audio/mp4", "upsert": "false"},
    )
    audio_url = (
        f"{settings.supabase_url}/storage/v1/object/public/"
        f"{settings.supabase_bucket}/{storage_path}"
    )
    logger.info("Uploaded to Supabase Storage: %s", storage_path)
    return {"storage_path": storage_path, "audio_url": audio_url, "backend": "supabase"}


def download_audio(storage_path: str) -> bytes:
    """Download audio bytes from Supabase Storage using the service key."""
    client = _get_supabase()
    return client.storage.from_(settings.supabase_bucket).download(storage_path)


def extract_storage_path(audio_url: str) -> str | None:
    """Extract the storage path from a public Supabase URL."""
    marker = f"/{settings.supabase_bucket}/"
    idx = audio_url.find(marker)
    if idx == -1:
        return None
    return audio_url[idx + len(marker):]
