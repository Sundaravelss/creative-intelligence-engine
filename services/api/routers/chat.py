"""Chat router.

Two surfaces under ``/api/chat``:

Session persistence (existing):
- ``GET    /sessions``                    — list (most recent first, ≤ limit)
- ``POST   /sessions``                    — create empty session, returns id
- ``GET    /sessions/{id}``               — session + ordered messages
- ``PATCH  /sessions/{id}``               — rename / update adapter or fallback
- ``DELETE /sessions/{id}``               — delete session + cascade messages
- ``POST   /sessions/{id}/messages``      — append one message

Chat completions (new):
- ``POST   /completions``                 — SSE stream of LLM reply + image gen
                                            Used by Studio + ``/agents/[id]``.

The frontend calls these from ``apps/web/lib/chat.ts``. Append is debounced
client-side (~250ms) so SSE token streams don't hammer the DB.
"""

from __future__ import annotations

import asyncio
import logging
import re
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import delete, select

from db import session_scope  # type: ignore[import-not-found]
from models_db import ChatMessage, ChatSession  # type: ignore[import-not-found]
from sse import event_stream  # type: ignore[import-not-found]

# Allow `from agents.*` imports when uvicorn is launched from services/api/.
_SERVICES_DIR = Path(__file__).resolve().parent.parent.parent
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

from agents import runtime as agent_runtime  # noqa: E402
from agents import registry as _registry  # noqa: E402, F401  (side-effect import)
from agents.contract import (  # noqa: E402
    AdapterExecutionContext,
    AgentSpec,
    RuntimeState,
)
from agents.personas import PERSONAS, get_persona  # noqa: E402

# FAL adapter — imported lazily inside the handler so test fixtures can monkey
# -patch `services.api.adapters_gen.fal.stream_generate` without paying the
# import cost when the chat router is mounted in a no-FAL test.

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


# ---------------------------------------------------------------------------
# Chat completions endpoint — POST /api/chat/completions
# ---------------------------------------------------------------------------


