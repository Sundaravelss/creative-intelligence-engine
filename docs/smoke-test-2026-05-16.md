# Smoke Test — 2026-05-16

End-to-end functional sweep of Creative Intelligence Engine while two other sessions evolved the UI/onboarding in parallel. Default adapter: `pioneer` (sponsor); fallback chain: `pioneer,claude_code,hermes_cli,openai,together`. Claude CLI version: `2.1.143`. Pioneer real call: HTTP 200 (Bearer + X-API-Key both accepted).

## Headline

- **Backend**: 53 / 53 api tests pass · 5 / 5 agent orchestrator tests pass.
- **Frontend**: pnpm `type-check` clean (0 errors) · 13 / 13 Playwright specs pass.
- **End-to-end campaign**: 26 SSE events in 7.6s through Pioneer real fine-tune. All event taxonomy classes emitted (`run_start`, `started`, `thought`×2, `agent_step_*`×8, `artifact`×3, `node_*`×10, `done`).
- **Chat persistence (NEW)**: full CRUD round-trip works; SQLite at `fixtures/cie.db` (28 KB after one session lifecycle).
- **Live router visibility**: 19 paths in OpenAPI on the running uvicorn (no `--reload` flag — needs restart to pick up new `/api/chat/*` and `/api/canvas/*` routes; tests confirm correctness via `TestClient`).

## Pre-flight

| # | Check | Status | Note |
|---|-------|--------|------|
| 0a | `claude --version` on PATH | PASS | 2.1.143 |
| 0b | `curl https://api.pioneer.ai/v1/chat/completions` | PASS | HTTP 200 with `Authorization: Bearer` AND `X-API-Key` |
| 0c | API booted at :8100 | PASS | `/health` → 200 |
| 0d | Web booted at :3000 | PASS | `/` → 307 → `/studio` |
| 0e | `uv run pytest` (services/api) | PASS | 53/53 |
| 0f | `uv run pytest` (services/agents) | PASS | 5/5 orchestrator |
| 0g | `pnpm --filter web type-check` | PASS | 0 errors |
| 0h | `pnpm --filter web exec playwright test` | PASS | 13/13 |

## Per-feature sweep

| # | Surface | Action | Status | Note |
|---|---------|--------|--------|------|
| 1 | `/splash` | load | PASS | HTTP 200 |
| 2 | `/onboarding` (full flow) | scan + persist | PASS | covered by `tests/onboarding.spec.ts`; phase transitions clean |
| 3 | `/onboarding` (skip flow) | bypass scan, reach reward+confirm, Proceed | PASS | `tests/onboarding-skip.spec.ts` traces every step DOM-by-DOM |
| 4 | `/studio` empty state | render hero + chips + composer | PASS | `tests/demo.spec.ts:15` |
| 5 | `/studio` campaign submit | full SSE lifecycle | **PASS** | 7.6s, 26 events, see "End-to-end campaign" below |
| 6 | Pairing A: `pioneer` + fallback `pioneer,claude_code,openai` | E2E | PASS | This run; runtime trace shows `[runtime] try adapter=pioneer` then orchestrator-internal continuations |
| 7 | Pairing B: `claude_code` + fallback | E2E | DEFERRED | Not stress-tested live; `tests/test_orchestrator.py::test_runtime_fallback_chain` covers the dispatcher path |
| 8 | Pairing C: `openai` + fallback | E2E | DEFERRED | Same as #7 |
| 9 | New chat button (NEW) | create session + clear thread | PASS (component) | `apps/web/components/studio/chat/ChatHistorySidebar.tsx` rendered standalone in tests; integration into `studio/page.tsx` deferred |
| 10 | Reload restores thread | hydrate from DB | PASS (backend round-trip) | TestClient: created session, appended 3 events, fetched, verified order |
| 11 | Sidebar history list | show recent | PASS (backend) | `GET /api/chat/sessions` returns ordered list; UI tested in isolation |
| 12 | Delete session | remove + 404 next GET | PASS | TestClient round-trip |
| 13 | `/agents` roster | render 6 active + coming-soon | PASS | `tests/demo.spec.ts:55` (6-card layout) |
| 14 | `/spaces` grid | 6 cards | PASS | `tests/demo.spec.ts:67` |
| 15 | `/spaces/[id]` | step indicator | PASS | covered by spaces test |
| 16 | `/canvas` hydrate | render shell + storyboard slots | PASS | `tests/canvas-storyboard.spec.ts:13` (four-zone shell) |
| 17 | `/canvas` add character | character locker | PASS | `tests/canvas-storyboard.spec.ts:102` |
| 18 | `/canvas` launch run | one-link bar enables CTA | PASS | `tests/canvas-storyboard.spec.ts:90` |
| 19 | `/brand` 5 tabs render | no console errors | PASS (HTTP 200) | Live render not visually inspected; no regression in tests |
| 20 | `/brand/scan` real Tavily | SSE 4 phases | NOT-RUN | Avoided live scan to preserve `fixtures/brand.json` for the other 2 sessions |
| 21 | `/connectors` grid | 26 connectors, env-derived status | PASS | live API: 26 total, 5 connected (env-derived: openai, fal, hermes, tavily, pioneer auto-mark) |
| 22 | `/connectors` connect+disconnect | mock auth flow | PASS | `POST /api/connectors/instagram/connect` → 200 → status="connected" → `DELETE` → 200 |
| 23 | `/loops` create | persist to fixtures | PASS | live: created loop_8119f70195 |
| 24 | `/loops` run-now | append to posts.json + history | PASS | history grew from 0 → 1 |
| 25 | `/loops` delete | remove from list | PASS | live: deleted loop_8119f70195 |
| 26 | `/settings/profile` | render mock | PASS | HTTP 200 |
| 27 | `/settings/members` | render mock | PASS | HTTP 200 |
| 28 | `POST /api/score` | 5-axis blend | PASS | viralScore=44, hookScore=0.26, holdRate=0.26, breakdown of 5 axes, meta carries both LLM critique + heuristic halves |
| 29 | `POST /api/research` | Tavily Brief | PASS | full Brief returned: audience, 6 competitors, positioning, hooks, mode, characterId |
| 30 | `POST /api/generate` | image gen | NOT-RUN | costs FAL credits; not attempted in dry sweep — FAL_KEY is configured |

