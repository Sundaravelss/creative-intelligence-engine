"""Connectors router. WS-G — list / connect / disconnect with atomic fixture writes.

The connectors fixture is shared across workstreams; we only ever write via
atomic temp+rename to keep concurrent readers safe.

For the AI Backends category, status is overlaid from real environment
variables: if the credential for a backend is set, the entry is reported as
``connected`` regardless of what's persisted to the fixture.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("cie.connectors")

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

# fixtures/connectors.json — repo root resolved relative to this file.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONNECTORS_PATH = _REPO_ROOT / "fixtures" / "connectors.json"

# Map AI-backend connector ids -> env vars whose presence implies "connected".
_AI_BACKEND_ENV: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "pioneer": "PIONEER_API_KEY",
    "fal": "FAL_KEY",
    "hermes": "HERMES_API_KEY",
    "tavily": "TAVILY_API_KEY",
}

# Single in-process lock to serialize writes (prevents torn fixtures when
# multiple requests call POST/DELETE concurrently).
_FILE_LOCK = asyncio.Lock()


class ConnectBody(BaseModel):
    username: str | None = None
    api_key: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read_connectors() -> list[dict[str, Any]]:
    if not _CONNECTORS_PATH.exists():
        return []
    with _CONNECTORS_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise RuntimeError("fixtures/connectors.json must be a JSON array")
    return data


def _atomic_write(path: Path, payload: object) -> None:
    """Write JSON atomically: tmp file in same dir + os.replace."""
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


def _overlay_env_status(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return a new list where AI-backend entries reflect real env credentials."""
    out: list[dict[str, Any]] = []
    for entry in items:
        if entry.get("category") == "ai-backends":
            env_var = _AI_BACKEND_ENV.get(entry.get("id", ""))
            if env_var and os.environ.get(env_var):
                merged = {**entry, "status": "connected"}
                merged.setdefault("lastSync", _now_iso())
                out.append(merged)
                continue
        out.append({**entry})
    return out


@router.get("")
async def list_connectors() -> list[dict[str, Any]]:
    items = _read_connectors()
    return _overlay_env_status(items)


@router.post("/{connector_id}/connect")
async def connect(connector_id: str, body: ConnectBody | None = None) -> dict[str, Any]:
    async with _FILE_LOCK:
        items = _read_connectors()
        idx = next((i for i, c in enumerate(items) if c.get("id") == connector_id), -1)
        if idx == -1:
            raise HTTPException(status_code=404, detail=f"connector '{connector_id}' not found")
        if items[idx].get("status") == "coming-soon":
            raise HTTPException(status_code=409, detail="connector is coming-soon and cannot be connected")
        updated = {**items[idx], "status": "connected", "lastSync": _now_iso()}
        new_items = [*items[:idx], updated, *items[idx + 1 :]]
        _atomic_write(_CONNECTORS_PATH, new_items)
        logger.info("connector %s connected (username=%s)", connector_id, (body.username if body else None))
        return updated


@router.delete("/{connector_id}/connect")
async def disconnect(connector_id: str) -> dict[str, Any]:
    async with _FILE_LOCK:
        items = _read_connectors()
        idx = next((i for i, c in enumerate(items) if c.get("id") == connector_id), -1)
        if idx == -1:
            raise HTTPException(status_code=404, detail=f"connector '{connector_id}' not found")
        updated = {**items[idx], "status": "not-connected"}
        if "lastSync" in updated:
            updated.pop("lastSync", None)
        new_items = [*items[:idx], updated, *items[idx + 1 :]]
        _atomic_write(_CONNECTORS_PATH, new_items)
        logger.info("connector %s disconnected", connector_id)
        return updated
