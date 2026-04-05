from __future__ import annotations
"""
Audio file storage service.

Priority:
  1. Supabase Storage  (when SUPABASE_URL + SUPABASE_SERVICE_KEY are set)
  2. Local disk        (fallback for dev / offline)

All configuration comes from .env via settings — no hardcoded values.
"""
import logging
import uuid
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialise the Supabase client only when the credentials are present.
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client  # imported lazily — not required if using local storage
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase_client


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upload_audio(file_bytes: bytes, original_filename: str) -> dict:
    """
    Upload audio bytes to storage.

    Returns:
        {
            "storage_path": str,   # relative path inside bucket / local dir
            "audio_url": str,      # publicly accessible URL (or local path)
            "backend": str,        # "supabase" | "local"
        }
    """
    ext = Path(original_filename).suffix or ".m4a"
    unique_name = f"{uuid.uuid4()}{ext}"

    if settings.use_supabase_storage:
        return _upload_to_supabase(file_bytes, unique_name)

    return _upload_to_local(file_bytes, unique_name)


def delete_audio(storage_path: str, backend: str = "supabase") -> None:
    """Best-effort deletion — errors are logged but never raised."""
    try:
        if backend == "supabase" and settings.use_supabase_storage:
            _get_supabase().storage.from_(settings.supabase_bucket).remove([storage_path])
        else:
            local_path = Path(settings.upload_dir) / storage_path
            if local_path.exists():
                local_path.unlink()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not delete audio %s: %s", storage_path, exc)


def get_local_temp_path(file_bytes: bytes, suffix: str = ".m4a") -> str:
    """
    Write bytes to a temporary local file and return the path.
    Used for streaming to the transcription API even when primary storage is Supabase.
    The caller is responsible for deleting the file after use.
    """
    tmp_dir = Path(settings.upload_dir) / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / f"tmp_{uuid.uuid4()}{suffix}"
    tmp_path.write_bytes(file_bytes)
    return str(tmp_path)


# ---------------------------------------------------------------------------
# Backends (private)
# ---------------------------------------------------------------------------

def _upload_to_supabase(file_bytes: bytes, filename: str) -> dict:
    storage_path = f"audio/{filename}"
    try:
        client = _get_supabase()
        # Ensure bucket exists (idempotent)
        try:
            client.storage.create_bucket(settings.supabase_bucket, options={"public": True})
        except Exception:
            pass  # bucket already exists — not an error

        client.storage.from_(settings.supabase_bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "audio/m4a", "upsert": "false"},
        )
        audio_url = (
            f"{settings.supabase_url}/storage/v1/object/public/"
            f"{settings.supabase_bucket}/{storage_path}"
        )
        logger.info("Uploaded to Supabase Storage: %s", storage_path)
        return {"storage_path": storage_path, "audio_url": audio_url, "backend": "supabase"}
    except Exception as exc:
        logger.error("Supabase upload failed (%s), falling back to local: %s", filename, exc)
        return _upload_to_local(file_bytes, filename)


def _upload_to_local(file_bytes: bytes, filename: str) -> dict:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    file_path.write_bytes(file_bytes)
    logger.info("Saved locally: %s", file_path)
    return {
        "storage_path": filename,
        "audio_url": str(file_path),
        "backend": "local",
    }
