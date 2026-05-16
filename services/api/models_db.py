"""SQLModel tables for Studio chat persistence.

Two tables only:

- ``ChatSession`` — one row per Studio thread. Title is auto-derived from the
  first user message; ``adapter`` / ``fallback`` capture the LLM choice for
  the run so the user can resume with the same backend.
- ``ChatMessage`` — append-only event log. ``payload`` is a JSON-encoded copy
  of the frontend's ``ChatMessage`` discriminator; we never split the union
  across columns because the shape evolves quickly.

No relationships defined: deletion is handled in the router with an explicit
DELETE ... WHERE session_id = ? to avoid SQLAlchemy cascade quirks under
SQLite.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChatSession(SQLModel, table=True):
    """One Studio chat thread."""

    id: str = Field(primary_key=True)  # cs_<hex>
    title: str = Field(default="New chat", max_length=200)
    brand_id: str | None = Field(default=None, index=True)
    adapter: str | None = None
    fallback: str | None = None  # comma-separated chain
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class ChatMessage(SQLModel, table=True):
    """One event in a chat thread (append-only)."""

    id: str = Field(primary_key=True)  # cm_<hex>
    session_id: str = Field(foreign_key="chatsession.id", index=True)
    kind: str  # user|assistant|reasoning|generation|started|thought|agent_step|followups
    payload: str  # JSON-encoded; see apps/web/components/studio/chat/types.ts
    created_at: datetime = Field(default_factory=_now)


__all__ = ["ChatSession", "ChatMessage"]
