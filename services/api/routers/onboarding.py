"""Onboarding state router — read/write `fixtures/onboarding.json`.

GET  /api/onboarding/state  → returns the persisted OnboardingState (default
                              `{complete: false}` if the fixture is missing or
                              unreadable).
PUT  /api/onboarding/state  → atomically overwrites the fixture with the body.

This is intentionally a flat single-file fixture: hackathon scope, no auth, one
user. Mirrors the atomic-write pattern used in `services/api/routers/brand.py`
so the fixture is never half-written.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Final

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Resolve fixtures dir as <repo-root>/fixtures.
# This file lives at services/api/routers/onboarding.py, so parents[3] points
# at the repo root.
_FIXTURE: Final[Path] = (
    Path(__file__).resolve().parents[3] / "fixtures" / "onboarding.json"
)


class OnboardingState(BaseModel):
    """Single-user onboarding flag, persisted to fixtures/onboarding.json."""

    complete: bool = False
    brandUrl: str | None = None
    completedAt: str | None = None


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON atomically: tmp file in the same dir, then os.replace.

    Mirrors `_atomic_write_json` in `services/api/routers/brand.py` so the two
    fixture writers behave identically. Kept local rather than extracted so
    each router stays self-contained for the hackathon scope.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=".onboarding-", suffix=".json", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


@router.get("/state", response_model=OnboardingState)
async def get_state() -> OnboardingState:
    """Return the persisted OnboardingState, or the default if missing/unparseable."""
    if not _FIXTURE.exists():
        logger.info("Onboarding fixture not found at %s — returning default", _FIXTURE)
        return OnboardingState()
    try:
        data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
        return OnboardingState(**data)
    except (OSError, ValueError, TypeError) as exc:
        logger.warning(
            "Failed to parse onboarding fixture at %s (%s) — returning default",
            _FIXTURE,
            exc,
        )
        return OnboardingState()


@router.put("/state", response_model=OnboardingState)
async def put_state(body: OnboardingState) -> OnboardingState:
    """Persist OnboardingState atomically to fixtures/onboarding.json."""
    payload = body.model_dump(exclude_none=False)
    try:
        _atomic_write_json(_FIXTURE, payload)
    except OSError as exc:
        logger.error("Failed to write onboarding fixture %s: %s", _FIXTURE, exc)
        raise HTTPException(
            status_code=500, detail="Could not persist onboarding state."
        ) from exc
    logger.info("Saved onboarding state complete=%s url=%s", body.complete, body.brandUrl)
    return body
