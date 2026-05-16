"""Loops (recurring jobs) router. WS-G.

GET    /api/loops              -> list (persisted at fixtures/loops.json)
POST   /api/loops              -> create (assigns id, persists)
DELETE /api/loops/{id}         -> remove
POST   /api/loops/{id}/run-now -> synchronously trigger one tick (publishes)
GET    /api/loops/{id}/runs    -> run history filtered from fixtures/posts.json

The scheduler service (services/scheduler/main.py) reads the same loops file
and registers cron jobs on boot.
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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .publish import PublishBody, perform_publish

logger = logging.getLogger("cie.loops")

router = APIRouter(prefix="/api/loops", tags=["loops"])

_REPO_ROOT = Path(__file__).resolve().parents[3]
_LOOPS_PATH = _REPO_ROOT / "fixtures" / "loops.json"
_POSTS_PATH = _REPO_ROOT / "fixtures" / "posts.json"

_FILE_LOCK = asyncio.Lock()


class LoopCreate(BaseModel):
    name: str
    cron: str = Field(..., description="Cron expression e.g. '0 9 * * *'")
    channel: str
    prompt: str
    format: str = "post"


class Loop(LoopCreate):
    id: str
    created_at: str


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


def _load_loops() -> list[dict[str, Any]]:
    data = _read_json(_LOOPS_PATH, [])
    return data if isinstance(data, list) else []


@router.get("")
async def list_loops() -> list[dict[str, Any]]:
    return _load_loops()


@router.post("")
async def create_loop(body: LoopCreate) -> dict[str, Any]:
    loop = Loop(id=f"loop_{uuid.uuid4().hex[:10]}", created_at=_now_iso(), **body.model_dump())
    async with _FILE_LOCK:
        loops = _load_loops()
        loops.append(loop.model_dump())
        _atomic_write(_LOOPS_PATH, loops)
    logger.info("created loop %s (channel=%s, cron=%s)", loop.id, loop.channel, loop.cron)
    return loop.model_dump()


@router.delete("/{loop_id}")
async def delete_loop(loop_id: str) -> dict[str, bool]:
    async with _FILE_LOCK:
        loops = _load_loops()
        new_loops = [loop for loop in loops if loop.get("id") != loop_id]
        if len(new_loops) == len(loops):
            raise HTTPException(status_code=404, detail=f"loop '{loop_id}' not found")
        _atomic_write(_LOOPS_PATH, new_loops)
    logger.info("deleted loop %s", loop_id)
    return {"ok": True}


@router.post("/{loop_id}/run-now")
async def run_now(loop_id: str) -> dict[str, Any]:
    loops = _load_loops()
    loop = next((entry for entry in loops if entry.get("id") == loop_id), None)
    if loop is None:
        raise HTTPException(status_code=404, detail=f"loop '{loop_id}' not found")
    body = PublishBody(copy=loop.get("prompt"), loop_id=loop_id)
    record = await perform_publish(loop["channel"], body)
    return record


@router.get("/{loop_id}/runs")
async def list_runs(loop_id: str) -> list[dict[str, Any]]:
    posts = _read_json(_POSTS_PATH, [])
    if not isinstance(posts, list):
        return []
    return [post for post in posts if post.get("loop_id") == loop_id]
