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
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from schemas import BrandProfile
from sse import event_stream  # type: ignore[import-not-found]

logger = logging.getLogger("cie.api.brand")

router = APIRouter(prefix="/api/brand", tags=["brand"])

_REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[3]
_BRAND_FILE: Final[Path] = _REPO_ROOT / "fixtures" / "brand.json"
_BRAND_MD: Final[Path] = _REPO_ROOT / "fixtures" / "brand.md"
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


def _atomic_write_text(path: Path, content: str) -> None:
    """Write a UTF-8 text file atomically: tmp file in same dir, then os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".brand-", suffix=".md", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
            if not content.endswith("\n"):
                fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
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


@router.get("/md", response_class=PlainTextResponse)
async def get_brand_md() -> str:
    """Return the persisted Brand.md, or 404 if no scan has run yet.

    The Wiki tab in Brand Memory consumes this directly. The `text/plain`
    response is intentional: the frontend renders with `react-markdown` so we
    never want middlewares to gzip/transform the content into HTML.
    """
    if not _BRAND_MD.exists():
        raise HTTPException(status_code=404, detail="Brand.md not yet generated.")
    try:
        return _BRAND_MD.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("Failed to read %s: %s", _BRAND_MD, exc)
        raise HTTPException(status_code=500, detail="Brand.md unreadable.") from exc


# ---------------------------------------------------------------------------
# POST /api/brand/scan — real web scan via Tavily, with httpx fallback
# ---------------------------------------------------------------------------

# Phase 1 (Tavily extract) timeouts; we keep these tight so the demo SSE
# stream never feels frozen.
_TAVILY_TIMEOUT_S: Final[float] = 45.0
_HTTPX_TIMEOUT_S: Final[float] = 20.0

# In-memory scan cache. Keyed by normalized URL (lower, no trailing slash).
# Stores (timestamp, recorded_events) so subsequent scans of the same site
# replay instantly without re-hitting Tavily/LLM. 24h TTL is plenty for the
# hackathon scope; survives server uptime, evicts on lookup.
_SCAN_CACHE_TTL_S: Final[float] = 24 * 60 * 60.0
_SCAN_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _scan_cache_key(url: str) -> str:
    return url.strip().lower().rstrip("/")


def _scan_cache_get(url: str) -> list[dict[str, Any]] | None:
    """Return cached events for `url` if fresh, else None (and evict)."""
    import time

    key = _scan_cache_key(url)
    entry = _SCAN_CACHE.get(key)
    if entry is None:
        return None
    ts, events = entry
    if time.time() - ts > _SCAN_CACHE_TTL_S:
        _SCAN_CACHE.pop(key, None)
        return None
    return events


def _scan_cache_put(url: str, events: list[dict[str, Any]]) -> None:
    """Store events under the normalized URL key; only call on full success."""
    import time

    _SCAN_CACHE[_scan_cache_key(url)] = (time.time(), events)
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


_BRAND_LLM_PROMPT: Final[str] = """You are extracting a brand profile from a website's content.

Return STRICT JSON with this exact shape (and NOTHING else — no prose, no fences):
{{
  "name": "...",
  "tagline": "...",
  "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "voice": "...",
  "products": [{{"name":"...","sku":"slug-form"}}],
  "logoUrl": null,
  "brandMd": "# ...\\n\\n..."
}}

Rules:
- name: 1-3 words, the brand's display name
- tagline: <=80 chars, brand value prop
- palette: 4 hex colors that capture the brand's visual identity (avoid pure black/white)
- voice: ONE paragraph (<60 words) describing register, sentence rhythm, what they emphasize, what they avoid
- products: up to 5 items distilled from CATALOG_TITLES; sku is a kebab-case slug
- logoUrl: pick the most-likely logo image URL from IMAGES, or null
- brandMd: a complete markdown briefing with these sections in order:
    # {{name}}
    > {{tagline}}
    ## Voice
    {{voice}}
    ## Palette
    | Color | Hex |
    | --- | --- |
    | (one row per palette entry, color name + hex)
    ## Products
    - bullet list of products
    ## Source
    {{url}} — scanned automatically.

