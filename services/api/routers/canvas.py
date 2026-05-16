"""Canvas router — moodboard pins + character locker for the new /canvas page.

Storage is two flat JSON files under fixtures/, written atomically. Same
pattern as `brand.py`. No auth in hackathon scope.

GET    /api/canvas/pins              → list pins
POST   /api/canvas/pins              → create pin (server-assigned id)
DELETE /api/canvas/pins/{pin_id}     → remove pin

GET    /api/canvas/characters        → list characters
POST   /api/canvas/characters        → create character
DELETE /api/canvas/characters/{id}   → remove character
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Final

from fastapi import APIRouter, HTTPException

from schemas import CanvasCharacter, CanvasPin

logger = logging.getLogger("cie.api.canvas")

router = APIRouter(prefix="/api/canvas", tags=["canvas"])

_REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[3]
_PINS_FILE: Final[Path] = _REPO_ROOT / "fixtures" / "canvas_pins.json"
_CHARACTERS_FILE: Final[Path] = _REPO_ROOT / "fixtures" / "characters.json"


def _atomic_write_json(path: Path, payload: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=".canvas-", suffix=".json", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise


def _read_json_list(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    try:
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError:
        logger.warning("Corrupt JSON at %s; resetting to []", path)
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


# ---------------------------------------------------------------------------
# Pins
# ---------------------------------------------------------------------------


@router.get("/pins")
async def list_pins() -> list[CanvasPin]:
    raw = _read_json_list(_PINS_FILE)
    return [CanvasPin(**item) for item in raw]


@router.post("/pins")
async def create_pin(pin: CanvasPin) -> CanvasPin:
    items = _read_json_list(_PINS_FILE)
    payload = pin.model_dump(by_alias=True)
    if not payload.get("id"):
        payload["id"] = _new_id("pin")
    items.append(payload)
    _atomic_write_json(_PINS_FILE, items)
    return CanvasPin(**payload)


@router.delete("/pins/{pin_id}")
async def delete_pin(pin_id: str) -> dict[str, bool]:
    items = _read_json_list(_PINS_FILE)
    next_items = [item for item in items if item.get("id") != pin_id]
    if len(next_items) == len(items):
        raise HTTPException(status_code=404, detail=f"Pin {pin_id} not found")
    _atomic_write_json(_PINS_FILE, next_items)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Characters
# ---------------------------------------------------------------------------


@router.get("/characters")
async def list_characters() -> list[CanvasCharacter]:
    raw = _read_json_list(_CHARACTERS_FILE)
    return [CanvasCharacter(**item) for item in raw]


@router.post("/characters")
async def create_character(character: CanvasCharacter) -> CanvasCharacter:
    items = _read_json_list(_CHARACTERS_FILE)
    payload = character.model_dump(by_alias=True)
    if not payload.get("id"):
        payload["id"] = _new_id("char")
    items.append(payload)
    _atomic_write_json(_CHARACTERS_FILE, items)
    return CanvasCharacter(**payload)


@router.delete("/characters/{character_id}")
async def delete_character(character_id: str) -> dict[str, bool]:
    items = _read_json_list(_CHARACTERS_FILE)
    next_items = [item for item in items if item.get("id") != character_id]
    if len(next_items) == len(items):
        raise HTTPException(
            status_code=404, detail=f"Character {character_id} not found"
        )
    _atomic_write_json(_CHARACTERS_FILE, next_items)
    return {"ok": True}


__all__ = ["router"]
