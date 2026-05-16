"""Brand Memory router — read/write `fixtures/brand.json` + logo upload + scan.

GET    /api/brand          → returns the BrandProfile (404 if missing).
PUT    /api/brand          → atomically overwrites the BrandProfile.
POST   /api/brand/logo     → multipart upload; saves to fixtures/assets/.
POST   /api/brand/scan     → SSE stream that crawls a URL via Tavily (with
                             httpx fallback), synthesizes a BrandProfile, and
                             persists it atomically to fixtures/brand.json.

Storage is intentionally a flat JSON file: this is the brand-memory MVP and
swapping it for a DB layer later only changes this module.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Final
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from schemas import BrandProfile
from sse import event_stream  # type: ignore[import-not-found]

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


# ---------------------------------------------------------------------------
# POST /api/brand/scan — real web scan via Tavily, with httpx fallback
# ---------------------------------------------------------------------------

# Phase 1 (Tavily extract) timeouts; we keep these tight so the demo SSE
# stream never feels frozen.
_TAVILY_TIMEOUT_S: Final[float] = 45.0
_HTTPX_TIMEOUT_S: Final[float] = 20.0
_HEX_RE: Final[re.Pattern[str]] = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
_LOGO_HINT_RE: Final[re.Pattern[str]] = re.compile(r"logo|brand|header", re.IGNORECASE)
_PRODUCT_PATH_RE: Final[re.Pattern[str]] = re.compile(r"/products?/", re.IGNORECASE)
_OG_DESC_RE: Final[re.Pattern[str]] = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_H1_RE: Final[re.Pattern[str]] = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
_TITLE_RE: Final[re.Pattern[str]] = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_TAG_RE: Final[re.Pattern[str]] = re.compile(r"<[^>]+>")
_HREF_RE: Final[re.Pattern[str]] = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
_IMG_SRC_RE: Final[re.Pattern[str]] = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)


class BrandScanBody(BaseModel):
    """Body schema for POST /api/brand/scan."""

    url: str = Field(..., min_length=4)


def _normalize_url(url: str) -> str:
    """Add https:// if the user pasted a bare domain."""
    parsed = urlparse(url)
    if not parsed.scheme:
        return f"https://{url}"
    return url


def _force_httpx_fallback() -> bool:
    return os.environ.get("BRAND_SCAN_FALLBACK", "").strip().lower() == "httpx"


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "product"


def _strip_html(html: str) -> str:
    return _TAG_RE.sub(" ", html)


def _pick_logo(images: list[str], domain: str) -> str | None:
    """Return the first image whose path matches /logo|brand|header/i."""
    for img in images:
        if not img:
            continue
        if _LOGO_HINT_RE.search(img):
            return img
    # Fall back to first absolute image on the same domain, if any.
    for img in images:
        if img and domain and domain in img:
            return img
    return images[0] if images else None


def _extract_palette(text_blobs: list[str]) -> list[str]:
    """Top 4 hex literals by frequency, skipping near-grayscale unless dominant.

    A color is "near-grayscale" when its R, G, B channels differ by <= 16 (so
    pure black/white/gray and very desaturated neutrals all qualify). We only
    keep one such color, and only if it shows up >= 3x more often than any
    chromatic candidate.
    """

    counts: Counter[str] = Counter()
    for blob in text_blobs:
        if not blob:
            continue
        for raw in _HEX_RE.findall(blob):
            normalized = _normalize_hex(raw)
            if normalized:
                counts[normalized] += 1

    if not counts:
        return []

    chromatic: list[tuple[str, int]] = []
    grayscale: list[tuple[str, int]] = []
    for hexv, n in counts.most_common():
        if _is_near_grayscale(hexv):
            grayscale.append((hexv, n))
        else:
            chromatic.append((hexv, n))

    out: list[str] = [hexv for hexv, _ in chromatic[:4]]

    # Allow one dominant grayscale color if it's >=3x the top chromatic count.
    if grayscale and len(out) < 4:
        top_chrom = chromatic[0][1] if chromatic else 0
        if not chromatic or grayscale[0][1] >= max(3 * top_chrom, 3):
            out.append(grayscale[0][0])

    # Top up to 4 with remaining grayscale if we still have slots.
    for hexv, _ in grayscale:
        if len(out) >= 4:
            break
        if hexv not in out:
            out.append(hexv)

    return out[:4]


