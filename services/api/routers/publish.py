"""Publish router. WS-G — mock publish per channel.

POST /api/publish/{channel}
  body: { artifact_id?, copy?, schedule_at?, loop_id? }
  -> 800ms shim, returns { post_id, channel, posted_at, insights }
  -> appends entry to fixtures/posts.json (atomic write).

The ``insights`` payload is sliced from fixtures/insights.json for the channel
when available; otherwise an empty object is returned.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger("cie.publish")

router = APIRouter(prefix="/api/publish", tags=["publish"])

_REPO_ROOT = Path(__file__).resolve().parents[3]
_POSTS_PATH = _REPO_ROOT / "fixtures" / "posts.json"
_INSIGHTS_PATH = _REPO_ROOT / "fixtures" / "insights.json"

_FILE_LOCK = asyncio.Lock()


class PublishBody(BaseModel):
    # `copy` shadows BaseModel.copy() in Pydantic v2; silence the warning since
    # we never call .copy() on this DTO.
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)

    artifact_id: str | None = None
    copy: str | None = None
    schedule_at: str | None = None
    loop_id: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _atomic_write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".tmp_", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


async def perform_publish(channel: str, body: PublishBody | None = None) -> dict[str, Any]:
    """Shared mock-publish primitive. Used by the route handler and by loops."""
    payload = body or PublishBody()
    await asyncio.sleep(0.8)

    insights_doc = _read_json(_INSIGHTS_PATH, {})
    channel_insights = insights_doc.get(channel, {}) if isinstance(insights_doc, dict) else {}

    post_id = f"mock_{uuid.uuid4().hex[:12]}"
    posted_at = _now_iso()
    record: dict[str, Any] = {
        "post_id": post_id,
        "channel": channel,
        "posted_at": posted_at,
        "artifact_id": payload.artifact_id,
        "copy": payload.copy,
        "schedule_at": payload.schedule_at,
        "loop_id": payload.loop_id,
        "insights": channel_insights,
    }

    async with _FILE_LOCK:
        existing = _read_json(_POSTS_PATH, [])
        if not isinstance(existing, list):
            existing = []
        new_posts = [*existing, record]
        _atomic_write(_POSTS_PATH, new_posts)

    logger.info("published %s to %s (loop_id=%s)", post_id, channel, payload.loop_id)
    return record


@router.post("/{channel}")
async def publish(channel: str, body: PublishBody | None = None) -> dict[str, Any]:
    return await perform_publish(channel, body)
