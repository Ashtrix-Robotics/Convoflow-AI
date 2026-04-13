#!/usr/bin/env python3
"""
Seed class centers and batches for the Robotics programme.

Schedule source: April–May 2026 campaign schedule image.

Usage (from project root with venv active):
    python scripts/seed_class_data.py

Run AFTER: alembic upgrade head
"""

import os
import sys
import uuid
from datetime import date

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from app.core.database import SessionLocal
from app.models.models import ClassBatch, ClassCenter


def d(s: str) -> date:
    """Parse 'YYYY-MM-DD' string to date."""
    return date.fromisoformat(s)


# ── Center definitions ────────────────────────────────────────────────────────

CENTERS = [
    {"name": "Medavakkam",  "mode": "offline", "address": "Medavakkam, Chennai"},
    {"name": "Velachery",   "mode": "offline", "address": "Velachery, Chennai"},
    {"name": "KK Nagar",    "mode": "offline", "address": "KK Nagar, Chennai"},
    {"name": "Arumbakkam",  "mode": "offline", "address": "Arumbakkam, Chennai"},
    {"name": "Ambattur",    "mode": "offline", "address": "Ambattur, Chennai"},
    {"name": "Online",      "mode": "online",  "address": None},
]

# ── Batch definitions per center ──────────────────────────────────────────────
# Each tuple: (label, start_date, end_date, time_slot)

BATCHES_BY_CENTER: dict[str, list[tuple]] = {
    "Medavakkam": [
        ("Apr 28 – May 9",  d("2026-04-28"), d("2026-05-09"),  "11:30 AM – 12:30 PM"),
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "10:00 AM – 11:00 AM"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "11:30 AM – 12:30 PM"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "10:00 AM – 12:00 PM"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "11:30 AM – 1:30 PM"),
    ],
    "Velachery": [
        ("Apr 28 – May 9",  d("2026-04-28"), d("2026-05-09"),  "5:30 PM – 6:30 PM"),
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "4:00 PM – 5:00 PM"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "5:30 PM – 6:30 PM"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "4:00 PM – 5:00 PM"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "5:30 PM – 7:30 PM"),
    ],
    "KK Nagar": [
        ("Apr 28 – May 9",  d("2026-04-28"), d("2026-05-09"),  "5:30 PM – 6:30 PM"),
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "5:30 PM – 6:30 PM"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "4:00 PM – 5:00 PM"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "5:30 PM – 6:30 PM"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "4:00 PM – 6:00 PM"),
    ],
    "Arumbakkam": [
        ("Apr 28 – May 9",  d("2026-04-28"), d("2026-05-09"),  "11:30 AM – 12:30 PM"),
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "10:00 AM – 11:00 AM"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "11:30 AM – 12:30 PM"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "10:00 AM – 11:00 AM"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "11:30 AM – 1:30 PM"),
    ],
    "Ambattur": [
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "4:00 PM – 5:00 PM"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "5:30 PM – 6:30 PM"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "4:00 PM – 5:00 PM"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "5:30 PM – 7:30 PM"),
    ],
    "Online": [
        ("Apr 28 – May 9",  d("2026-04-28"), d("2026-05-09"),  "Flexible"),
        ("May 5 – May 16",  d("2026-05-05"), d("2026-05-16"),  "Flexible"),
        ("May 12 – May 23", d("2026-05-12"), d("2026-05-23"),  "Flexible"),
        ("May 19 – May 30", d("2026-05-19"), d("2026-05-30"),  "Flexible"),
        ("May 26 – May 30", d("2026-05-26"), d("2026-05-30"),  "Flexible"),
    ],
}


def seed() -> None:
    db = SessionLocal()
    try:
        created_centers = 0
        created_batches = 0
        skipped_centers = 0
        skipped_batches = 0

        for center_def in CENTERS:
            existing = db.query(ClassCenter).filter(ClassCenter.name == center_def["name"]).first()
            if existing:
                center = existing
                skipped_centers += 1
            else:
                center = ClassCenter(
                    id=str(uuid.uuid4()),
                    name=center_def["name"],
                    mode=center_def["mode"],
                    address=center_def.get("address"),
                    is_active=True,
                )
                db.add(center)
                db.flush()   # get center.id before batches reference it
                created_centers += 1

            batches = BATCHES_BY_CENTER.get(center_def["name"], [])
            for (label, start_date, end_date, time_slot) in batches:
                # Idempotent: skip if (center_id, label) already exists
                exists = (
                    db.query(ClassBatch)
                    .filter(ClassBatch.center_id == center.id, ClassBatch.label == label)
                    .first()
                )
                if exists:
                    skipped_batches += 1
                    continue

                batch = ClassBatch(
                    id=str(uuid.uuid4()),
                    center_id=center.id,
                    label=label,
                    start_date=start_date,
                    end_date=end_date,
                    time_slot=time_slot,
                    mode=center_def["mode"],
                    is_active=True,
                )
                db.add(batch)
                created_batches += 1

        db.commit()
        print(
            f"Seed complete — "
            f"centers: {created_centers} created / {skipped_centers} skipped | "
            f"batches: {created_batches} created / {skipped_batches} skipped"
        )
    except Exception as exc:
        db.rollback()
        print(f"Seed FAILED: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