class ChatMessageInput(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatAttachmentInput(BaseModel):
    url: str
    filename: str | None = None
    content_type: str | None = None


class ChatCompletionsInput(BaseModel):
    messages: list[ChatMessageInput] = Field(default_factory=list)
    agent_id: str | None = None
    session_id: str | None = None
    adapter: str | None = None
    # FAL-hosted reference images uploaded via POST /api/chat/upload. When
    # present, the persona's system prompt is augmented with a directive to
    # include `reference_url="..."` on its `<image .../>` sentinel so the
    # backend routes through fal-ai/flux/dev/image-to-image.
    attachments: list[ChatAttachmentInput] = Field(default_factory=list)
    # When present, the brand profile (name + palette + logoUrl + tagline +
    # voice) is woven into the persona's system prompt so generations stay
    # on-brand. The frontend reads /api/brand and forwards it here. When
    # absent, we lazily load fixtures/brand.json server-side as a fallback
    # so the user doesn't have to re-fetch it on every turn.
    brand: dict[str, Any] | None = None


# Sentinel-tag protocol: persona emits
#   <image prompt="..." aspect="9:16" />                  ← text-to-image
#   <image prompt="..." aspect="..." reference_url="..."/> ← image-to-image
#
# The streaming chunk parser detects the tag, pauses text passthrough until
# the closing `/>`, and dispatches FAL (text-to-image OR image-to-image
# based on whether reference_url is present). Three styled variants are
# emitted per sentinel.
_IMAGE_TAG_PATTERN = re.compile(
    r"""
    <image\s+                                          # opening
    (?P<attrs>[^>]*?)                                  # all attributes (we parse them below)
    \s*/>                                              # self-closing
    """,
    re.VERBOSE | re.IGNORECASE | re.DOTALL,
)
_ATTR_PATTERN = re.compile(
    r'(?P<key>\w+)\s*=\s*"(?P<value>[^"]*)"', re.IGNORECASE
)

# Default FAL models. Cheap + fast for from-scratch; flux/dev/image-to-image
# when the persona supplies a reference_url.
_DEFAULT_FAL_MODEL = "fal-ai/flux/schnell"
_I2I_FAL_MODEL = "fal-ai/flux/dev/image-to-image"

# Repo-root-relative fallback brand fixture path. Resolved at module import.
_BRAND_FIXTURE_PATH = (
    Path(__file__).resolve().parents[3] / "fixtures" / "brand.json"
)


def _load_brand_fallback() -> dict[str, Any] | None:
    """Best-effort load of fixtures/brand.json so chat-completions still has
    brand context when the frontend forgets to forward `brand` on the body.
    Errors are swallowed (returns None) — brand context is enrichment, not
    a hard requirement.
    """
    try:
        if not _BRAND_FIXTURE_PATH.exists():
            return None
        import json as _json

        return _json.loads(_BRAND_FIXTURE_PATH.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def _brand_context_block(brand: dict[str, Any]) -> str:
    """Render the brand profile as a compact block to append to the persona
    system prompt. Empty / missing fields are skipped.
    """
    name = (brand.get("name") or "").strip()
    tagline = (brand.get("tagline") or "").strip()
    voice = (brand.get("voice") or "").strip()
    palette = brand.get("palette") or []
    logo_url = (brand.get("logoUrl") or "").strip()
    products = brand.get("products") or []
    source_url = (brand.get("sourceUrl") or "").strip()

    if not (name or tagline or palette or logo_url):
        return ""

    lines: list[str] = ["BRAND CONTEXT (use this on every reply — stay on-brand)"]
    if name:
        lines.append(f"- Brand name: {name}")
    if tagline:
        lines.append(f"- Tagline: {tagline}")
    if source_url:
        lines.append(f"- Site: {source_url}")
    if isinstance(palette, list) and palette:
        swatches = ", ".join(str(c) for c in palette[:8])
        lines.append(f"- Palette (hex): {swatches}")
    if voice:
        lines.append(f"- Voice notes: {voice[:300]}")
    if logo_url:
        lines.append(f"- Logo URL (for reference): {logo_url}")
    if isinstance(products, list) and products:
        labels: list[str] = []
        for p in products[:6]:
            if isinstance(p, dict):
                labels.append(str(p.get("name") or p.get("id") or ""))
            else:
                labels.append(str(p))
        labels = [s for s in labels if s]
        if labels:
            lines.append(f"- Featured products: {', '.join(labels)}")

    lines.append(
        "When you propose visual treatments and emit your <image .../> sentinel, "
        "weave the brand name, palette, and product context into the prompt — "
        "do NOT invent fake brand names like 'Premium' or 'Acme'. If the user "
        "uploads a reference image (their logo or a product), use it as the "
        "reference_url so the variants honor the actual asset."
    )
    return "\n".join(lines)

_ASPECT_TO_IMAGE_SIZE: dict[str, str] = {
    "9:16": "portrait_16_9",
    "16:9": "landscape_16_9",
    "1:1": "square_hd",
    "4:5": "portrait_4_3",
}


def _build_user_prompt(messages: list[ChatMessageInput]) -> str:
    """Flatten message history into a single prompt string for adapters that
    don't support multi-turn natively (e.g. claude_code subprocess).

    The persona's ``system_prompt`` is injected separately via
    ``AgentSpec.instructions``; here we just concatenate the conversation.
    """
    lines: list[str] = []
    for m in messages:
        role = m.role.lower().strip()
        if role == "user":
            lines.append(f"User: {m.content}")
        elif role == "assistant":
            lines.append(f"Assistant: {m.content}")
        elif role == "system":
            # System lines from the client are advisory only — the persona's
            # system_prompt always wins.
            lines.append(f"[system note: {m.content}]")
    lines.append("Assistant:")
    return "\n\n".join(lines)


async def _generate_image(
    prompt: str,
    aspect: str | None,
    reference_url: str | None = None,
) -> tuple[str | None, str | None]:
    """Submit a FAL request and return (url, error). Network-bound; ~5-30 s.

    When ``reference_url`` is supplied, dispatches to
    ``fal-ai/flux/dev/image-to-image`` so the result is a styled variation
    of the user's uploaded image rather than a from-scratch generation.
    """
    from adapters_gen import fal  # type: ignore[import-not-found]

    if reference_url:
        model_id = _I2I_FAL_MODEL
        params: dict[str, Any] = {
            "prompt": prompt,
            "image_url": reference_url,
            # 0.75 keeps recognizable composition while honoring the new
            # style suffix in the prompt. 1.0 = pure text-to-image, 0.0 = no
            # change.
            "strength": 0.75,
        }
    else:
        model_id = _DEFAULT_FAL_MODEL
        params = {"prompt": prompt}

    image_size = _ASPECT_TO_IMAGE_SIZE.get((aspect or "1:1").strip())
    if image_size:
        params["image_size"] = image_size

    try:
        completed: dict[str, Any] | None = None
        async for evt in fal.stream_generate(model_id, params):
            phase = evt.get("phase")
            if phase == "completed":
                completed = evt.get("result") or {}
                break
            if phase == "error":
                return None, str(evt.get("error") or "fal_unknown_error")
        if not completed:
            return None, "fal_no_result"
        url = fal.extract_artifact_url(completed)
        if not url:
            return None, "fal_no_url"
        return url, None
    except Exception as exc:  # noqa: BLE001 — surface as text
        logger.exception("FAL stream_generate failed")
        return None, str(exc)


async def _drive_chat_stream(
    body: ChatCompletionsInput,
) -> AsyncIterator[dict[str, Any]]:
    """Top-level async generator: yields SSE events for one chat turn.

    Pipeline:
      1. Look up persona (404 if agent_id given but unknown).
      2. Spawn the LLM via runtime.execute, draining its on_log queue.
      3. Stream chunks to the client as text_delta — but watch for the image
         sentinel tag. When found:
           a. emit `tool_use` (chip)
           b. await FAL via _generate_image
           c. emit `artifact`
           d. resume passthrough
      4. After the LLM task ends, emit text_done + done.

    Failure modes:
      - adapter raises → runtime catches and falls through; if the whole
        chain fails, runtime returns exit_code=0 with provider="none" and
        empty text. We still emit a graceful done.
      - FAL fails → emit artifact with error metadata; the chat continues.
    """
    persona = get_persona(body.agent_id)
    if body.agent_id and body.agent_id not in PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown agent_id: {body.agent_id}")

    run_id = f"chat_{secrets.token_hex(6)}"
    yield {
        "type": "started",
        "agentId": persona.id,
        "agentName": persona.name,
        "runId": run_id,
    }

    # Build the AdapterExecutionContext.
    # Studio is a Claude-first chat surface — claude_code is the default
    # adapter for chat-completions regardless of DEFAULT_ADAPTER env (which
    # the campaign orchestrator at /api/agents/campaign still respects).
    # Caller can still override per-request via body.adapter.
    prompt = _build_user_prompt(body.messages)

    # If the user attached one or more images via POST /api/chat/upload,
    # weave the URLs into the prompt AND into the system instructions so
    # Sage emits a sentinel with reference_url= rather than treating the
    # tag as conversation noise. Claude can't fetch URLs — we have to be
    # very explicit in the system prompt.
    instructions = persona.system_prompt

    # Brand context (name, palette, logo, voice) goes into the system
    # prompt so Sage doesn't invent fake brand names. Source priority:
    # request body → fixtures/brand.json fallback. Either way the user
    # NEVER has to re-supply brand on each turn.
    brand_payload = body.brand or _load_brand_fallback() or {}
    if brand_payload:
        block = _brand_context_block(brand_payload)
        if block:
            instructions = instructions + "\n\n" + block
    if body.attachments:
        attachment_lines = "\n".join(
            f'<attached_image url="{a.url}" filename="{a.filename or ""}" />'
            for a in body.attachments
        )
        prompt = f"{prompt.rstrip()}\n\n{attachment_lines}"
        first_url = body.attachments[0].url
        instructions = (
            instructions
            + "\n\n"
            + "IMPORTANT — REFERENCE IMAGE ATTACHED\n"
            + f"The user attached image(s). The first reference URL is:\n"
            + f"  {first_url}\n"
            + "When you emit your <image .../> sentinel for an image reply,\n"
            + "you MUST include `reference_url=\"" + first_url + "\"` so the\n"
            + "platform routes to image-to-image and produces three styled\n"
            + "remixes of the user's actual photo (not from-scratch).\n"
            + "Do NOT describe the image as if you can see it — you cannot.\n"
            + "Just propose three creative treatments and emit the sentinel\n"
            + "with the reference_url above.\n"
        )

    config: dict[str, Any] = {"adapter": body.adapter or "claude_code"}

    runtime_state = RuntimeState(session_id=body.session_id)

    chunk_queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()

    async def _on_log(stream: str, chunk: str) -> None:
        # Drop stderr + bracketed status lines (same filter as the
        # orchestrator's streaming wrapper).
        if stream != "stdout" or not chunk:
            return
        stripped = chunk.lstrip()
        if not stripped or stripped.startswith("["):
            return
        await chunk_queue.put(("delta", chunk))

    ctx = AdapterExecutionContext(
        run_id=run_id,
        agent=AgentSpec(
            id=persona.id,
            name=persona.name,
            role=persona.role,
            instructions=instructions,
            adapter_type=body.adapter or "claude_code",
        ),
        runtime=runtime_state,
        config=config,
        context={"prompt": prompt},
        on_log=_on_log,
    )

    loop = asyncio.get_running_loop()
    llm_task = asyncio.create_task(agent_runtime.execute(ctx))
    llm_task.add_done_callback(
        lambda _t: loop.call_soon_threadsafe(chunk_queue.put_nowait, ("end", None))
    )

    # Buffered-passthrough sentinel parser. We hold back the LAST `_HOLDBACK`
    # chars of the stream so a partial `<image ...` straddling chunks doesn't
    # leak through as text_delta. When a complete tag matches inside the
    # buffer, we emit the prose before it as text_delta, dispatch FAL, then
    # continue with the prose after.
    _HOLDBACK = 256
    pending = ""
    full_text_parts: list[str] = []

    async def _flush_safe(final: bool = False) -> AsyncIterator[dict[str, Any]]:
        """Emit any prose from `pending` that's safe to send (no truncated tag).

        On final flush, emit everything that's left. When an image sentinel
        is matched, fan out to 3 FAL variants in parallel (editorial /
        golden-hour / overcast) and emit one tool_use + one artifact per
        variant, all sharing a `shotId` so the canvas carousel groups them.
        """
        nonlocal pending
        while True:
            match = _IMAGE_TAG_PATTERN.search(pending)
            if match:
                before = pending[: match.start()]
                if before:
                    full_text_parts.append(before)
                    yield {
                        "type": "text_delta",
                        "nodeId": persona.id,
                        "agentId": persona.id,
                        "chunk": before,
                    }
                # Parse all key="value" attributes inside the sentinel.
                attrs: dict[str, str] = {
                    m.group("key").lower(): m.group("value")
                    for m in _ATTR_PATTERN.finditer(match.group("attrs") or "")
                }
                tag_prompt = (attrs.get("prompt") or "").strip()
                tag_aspect = (attrs.get("aspect") or "1:1").strip()
                tag_reference_url = (attrs.get("reference_url") or "").strip() or None
                shot_id = f"shot_{uuid.uuid4().hex[:8]}"

                # Fan out 3 style variants in parallel. Each variant suffixes
                # the persona's prompt with a distinct treatment so FAL
                # produces visibly different results.
                variants = (
                    ("editorial", "editorial photography, clean composition, neutral palette"),
                    ("golden-hour", "golden hour sunlight, warm tones, soft long shadows"),
                    ("overcast", "overcast daylight, muted high-key colors, even lighting"),
                )
                tool_use_ids = [f"tool_{uuid.uuid4().hex[:10]}" for _ in variants]

                # Announce all 3 generations up front so the chat shows 3 chips.
                for (label, _suffix), tool_use_id in zip(variants, tool_use_ids):
                    yield {
                        "type": "tool_use",
                        "tool": (
                            "edit_image" if tag_reference_url else "generate_image"
                        ),
                        "toolUseId": tool_use_id,
                        "input": {
                            "prompt": tag_prompt,
                            "aspect": tag_aspect,
                            "variantLabel": label,
                            "referenceUrl": tag_reference_url,
                        },
                    }

                async def _gen_variant(
                    label: str, suffix: str
                ) -> tuple[str, str, str | None, str | None]:
                    full_prompt = f"{tag_prompt}, {suffix}"
                    url, err = await _generate_image(
                        full_prompt, tag_aspect, reference_url=tag_reference_url
                    )
                    return label, full_prompt, url, err

                results = await asyncio.gather(
                    *[_gen_variant(lbl, sfx) for (lbl, sfx) in variants]
                )

                for i, (label, full_prompt, url, err) in enumerate(results):
                    artifact_id = f"art_{uuid.uuid4().hex[:10]}"
                    yield {
                        "type": "artifact",
                        "artifact": {
                            "id": artifact_id,
                            "kind": "image",
                            "name": f"{label.title()} — {tag_prompt[:50]}",
                            "url": url or "",
                            "shotId": shot_id,
                            "variantId": f"{shot_id}-v{i}",
                            "variantLabel": label,
                            "meta": {
                                "tool_use_id": tool_use_ids[i],
                                "aspect": tag_aspect,
                                "prompt": full_prompt,
                                "variantLabel": label,
                                "shotId": shot_id,
                                "error": err,
                            },
                        },
                    }
                pending = pending[match.end():]
                continue

            if final:
                if pending:
                    full_text_parts.append(pending)
                    yield {
                        "type": "text_delta",
                        "nodeId": persona.id,
                        "agentId": persona.id,
                        "chunk": pending,
                    }
                pending = ""
            else:
                # Hold back the tail; release everything older than _HOLDBACK
                # so a partial tag straddling chunks isn't leaked.
                if len(pending) > _HOLDBACK:
                    safe_len = len(pending) - _HOLDBACK
                    safe = pending[:safe_len]
                    full_text_parts.append(safe)
                    yield {
                        "type": "text_delta",
                        "nodeId": persona.id,
                        "agentId": persona.id,
                        "chunk": safe,
                    }
                    pending = pending[safe_len:]
            return

    while True:
        kind, payload = await chunk_queue.get()
        if kind == "delta" and payload:
            pending += payload
            async for evt in _flush_safe():
                yield evt
            continue
        # kind == "end"
        async for evt in _flush_safe(final=True):
            yield evt
        break

    # Surface any LLM error so the client can show it (the orchestrator's
    # graceful all-failed result still has exit_code=0; we treat that as
    # success).
    try:
        result = llm_task.result()
        meta_failed = (result.result_json or {}).get("meta", {}).get(
            "all_adapters_failed"
        )
    except BaseException as exc:  # noqa: BLE001
        meta_failed = True
        logger.exception("chat completions LLM task raised: %s", exc)

    yield {
        "type": "text_done",
        "nodeId": persona.id,
        "agentId": persona.id,
        "fullText": "".join(full_text_parts),
    }
    yield {
        "type": "done",
        "runId": run_id,
        "agentId": persona.id,
        "all_adapters_failed": bool(meta_failed),
    }


@router.post("/upload")
async def chat_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    """Proxy a multipart upload to FAL storage and return the public URL.

    Used by the Studio composer's `+` button so the browser doesn't need a
    FAL_KEY. The returned URL is what the user message includes via
    `<attached_image url="..." />` so Sage can route it to image-to-image.
    """
    from adapters_gen import fal  # type: ignore[import-not-found]

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty file")
    filename = file.filename or "upload.bin"
    content_type = file.content_type or "application/octet-stream"

    try:
        url = await fal.upload_file(content, filename, content_type)
    except Exception as exc:  # noqa: BLE001
        logger.exception("FAL storage upload failed")
        raise HTTPException(status_code=502, detail=f"FAL upload failed: {exc}") from exc

    return {"url": url, "filename": filename, "contentType": content_type}


@router.post("/completions")
async def chat_completions(body: ChatCompletionsInput) -> Any:
    """Stream a chat reply (with optional inline image generation) as SSE.

    Used by Studio (`/studio`) and per-agent chats (`/agents/[id]`). The
    legacy 6-node orchestrator at ``/api/agents/campaign`` is unchanged —
    that's reserved for the future "Run full campaign" button.
    """
    # Validate agent_id synchronously BEFORE the SSE stream starts so a bad
    # id returns a clean 404 instead of half-streaming an error event.
    if body.agent_id and body.agent_id not in PERSONAS:
        raise HTTPException(
            status_code=404, detail=f"Unknown agent_id: {body.agent_id}"
        )

    async def _events() -> AsyncIterator[dict[str, str]]:
        import json

        try:
            async for evt in _drive_chat_stream(body):
                yield {
                    "event": str(evt.get("type", "message")),
                    "data": json.dumps(evt, default=str),
                }
        except Exception as exc:  # noqa: BLE001
            logger.exception("chat completions failed")
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "error": str(exc)}),
            }

    return event_stream(_events())


__all__ = ["router"]