URL: {url}

HOMEPAGE PROSE (truncated):
{prose}

CATALOG TITLES:
{catalog}

IMAGE URLS:
{images}
"""


def _strip_json_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if present."""
    s = text.strip()
    if s.startswith("```"):
        # Drop opening fence (and optional language tag) and trailing fence
        s = re.sub(r"^```[a-zA-Z0-9]*\s*\n?", "", s)
        if s.endswith("```"):
            s = s[: -len("```")]
    return s.strip()


def _coerce_brand_payload(raw: str) -> dict[str, Any] | None:
    """Best-effort extract a JSON object from an LLM response.

    Handles plain JSON, fenced JSON, or JSON embedded inside prose. Returns
    None when no balanced object can be found.
    """
    if not raw:
        return None
    candidates = [raw, _strip_json_fences(raw)]
    # Pull the first balanced {...} block as a last resort.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        candidates.append(match.group(0))
    for candidate in candidates:
        try:
            obj = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        if isinstance(obj, dict):
            return obj
    return None


def _brand_md_from_profile(profile: dict[str, Any]) -> str:
    """Heuristic markdown brief from a profile dict (no LLM)."""
    name = str(profile.get("name") or "Brand").strip() or "Brand"
    tagline = str(profile.get("tagline") or "").strip()
    voice = str(profile.get("voice") or "").strip()
    palette = list(profile.get("palette") or [])
    products = list(profile.get("products") or [])
    source_url = str(profile.get("sourceUrl") or "").strip()
    last_scanned = str(profile.get("lastScannedAt") or "").strip()

    lines: list[str] = [f"# {name}"]
    if tagline:
        lines.append("")
        lines.append(f"> {tagline}")
    if voice:
        lines.extend(["", "## Voice", "", voice])
    if palette:
        lines.extend(["", "## Palette", "", "| Swatch | Hex |", "| --- | --- |"])
        for hex_val in palette[:8]:
            lines.append(f"| ◼ | `{hex_val}` |")
    if products:
        lines.extend(["", "## Products", ""])
        for product in products[:8]:
            pname = str(product.get("name") or "").strip() if isinstance(product, dict) else str(product)
            psku = str(product.get("sku") or "").strip() if isinstance(product, dict) else ""
            if pname:
                if psku:
                    lines.append(f"- **{pname}** — `{psku}`")
                else:
                    lines.append(f"- {pname}")
    if source_url or last_scanned:
        lines.extend(["", "## Source", ""])
        if source_url:
            lines.append(f"- URL: <{source_url}>")
        if last_scanned:
            lines.append(f"- Scanned: {last_scanned}")

    return "\n".join(lines).rstrip() + "\n"