## Adapter chain regression (D.5)

`services/agents/tests/test_orchestrator.py::test_runtime_fallback_chain` validates:

- preferred adapter advances to next on raise
- non-zero exit causes fallback
- final result returns first successful adapter's payload

Currently covered: `pioneer`, `openai`, `claude_code`, `hermes` (Together AI HTTP). `hermes_cli` not yet registered (deferred — needs Hermes CLI install).

## End-to-end campaign trace (row #5)

Request:
```http
POST /api/agents/campaign
{
  "brief": {"keyword":"wool runners", "mode":"marketing"},
  "brand_id":"allbirds",
  "format":"reel",
  "adapter":"pioneer",
  "fallback":"pioneer,claude_code,openai"
}
```

Server-side trace (uvicorn logs, abridged):
```
runtime.execute: trying adapter=pioneer run_id=cg_d11cc80607e8
POST https://api.pioneer.ai/v1/chat/completions  HTTP/1.1 200
... (parallel copywriter + art_director)
POST http://localhost:8100/api/score             HTTP/1.1 200
POST http://localhost:8100/api/publish/instagram HTTP/1.1 200
POST http://localhost:8100/api/publish/meta      HTTP/1.1 200
```

Event distribution (26 events):
```
run_start          ×1
started            ×1
node_start         ×5
node_complete      ×5
thought            ×2  (strategist, creative_director)
agent_step_start   ×4  (copywriter, art_director, analyst, publisher)
agent_step_complete×4  (paired)
artifact           ×3  (3 variants per shot)
done               ×1
```

Full taxonomy emitted, no errors, 7.6 s wall-clock.

## What's wired but not yet integrated

| Piece | Files | Why deferred |
|---|---|---|
| Chat history sidebar in `studio/page.tsx` | `apps/web/components/studio/chat/ChatHistorySidebar.tsx` (new) | `studio/page.tsx` is being actively edited by the other 2 sessions — final integration in consolidation pass |
| Adapter pairing dropdown in `ChatRail.tsx` | `apps/web/lib/adapterPairings.ts` (new — 5 pairings + helpers) | Same conflict-prevention reason |
| `hermes_cli` adapter | not yet created | Requires installing nousresearch/hermes-agent CLI — paused for user confirmation |

Everything required by these is *backend-ready* (router mounted, DB persisting, `?fallback=` query param honored, `?adapter=` honored, runtime accepts both per-request).

## Gaps / follow-ups

1. **Live uvicorn needs restart** to expose `/api/chat/*` (and `/api/canvas/*` if those were also added since boot). Restart cost is a 2 s gap; the running session has been up since 16:06.
2. **Pioneer fine-tune may produce off-prompt completions** — observed: the model returned "ball" for a prompt asking for "pong". Not blocking, but worth noting for demo. Falls into the agent orchestrator anyway, where downstream nodes parse JSON and the orchestrator's `test_strategist_falls_back_when_runtime_returns_garbage` proves the system survives garbage.
3. **`hermes_cli` workstream paused** waiting for user confirmation to install the CLI (`curl … install.sh | bash`).
4. **Frontend integration of new chat sidebar + adapter dropdown** is deferred to a focused commit after the other 2 sessions land their `studio/page.tsx` changes — to avoid merge conflicts.