def _normalize_hex(raw: str) -> str | None:
    """Expand 3-char hex to 6-char and lowercase."""
    if not raw or not raw.startswith("#"):
        return None
    body = raw[1:]
    if len(body) == 3:
        body = "".join(ch * 2 for ch in body)
    if len(body) != 6:
        return None
    return f"#{body.lower()}"


def _is_near_grayscale(hexv: str) -> bool:
    try:
        r = int(hexv[1:3], 16)
        g = int(hexv[3:5], 16)
        b = int(hexv[5:7], 16)
    except ValueError:
        return False
    return max(r, g, b) - min(r, g, b) <= 16


def _extract_tagline(html_blobs: list[str]) -> str:
    for html in html_blobs:
        if not html:
            continue
        m = _OG_DESC_RE.search(html)
        if m:
            return m.group(1).strip()
    for html in html_blobs:
        if not html:
            continue
        m = _H1_RE.search(html)
        if m:
            return _strip_html(m.group(1)).strip()[:200]
    return ""


def _extract_products(catalog_results: list[dict[str, Any]], base_url: str) -> list[dict[str, str]]:
    """Top 5 catalog hits with /products/ in URL → BrandProduct dicts."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in catalog_results:
        url = str(item.get("url", "") or "")
        if not url or not _PRODUCT_PATH_RE.search(url):
            continue
        # Slug from last URL segment.
        path = urlparse(url).path.rstrip("/")
        slug = path.rsplit("/", 1)[-1] if path else ""
        slug = _slugify(slug)
        if slug in seen:
            continue
        seen.add(slug)
        title = str(item.get("title", "")).strip()
        if not title:
            title = slug.replace("-", " ").title()
        # Strip site-suffix junk like "Wool Runner | Allbirds".
        title = re.split(r"\s*[|–—]\s*", title)[0].strip()[:80]
        out.append({"id": slug, "name": title, "sku": slug})
        if len(out) >= 5:
            break
    return out


def _extract_products_from_html(html: str, base_url: str) -> list[dict[str, str]]:
    """Pull /products/ links out of raw HTML when Tavily isn't available."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for href in _HREF_RE.findall(html):
        if not _PRODUCT_PATH_RE.search(href):
            continue
        absolute = urljoin(base_url, href)
        path = urlparse(absolute).path.rstrip("/")
        slug = _slugify(path.rsplit("/", 1)[-1])
        if not slug or slug in seen:
            continue
        seen.add(slug)
        out.append({"id": slug, "name": slug.replace("-", " ").title(), "sku": slug})
        if len(out) >= 5:
            break
    return out


def _longest_prose(extract_results: list[dict[str, Any]]) -> str:
    """Pick the largest raw_content/content blob Tavily returned."""
    best = ""
    for item in extract_results:
        content = str(item.get("raw_content") or item.get("content") or "")
        if len(content) > len(best):
            best = content
    # Strip HTML noise so the LLM critique focuses on prose.
    cleaned = _strip_html(best)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:6000]