async def _llm_synthesize_brand(
    *,
    url: str,
    homepage_prose: str,
    catalog_titles: list[str],
    images: list[str],
) -> tuple[dict[str, Any] | None, str | None]:
    """Single structured-output LLM call.

    Returns (parsed_profile_dict_or_None, brand_md_or_None). On any failure —
    missing prose, agents runtime crash, malformed JSON — returns (None, None)
    and the caller falls back to the heuristic path.

    Trusts the agents runtime's pioneer→openai→claude_code→hermes fallback
    chain. Does NOT short-circuit on the first adapter exception.
    """
    if not homepage_prose.strip():
        return None, None

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
        logger.warning("Agents runtime import failed for brand synth: %s", exc)
        return None, None

    adapter_type = os.environ.get("DEFAULT_ADAPTER", "openai")
    prompt = _BRAND_LLM_PROMPT.format(
        url=url,
        prose=homepage_prose[:6000],
        catalog="\n".join(f"- {t}" for t in catalog_titles[:12]),
        images="\n".join(f"- {img}" for img in images[:12]),
    )
    spec = AgentSpec(
        id="brand-synth",
        name="Brand Synthesizer",
        role="critic",
        instructions=(
            "You distill a brand profile from a website's homepage prose. "
            "You return strict JSON only — no prose, no markdown fences."
        ),
        adapter_type=adapter_type,
    )
    ctx = AdapterExecutionContext(
        run_id=f"brand-synth-{int(datetime.now(tz=timezone.utc).timestamp())}",
        agent=spec,
        runtime=RuntimeState(),
        config={"adapter": adapter_type},
        context={"prose": prompt},
        on_log=None,
    )

    try:
        result = await agents_runtime.execute(ctx)
    except Exception as exc:  # noqa: BLE001
        logger.warning("brand-synth runtime.execute raised (no adapter usable): %s", exc)
        return None, None

    if (result.exit_code or 0) != 0:
        logger.warning("brand-synth runtime non-zero exit: %s", result.error)
        return None, None

    raw_text = str(result.result_json.get("text", "")).strip()
    parsed = _coerce_brand_payload(raw_text)
    if parsed is None:
        logger.warning("brand-synth LLM returned unparseable JSON (len=%d)", len(raw_text))
        return None, None

    brand_md = str(parsed.pop("brandMd", "") or "").strip() or None
    return parsed, brand_md


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
    """Yield SSE events for a brand scan.

    Wraps `_scan_stream_uncached` with a 24h URL-keyed cache so repeat scans
    of the same site replay instantly. The cached path still emits the same
    phase events (with a tiny `meta.cached=true` flag) so the UI's progress
    animation stays continuous. We only cache fully-successful runs — error
    or fetch-failed paths never seed the cache.
    """
    cached = _scan_cache_get(url)
    if cached is not None:
        for ev in cached:
            # Decorate phase events so observers (and tests) can detect the
            # replay path; payload contents are otherwise identical.
            if ev.get("type") == "phase":
                meta = dict(ev.get("meta") or {})
                meta["cached"] = True
                ev = {**ev, "meta": meta}
            yield ev
        return

    recorded: list[dict[str, Any]] = []
    success = False
    try:
        async for ev in _scan_stream_uncached(url):
            recorded.append(ev)
            yield ev
            if ev.get("type") == "error":
                success = False
            elif ev.get("type") == "phase" and ev.get("phase") in {"complete", "brand_md_refined"}:
                # Reaching `complete` means the heuristic profile is ready and
                # was persisted; safe to cache. `brand_md_refined` overwrites.
                success = True
    finally:
        if success:
            _scan_cache_put(url, recorded)


