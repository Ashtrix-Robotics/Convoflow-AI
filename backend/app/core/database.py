from __future__ import annotations
import socket as _socket_module

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# ── IPv4 preference fix ──────────────────────────────────────────────────────
# Python 3.12+ may prefer IPv6 when DNS returns both A and AAAA records.
# Patching getaddrinfo makes psycopg2 always try IPv4 first (required for
# Supabase PostgreSQL pooler which is IPv4-only in some regions).
_orig_getaddrinfo = _socket_module.getaddrinfo


def _prefer_ipv4(host, port, family=0, type=0, proto=0, flags=0):  # noqa: A002
    results = _orig_getaddrinfo(host, port, family, type, proto, flags)
    ipv4 = [r for r in results if r[0] == _socket_module.AF_INET]
    return ipv4 if ipv4 else results


_socket_module.getaddrinfo = _prefer_ipv4

if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. "
        "Set it to your Supabase PostgreSQL connection pooling URI.\n"
        "Supabase Dashboard → Settings → Database → Connection Pooling → URI"
    )

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # detect stale connections
    pool_recycle=300,     # recycle connections every 5 min (Supabase idle timeout)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_db_session():
    return SessionLocal()