async def _synthesize_voice(prose: str) -> tuple[str, bool]:
    """One-shot brand-voice critique via the existing agents runtime.

    Returns (voice_text, fallback_flag). On any failure (no API key, adapter
    error, empty text), returns ("", True).
    """
    if not prose.strip():
        return "", True

    # Lazy import — keeps brand router importable even if agents/* is broken.
    try:
        _services_dir = Path(__file__).resolve().parent.parent.parent
        if str(_services_dir) not in sys.path:
            sys.path.insert(0, str(_services_dir))
        from agents import registry as _registry  # noqa: F401  (side-effect: register adapters)
        from agents import runtime as agents_runtime
        from agents.contract import (
            AdapterExecutionContext,
            AgentSpec,
            RuntimeState,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agents runtime import failed: %s", exc)
        return "", True

    adapter_type = os.environ.get("DEFAULT_ADAPTER", "openai")
    spec = AgentSpec(
        id="brand-voice",
        name="Brand Voice",
        role="critic",
        instructions=(
            "Read the website prose. Return 1 paragraph (<60 words) describing "
            "the brand voice — register, sentence rhythm, what they emphasize, "
            "what they avoid. No headings."
        ),
        adapter_type=adapter_type,
    )
    ctx = AdapterExecutionContext(
        run_id=f"brand-voice-{int(datetime.now(tz=timezone.utc).timestamp())}",
        agent=spec,
        runtime=RuntimeState(),
        config={"adapter": adapter_type},
        context={"prose": prose},
        on_log=None,
    )

    try:
        result = await agents_runtime.execute(ctx)
    except Exception as exc:  # noqa: BLE001
        logger.warning("agents_runtime.execute raised: %s", exc)
        return "", True

    if (result.exit_code or 0) != 0:
        logger.warning("agents_runtime non-zero exit: %s", result.error)
        return "", True

    voice = str(result.result_json.get("text", "")).strip()
    if not voice:
        return "", True
    return voice, False


def _synthesize_profile_from_tavily(
    url: str,
    extract: dict[str, Any],
    catalog: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Build a BrandProfile dict from Tavily extract+search results.

    Returns (profile, prose_blobs) — prose_blobs goes to the LLM voice pass.
    """
    extract_results: list[dict[str, Any]] = list(extract.get("results") or [])
    catalog_results: list[dict[str, Any]] = list(catalog.get("results") or [])
    domain = urlparse(url).netloc

    images: list[str] = []
    for item in extract_results:
        for img in item.get("images") or []:
            if isinstance(img, str):
                images.append(img)
            elif isinstance(img, dict) and img.get("url"):
                images.append(str(img["url"]))

    raw_blobs: list[str] = []
    for item in extract_results:
        rc = str(item.get("raw_content") or item.get("content") or "")
        if rc:
            raw_blobs.append(rc)

    palette = _extract_palette(raw_blobs)
    tagline = _extract_tagline(raw_blobs)
    logo_url = _pick_logo(images, domain)
    products = _extract_products(catalog_results, url)

    name = _brand_name_from_url(url)
    profile: dict[str, Any] = {
        "id": _slugify(name),
        "name": name,
        "logoUrl": logo_url,
        "tagline": tagline,
        "palette": palette,
        "voice": "",
        "products": products,
        "sourceUrl": url,
        "lastScannedAt": _now_iso(),
    }
    return profile, raw_blobs


def _brand_name_from_url(url: str) -> str:
    """Best-effort brand name from the hostname (`www.allbirds.com` → `Allbirds`)."""
    host = urlparse(url).netloc.lower().replace("www.", "")
    root = host.split(".")[0] if host else "brand"
    return root.title() or "Brand"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


async def _httpx_fallback(url: str) -> dict[str, Any]:
    """Fetch via plain httpx when Tavily isn't available; parse with regex."""
    timeout = httpx.Timeout(_HTTPX_TIMEOUT_S)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; CIE-BrandScan/1.0)",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        html = resp.text

    images = [urljoin(url, src) for src in _IMG_SRC_RE.findall(html)]
    palette = _extract_palette([html])
    tagline = _extract_tagline([html])
    domain = urlparse(url).netloc
    logo_url = _pick_logo(images, domain)
    products = _extract_products_from_html(html, url)

    # Site title as a fallback brand name if the URL hostname is generic.
    title_match = _TITLE_RE.search(html)
    title_text = _strip_html(title_match.group(1)).strip() if title_match else ""

    name = _brand_name_from_url(url)
    if title_text and len(title_text) <= 60 and " " not in title_text.strip():
        name = title_text.strip()

    profile: dict[str, Any] = {
        "id": _slugify(name),
        "name": name,
        "logoUrl": logo_url,
        "tagline": tagline,
        "palette": palette,
        "voice": "",
        "products": products,
        "sourceUrl": url,
        "lastScannedAt": _now_iso(),
    }
    return profile


def _build_tavily_client() -> Any | None:
    """Return a TavilyClient or None if env/library not available."""
    if _force_httpx_fallback():
        logger.info("BRAND_SCAN_FALLBACK=httpx forces plain-httpx path")
        return None
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return None
    try:
        from tavily import TavilyClient  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("tavily-python not installed; falling back to httpx")
        return None
    try:
        return TavilyClient(api_key=api_key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("TavilyClient init failed: %s", exc)
        return None


async def _scan_stream(url: str) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE events: phase=fetching → parsing → extracting → complete."""
    url = _normalize_url(url)
    client = _build_tavily_client()

    profile: dict[str, Any] | None = None
    prose_blobs: list[str] = []
    used_fallback = False

    if client is not None:
        try:
            yield {"type": "phase", "phase": "fetching", "url": url}
            extract = await asyncio.wait_for(
                asyncio.to_thread(
                    client.extract,
                    urls=[url],
                    include_images=True,
                    extract_depth="advanced",
                ),
                timeout=_TAVILY_TIMEOUT_S,
            )

            yield {"type": "phase", "phase": "parsing"}
            domain = urlparse(url).netloc
            catalog = await asyncio.wait_for(
                asyncio.to_thread(
                    client.search,
                    query=f"site:{domain} products",
                    max_results=8,
                    include_raw_content=True,
                ),
                timeout=_TAVILY_TIMEOUT_S,
            )

            yield {"type": "phase", "phase": "extracting"}
            profile, prose_blobs = _synthesize_profile_from_tavily(url, extract, catalog)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Tavily scan failed (%s); falling back to httpx", exc)
            client = None  # signal fallback below

    if client is None:
        # Fallback path — plain httpx.
        try:
            yield {"type": "phase", "phase": "fetching", "url": url}
            profile = await _httpx_fallback(url)
            used_fallback = True
            yield {"type": "phase", "phase": "parsing"}
            yield {"type": "phase", "phase": "extracting"}
        except Exception as exc:  # noqa: BLE001
            logger.warning("httpx fallback failed for %s: %s", url, exc)
            yield {"type": "error", "code": "fetch_failed", "url": url}
            return

    assert profile is not None  # for mypy

    # Voice extraction (LLM, optional)
    if used_fallback:
        # No Tavily prose available; try the homepage HTML stripped to text.
        try:
            timeout = httpx.Timeout(_HTTPX_TIMEOUT_S)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as cli:
                resp = await cli.get(url)
                prose_blobs = [_strip_html(resp.text)]
        except Exception:  # noqa: BLE001
            prose_blobs = []

    longest = ""
    for blob in prose_blobs:
        cleaned = re.sub(r"\s+", " ", _strip_html(blob)).strip()
        if len(cleaned) > len(longest):
            longest = cleaned

    if used_fallback:
        # When Tavily is missing, voice is heuristic-only (skip LLM call).
        voice = ""
        voice_fallback = True
    else:
        voice, voice_fallback = await _synthesize_voice(longest[:6000])

    profile["voice"] = voice

    # Persist atomically.
    try:
        _atomic_write_json(_BRAND_FILE, profile)
        logger.info("Wrote scanned brand profile to %s", _BRAND_FILE)
    except OSError as exc:
        logger.error("Failed to persist scanned brand profile: %s", exc)
        yield {"type": "error", "code": "persist_failed", "url": url}
        return

    complete: dict[str, Any] = {
        "type": "phase",
        "phase": "complete",
        "profile": profile,
    }
    if voice_fallback:
        complete["meta"] = {"voice_fallback": True}
    yield complete


@router.post("/scan")
async def scan_brand(body: BrandScanBody) -> Any:
    """Stream a real brand scan as Server-Sent Events.

    4 phases: fetching → parsing → extracting → complete. Falls back to plain
    httpx if Tavily is unavailable, and emits an `error` event on fetch
    failure.
    """
    return event_stream(_scan_stream(body.url))