async def _scan_stream_uncached(url: str) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE events: phase=fetching → parsing → extracting → complete → brand_md_refined."""
    url = _normalize_url(url)
    client = _build_tavily_client()

    profile: dict[str, Any] | None = None
    prose_blobs: list[str] = []
    used_fallback = False

    catalog: dict[str, Any] | None = None
    if client is not None:
        try:
            yield {"type": "phase", "phase": "fetching", "url": url}
            domain = urlparse(url).netloc

            # Run extract + search concurrently. Both are independent Tavily
            # calls; awaiting them sequentially used to dominate wall time
            # (up to 2 × _TAVILY_TIMEOUT_S in the worst case). asyncio.gather
            # collapses them to a single timeout window.
            extract_task = asyncio.wait_for(
                asyncio.to_thread(
                    client.extract,
                    urls=[url],
                    include_images=True,
                    # extract_depth="basic" is intentional: 5–12s typical vs
                    # 30–45s for "advanced". Homepage HTML + image list is
                    # enough for palette / voice / logo synthesis; the
                    # catalog comes from the parallel Tavily.search call.
                    extract_depth="basic",
                ),
                timeout=_TAVILY_TIMEOUT_S,
            )
            search_task = asyncio.wait_for(
                asyncio.to_thread(
                    client.search,
                    query=f"site:{domain} products",
                    max_results=8,
                    include_raw_content=True,
                ),
                timeout=_TAVILY_TIMEOUT_S,
            )

            extract, catalog = await asyncio.gather(extract_task, search_task)

            yield {"type": "phase", "phase": "parsing"}

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

    # ── Step A: Ship the heuristic profile + brand.md immediately ─────────
    # Goal: get the user to BrandConfirmCard within ~10s on the cold path.
    # The LLM pass below polishes brand.md in the background and emits a
    # follow-up `brand_md_refined` event; if the UI has already advanced,
    # the refined markdown still lands in fixtures/brand.md for the next
    # page load.

    heuristic_brand_md = _brand_md_from_profile(profile)

    # Persist heuristic snapshot atomically. brand.md is non-load-bearing if
    # writes fail; the JSON profile is the source of truth.
    try:
        _atomic_write_json(_BRAND_FILE, profile)
        logger.info("Wrote heuristic brand profile to %s", _BRAND_FILE)
    except OSError as exc:
        logger.error("Failed to persist scanned brand profile: %s", exc)
        yield {"type": "error", "code": "persist_failed", "url": url}
        return

    try:
        _atomic_write_text(_BRAND_MD, heuristic_brand_md)
        logger.info(
            "Wrote heuristic brand.md (%d bytes) to %s",
            len(heuristic_brand_md),
            _BRAND_MD,
        )
    except OSError as exc:
        logger.warning("Failed to persist heuristic brand.md: %s", exc)

    complete_event: dict[str, Any] = {
        "type": "phase",
        "phase": "complete",
        "profile": profile,
        "meta": {"heuristic": True} if (longest and not used_fallback) else {},
    }
    yield complete_event

    # ── Step B: Background LLM polish — only when Tavily prose is available ─
    # On httpx-fallback we stop here (kept test-safe and offline-safe per the
    # original comment).
    if not (longest and not used_fallback):
        return

    catalog_titles: list[str] = []
    if isinstance(catalog, dict):
        catalog_titles = [
            str(item.get("title") or "")
            for item in (catalog.get("results") or [])
            if isinstance(item, dict) and item.get("title")
        ][:12]
    seed_images: list[str] = []
    if profile.get("logoUrl"):
        seed_images.append(str(profile["logoUrl"]))

    try:
        enriched, brand_md_llm = await _llm_synthesize_brand(
            url=url,
            homepage_prose=longest,
            catalog_titles=catalog_titles,
            images=seed_images,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM brand synthesis failed: %s", exc)
        enriched, brand_md_llm = None, None

    if enriched:
        for key in ("name", "tagline", "voice", "logoUrl"):
            value = enriched.get(key)
            if value:
                profile[key] = value
        llm_palette = enriched.get("palette")
        if isinstance(llm_palette, list) and llm_palette:
            profile["palette"] = [str(c) for c in llm_palette[:6]]
        llm_products = enriched.get("products")
        if isinstance(llm_products, list) and llm_products:
            profile["products"] = [
                {"name": str(p.get("name", "")), "sku": str(p.get("sku", ""))}
                for p in llm_products
                if isinstance(p, dict) and p.get("name")
            ][:8]
    elif not profile.get("voice"):
        # Enrichment didn't run — try the dedicated voice helper as a final
        # rescue so the confirm card has a non-empty voice paragraph.
        try:
            voice, _ = await _synthesize_voice(longest[:6000])
            if voice:
                profile["voice"] = voice
        except Exception as exc:  # noqa: BLE001
            logger.warning("Voice rescue failed: %s", exc)

    refined_brand_md = (brand_md_llm or "").strip() or _brand_md_from_profile(profile)

    # Re-persist with the polished output.
    try:
        _atomic_write_json(_BRAND_FILE, profile)
    except OSError as exc:
        logger.warning("Failed to persist refined brand profile: %s", exc)

    try:
        _atomic_write_text(_BRAND_MD, refined_brand_md)
        logger.info(
            "Refined brand.md (%d bytes) written to %s",
            len(refined_brand_md),
            _BRAND_MD,
        )
    except OSError as exc:
        logger.warning("Failed to persist refined brand.md: %s", exc)

    yield {
        "type": "phase",
        "phase": "brand_md_refined",
        "profile": profile,
        "brandMd": refined_brand_md,
    }


@router.post("/scan")
async def scan_brand(body: BrandScanBody) -> Any:
    """Stream a real brand scan as Server-Sent Events.

    4 phases: fetching → parsing → extracting → complete. Falls back to plain
    httpx if Tavily is unavailable, and emits an `error` event on fetch
    failure.
    """
    return event_stream(_scan_stream(body.url))
