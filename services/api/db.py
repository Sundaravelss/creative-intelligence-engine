"""SQLite engine for Studio chat session persistence.

Stays narrowly scoped: only chat sessions + messages live in the DB. Brand,
loops, posts, etc. remain JSON fixtures so the other two parallel sessions
working on UI/features don't conflict with this workstream.

Path: ``<repo-root>/fixtures/cie.db`` (gitignored). Same parents[3] resolution
the routers use, so this module works whether the API is launched from the
repo root or from ``services/api/``.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Final

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

logger = logging.getLogger(__name__)

_REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]
_DB_PATH: Final[Path] = _REPO_ROOT / "fixtures" / "cie.db"


def _resolve_db_url() -> str:
    """Use ``CIE_DB_URL`` if set (tests use ``sqlite:///:memory:``)."""
    override = os.environ.get("CIE_DB_URL", "").strip()
    if override:
        return override
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{_DB_PATH}"


def _build_engine():
    url = _resolve_db_url()
    kwargs: dict = {
        "connect_args": {"check_same_thread": False},
        "echo": False,
    }
    # In-memory SQLite needs StaticPool so all sessions share the same DB.
    if url.startswith("sqlite://") and ":memory:" in url or url == "sqlite://":
        kwargs["poolclass"] = StaticPool
    return create_engine(url, **kwargs)


_engine = _build_engine()


def get_engine():
    """Return the singleton engine (used by tests to call ``create_all``)."""
    return _engine


def init_db() -> None:
    """Create tables if missing. Idempotent. Called on FastAPI lifespan startup."""
    # Import here so the model module is loaded before metadata.create_all.
    import models_db  # type: ignore[import-not-found]  # noqa: F401

    SQLModel.metadata.create_all(_engine)
    logger.info("CIE DB initialised at %s", _engine.url)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope — commits on clean exit, rolls back on exception."""
    session = Session(_engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = ["get_engine", "init_db", "session_scope"]
