from __future__ import annotations
import socket as _socket_module

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings

# ── IPv4 preference fix ──────────────────────────────────────────────────────
# Some host environments (EC2 t-micro without IPv6 routing) can reach
# Supabase only via IPv4, but Python 3.12+ may prefer IPv6 when the DNS
# returns both.  Patching getaddrinfo makes psycopg2 always try IPv4 first.
_orig_getaddrinfo = _socket_module.getaddrinfo


def _prefer_ipv4(host, port, family=0, type=0, proto=0, flags=0):  # noqa: A002
    results = _orig_getaddrinfo(host, port, family, type, proto, flags)
    ipv4 = [r for r in results if r[0] == _socket_module.AF_INET]
    return ipv4 if ipv4 else results


if "sqlite" not in settings.database_url:
    _socket_module.getaddrinfo = _prefer_ipv4


_connect_args: dict = {}
_pool_kwargs: dict = {}
if "sqlite" in settings.database_url:
    _connect_args = {"check_same_thread": False}
    _pool_kwargs = {"poolclass": StaticPool}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_pool_kwargs,
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
