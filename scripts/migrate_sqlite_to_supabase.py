"""
migrate_sqlite_to_supabase.py
─────────────────────────────────────────────────────────────────────────────
Migrates all live data from the EC2 SQLite database to Supabase PostgreSQL.

Usage:
    1. Copy convoflow.db from EC2 first:
       scp -i aws/convoflow-key.pem ubuntu@13.205.182.171:~/convoflow-api/backend/convoflow.db ./convoflow_backup.db

    2. Run from repo root (with backend venv active):
       python scripts/migrate_sqlite_to_supabase.py --sqlite ./convoflow_backup.db

    3. Verify row counts match, then deploy to Render.

Environment:
    Reads DATABASE_URL from backend/.env for the Supabase Postgres target.
    Set SQLITE_PATH env var or pass --sqlite flag.

Safety:
    - Read-only on SQLite (source).
    - Idempotent: skips rows that already exist (by primary key) on Postgres.
    - Does NOT drop or truncate any tables.
"""

import argparse
import os
import sys
from pathlib import Path

# ── Bootstrap path so we can import app models ───────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / "backend" / ".env")

import sqlite3

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# Table migration order respects FK constraints
# ─────────────────────────────────────────────────────────────────────────────
TABLE_ORDER = [
    "agents",
    "clients",
    "leads",
    "call_records",
    "followups",
    "whatsapp_conversations",
    "whatsapp_messages",
    "aisensy_webhook_events",
    "app_settings",
]


def get_sqlite_rows(conn: sqlite3.Connection, table: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    cursor = conn.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def upsert_rows(pg_session: Session, table: str, rows: list[dict]) -> tuple[int, int]:
    """Insert rows that don't already exist by PK. Returns (inserted, skipped)."""
    if not rows:
        return 0, 0

    inserted = skipped = 0
    pk_col = "id" if table != "app_settings" else "key"

    for row in rows:
        pk_val = row.get(pk_col)
        exists = pg_session.execute(
            text(f"SELECT 1 FROM {table} WHERE {pk_col} = :pk LIMIT 1"),
            {"pk": pk_val},
        ).scalar()

        if exists:
            skipped += 1
            continue

        # Build parameterised INSERT
        cols = ", ".join(row.keys())
        placeholders = ", ".join(f":{k}" for k in row.keys())
        pg_session.execute(
            text(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"),
            row,
        )
        inserted += 1

    pg_session.commit()
    return inserted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate SQLite → Supabase Postgres")
    parser.add_argument(
        "--sqlite",
        default=os.getenv("SQLITE_PATH", str(REPO_ROOT / "convoflow_backup.db")),
        help="Path to the SQLite .db file (default: ./convoflow_backup.db)",
    )
    parser.add_argument(
        "--tables",
        nargs="*",
        default=None,
        help="Migrate only these tables (default: all tables in order)",
    )
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        print(f"[ERROR] SQLite file not found: {sqlite_path}")
        print(
            "  Fetch it from EC2 first:\n"
            "  scp -i aws/convoflow-key.pem "
            "ubuntu@13.205.182.171:~/convoflow-api/backend/convoflow.db "
            "./convoflow_backup.db"
        )
        sys.exit(1)

    target_url = settings.database_url
    if "sqlite" in target_url:
        print(
            "[ERROR] DATABASE_URL in backend/.env still points to SQLite.\n"
            "  Update it to your Supabase PostgreSQL URL before running this script."
        )
        sys.exit(1)

    print(f"[INFO] Source : {sqlite_path}")
    print(f"[INFO] Target : {target_url[:60]}...")

    # ── Verify target schema exists ──────────────────────────────────────────
    pg_engine = create_engine(target_url)
    inspector = inspect(pg_engine)
    existing_tables = inspector.get_table_names()
    missing = [t for t in TABLE_ORDER if t not in existing_tables]
    if missing:
        print(
            f"[ERROR] Tables missing from Postgres: {missing}\n"
            "  Run Alembic migrations first:\n"
            "    cd backend && alembic upgrade head"
        )
        sys.exit(1)

    tables_to_migrate = args.tables if args.tables else TABLE_ORDER

    # ── Migrate ──────────────────────────────────────────────────────────────
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_inspector = sqlite3.connect(str(sqlite_path))
    existing_sqlite_tables = {
        row[0]
        for row in sqlite_inspector.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    total_inserted = total_skipped = 0
    with Session(pg_engine) as pg_session:
        for table in tables_to_migrate:
            if table not in existing_sqlite_tables:
                print(f"  [SKIP] {table:40s} — not found in SQLite (new table)")
                continue

            rows = get_sqlite_rows(sqlite_conn, table)
            ins, skip = upsert_rows(pg_session, table, rows)
            total_inserted += ins
            total_skipped += skip
            print(f"  [OK]   {table:40s}  inserted={ins:>4}  skipped={skip:>4}")

    sqlite_conn.close()
    print(
        f"\n[DONE] Migration complete. "
        f"Inserted: {total_inserted}  Skipped (already exists): {total_skipped}"
    )


if __name__ == "__main__":
    main()
