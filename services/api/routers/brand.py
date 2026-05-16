"""Brand Memory router — read/write `fixtures/brand.json` + logo upload.

GET    /api/brand          → returns the BrandProfile (404 if missing).
PUT    /api/brand          → atomically overwrites the BrandProfile.
POST   /api/brand/logo     → multipart upload; saves to fixtures/assets/.

Storage is intentionally a flat JSON file: this is the brand-memory MVP and
swapping it for a DB layer later only changes this module.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Final

from fastapi import APIRouter, File, HTTPException, UploadFile

from schemas import BrandProfile

logger = logging.getLogger("cie.api.brand")

router = APIRouter(prefix="/api/brand", tags=["brand"])

_REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[3]
_BRAND_FILE: Final[Path] = _REPO_ROOT / "fixtures" / "brand.json"
_ASSETS_DIR: Final[Path] = _REPO_ROOT / "fixtures" / "assets"

# Whitelist common image extensions; refuse everything else.
_ALLOWED_EXTS: Final[frozenset[str]] = frozenset({"png", "jpg", "jpeg", "svg", "webp", "gif"})
_MAX_LOGO_BYTES: Final[int] = 5 * 1024 * 1024  # 5 MB


def _atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    """Write JSON atomically: tmp file in same dir, then os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".brand-", suffix=".json", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        # Clean up the tmp on any error so we don't leave half-written files.
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _ext_from_filename(filename: str) -> str | None:
    """Return lowercase file extension if it matches the whitelist, else None."""
    if not filename or "." not in filename:
        return None
    ext = filename.rsplit(".", 1)[-1].lower()
    # Strip anything that isn't [a-z0-9] to avoid path-traversal-by-ext shenanigans.
    ext = re.sub(r"[^a-z0-9]", "", ext)
    return ext if ext in _ALLOWED_EXTS else None


@router.get("", response_model=BrandProfile)
async def get_brand() -> BrandProfile:
    """Return the persisted BrandProfile, or 404 if no fixture exists yet."""
    if not _BRAND_FILE.exists():
        logger.info("Brand profile not found at %s", _BRAND_FILE)
        raise HTTPException(status_code=404, detail="No brand profile saved yet.")
    try:
        with _BRAND_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        logger.error("Failed to read %s: %s", _BRAND_FILE, exc)
        raise HTTPException(status_code=500, detail="Brand profile unreadable.") from exc
    return BrandProfile.model_validate(data)


@router.put("", response_model=BrandProfile)
async def put_brand(profile: BrandProfile) -> BrandProfile:
    """Persist the BrandProfile atomically to fixtures/brand.json."""
    # Serialize using camelCase aliases to keep parity with the TS shape.
    payload = profile.model_dump(by_alias=True, exclude_none=False)
    try:
        _atomic_write_json(_BRAND_FILE, payload)
    except OSError as exc:
        logger.error("Failed to write %s: %s", _BRAND_FILE, exc)
        raise HTTPException(status_code=500, detail="Could not persist brand profile.") from exc
    logger.info("Saved brand profile id=%s name=%s", profile.id, profile.name)
    return profile


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)) -> dict[str, str]:
    """Save the uploaded logo under fixtures/assets/, return its URL path."""
    ext = _ext_from_filename(file.filename or "")
    if ext is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {sorted(_ALLOWED_EXTS)}",
        )

    body = await file.read()
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(body) > _MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Logo too large ({len(body)} bytes). Max {_MAX_LOGO_BYTES}.",
        )

    _ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    target = _ASSETS_DIR / f"brand-logo.{ext}"

    # Atomic write so a half-uploaded logo never replaces a good one.
    fd, tmp_name = tempfile.mkstemp(prefix=".logo-", suffix=f".{ext}", dir=str(_ASSETS_DIR))
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(body)
        os.replace(tmp_name, target)
    except OSError as exc:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        logger.error("Failed to save logo: %s", exc)
        raise HTTPException(status_code=500, detail="Could not save logo.") from exc

    url = f"/fixtures/assets/{target.name}"
    logger.info("Saved logo to %s (%d bytes)", target, len(body))
    return {"url": url, "filename": target.name, "bytes": str(len(body))}
