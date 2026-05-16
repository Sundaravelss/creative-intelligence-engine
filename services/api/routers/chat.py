"""Chat session persistence router.

Endpoints (prefix ``/api/chat``):

- ``GET    /sessions``                    — list (most recent first, ≤ limit)
- ``POST   /sessions``                    — create empty session, returns id
- ``GET    /sessions/{id}``               — session + ordered messages
- ``PATCH  /sessions/{id}``               — rename / update adapter or fallback
- ``DELETE /sessions/{id}``               — delete session + cascade messages
- ``POST   /sessions/{id}/messages``      — append one message

The frontend calls these from ``apps/web/lib/chat.ts``. Append is debounced
client-side (~250ms) so SSE token streams don't hammer the DB.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import delete, select

from db import session_scope  # type: ignore[import-not-found]
from models_db import ChatMessage, ChatSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# request / response schemas (kept here — not in services/api/schemas.py — to
# stay scoped to this router and not collide with shared Pydantic types)
# ---------------------------------------------------------------------------


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    brand_id: str | None = None
    adapter: str | None = None
    fallback: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class CreateSessionInput(BaseModel):
    title: str | None = None
    brand_id: str | None = None
    adapter: str | None = None
    fallback: str | None = None


class PatchSessionInput(BaseModel):
    title: str | None = None
    adapter: str | None = None
    fallback: str | None = None


class AppendMessageInput(BaseModel):
    kind: str
    payload: dict[str, Any]


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    kind: str
    payload: dict[str, Any]
    created_at: datetime


class SessionWithMessages(BaseModel):
    session: ChatSessionSummary
    messages: list[ChatMessageOut]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _summary(s: ChatSession, count: int) -> ChatSessionSummary:
    return ChatSessionSummary(
        id=s.id,
        title=s.title,
        brand_id=s.brand_id,
        adapter=s.adapter,
        fallback=s.fallback,
        created_at=s.created_at,
        updated_at=s.updated_at,
        message_count=count,
    )


def _decode_payload(payload: str) -> dict[str, Any]:
    import json

    try:
        decoded = json.loads(payload)
    except json.JSONDecodeError:
        return {"raw": payload}
    return decoded if isinstance(decoded, dict) else {"raw": decoded}


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def list_sessions(limit: int = 50) -> list[ChatSessionSummary]:
    """Most-recent-first session list. Caps at 50 by default."""
    limit = max(1, min(limit, 200))
    with session_scope() as db:
        sessions = db.exec(
            select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit)
        ).all()
        out: list[ChatSessionSummary] = []
        for s in sessions:
            count = (
                db.exec(
                    select(ChatMessage.id).where(ChatMessage.session_id == s.id)
                )
                .all()
                .__len__()
            )
            out.append(_summary(s, count))
        return out


@router.post("/sessions", response_model=ChatSessionSummary, status_code=201)
async def create_session(body: CreateSessionInput) -> ChatSessionSummary:
    """Create an empty session. Title defaults to ``New chat``."""
    new = ChatSession(
        id=_new_id("cs"),
        title=(body.title or "New chat").strip()[:200] or "New chat",
        brand_id=body.brand_id,
        adapter=body.adapter,
        fallback=body.fallback,
    )
    with session_scope() as db:
        db.add(new)
        db.flush()
        return _summary(new, 0)


@router.get("/sessions/{session_id}", response_model=SessionWithMessages)
async def get_session(session_id: str) -> SessionWithMessages:
    """Return the session + ordered messages (oldest first)."""
    with session_scope() as db:
        s = db.get(ChatSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        msgs = db.exec(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        ).all()
        return SessionWithMessages(
            session=_summary(s, len(msgs)),
            messages=[
                ChatMessageOut(
                    id=m.id,
                    session_id=m.session_id,
                    kind=m.kind,
                    payload=_decode_payload(m.payload),
                    created_at=m.created_at,
                )
                for m in msgs
            ],
        )


@router.patch("/sessions/{session_id}", response_model=ChatSessionSummary)
async def patch_session(session_id: str, body: PatchSessionInput) -> ChatSessionSummary:
    """Rename the session or update the adapter / fallback chain."""
    with session_scope() as db:
        s = db.get(ChatSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if body.title is not None:
            s.title = body.title.strip()[:200] or s.title
        if body.adapter is not None:
            s.adapter = body.adapter or None
        if body.fallback is not None:
            s.fallback = body.fallback or None
        s.updated_at = _now()
        db.add(s)
        db.flush()
        count = (
            db.exec(select(ChatMessage.id).where(ChatMessage.session_id == s.id))
            .all()
            .__len__()
        )
        return _summary(s, count)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    """Delete the session and all its messages."""
    with session_scope() as db:
        s = db.get(ChatSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        db.exec(delete(ChatMessage).where(ChatMessage.session_id == session_id))
        db.delete(s)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageOut,
    status_code=201,
)
async def append_message(
    session_id: str, body: AppendMessageInput
) -> ChatMessageOut:
    """Append one event to the session and bump ``updated_at``."""
    import json

    with session_scope() as db:
        s = db.get(ChatSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        msg = ChatMessage(
            id=_new_id("cm"),
            session_id=session_id,
            kind=body.kind,
            payload=json.dumps(body.payload, separators=(",", ":"), default=str),
        )
        s.updated_at = msg.created_at
        db.add(msg)
        db.add(s)
        db.flush()
        return ChatMessageOut(
            id=msg.id,
            session_id=msg.session_id,
            kind=msg.kind,
            payload=body.payload,
            created_at=msg.created_at,
        )


__all__ = ["router"]
