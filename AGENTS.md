# AGENTS.md — Creative Intelligence Engine

> **Paired file:** When updating this file, also update `CLAUDE.md` (same directory). Both are agent-facing onboarding. **Always use repo-relative paths** in this doc — never absolute paths.

This is a fast index for any AI agent or collaborator dropping into this repo. For full context read `CLAUDE.md`. For the canonical build plan see `docs/plan.md`.

## Product in one paragraph

Creative Intelligence Engine (CIE) is an agentic Marketing OS: a brand brief enters, six specialist agents (Strategist / Creative Director / Copywriter / Art Director / Performance Analyst / Publisher) collaborate to produce multi-modal ad creative, every shot is fanned out into 3 style variants, each is scored by a Virality Predictor, the user picks winners, and Publisher pushes them to channels. The UI is a hover-collapsible sidebar shell with `Studio` (chat + liquid-glass canvas) as the default landing page. Backend is FastAPI + a Paperclip-style pluggable agent runtime with 4 swappable LLM backends (Pioneer / OpenAI / Claude Code CLI / Hermes).

## Where things live (repo-relative)

| Concern | Path |
|---|---|
| Frontend (Next.js 14) | `apps/web/` |
| App shell + sidebar | `apps/web/components/layout/`, `apps/web/components/ui/sidebar.tsx` |
| Studio (chat + canvas) | `apps/web/app/(app)/studio/page.tsx`, `apps/web/components/studio/{chat,canvas}/` |
| Brand Memory (5 tabs) | `apps/web/app/(app)/brand/page.tsx`, `apps/web/components/brand/` |
| Spaces (templates) | `apps/web/app/(app)/spaces/`, `apps/web/components/spaces/` |
| Connectors / Loops / Agents pages | `apps/web/app/(app)/{connectors,loops,agents}/page.tsx` |
| shadcn primitives | `apps/web/components/ui/` |
| Shared TS types | `packages/shared-types/index.ts` |
| Artifact renderers (image/video/doc/slide/table/code) | `packages/ui-artifacts/` |
| Canvas node types (React Flow) | `packages/canvas-nodes/` |
| Forked Open-Gen-AI model registry | `apps/studio/models.js` |
| Backend gateway | `services/api/main.py`, `services/api/routers/` |
| Agent runtime + adapters | `services/agents/{contract,registry,runtime}.py`, `services/agents/adapters/` |
| Orchestrator (campaign state machine) | `services/agents/orchestrator.py` |
| 6 specialist agent nodes | `services/agents/nodes/` |
| Generation adapters (FAL, OpenAI image) | `services/api/adapters_gen/` |
| Scheduler (Loops) | `services/scheduler/main.py` |
| Pydantic schemas (mirror shared-types) | `services/api/schemas.py` |
| Mock data | `fixtures/` |
| Brand seed (Allbirds) | `research/shopos/brand_capture.json` (source) → `fixtures/brand.json` (runtime) |
| Build plan | `docs/plan.md` |
| User-facing readme | `README.md` |

## Core endpoints

Base URL `http://localhost:8100`.

```
GET  /health                              → {ok: true}
POST /api/generate                        → SSE: phase | artifact | error
GET  /api/generate/models                 → model registry
POST /api/research                        → Brief (Tavily-backed)
GET  /api/brand · PUT /api/brand          → BrandProfile
POST /api/brand/logo                      → logo URL
POST /api/brand/scan                      → SSE: fetching | parsing | extracting | complete  (Tavily + LLM voice)
POST /api/agents/campaign                 → SSE: node_start | node_complete | artifact | done
POST /api/score                           → ScoreResult
POST /api/publish/{channel}               → mock post + insights
GET/POST/DELETE /api/connectors           → 26 connectors
GET/POST /api/loops · POST /api/loops/{id}/run-now
```

## Agent layer contract

Every adapter implements:

```python
async def execute(ctx: AdapterExecutionContext) -> AdapterExecutionResult
```

Defined in `services/agents/contract.py`. Backends register themselves in `services/agents/registry.py`. The runtime dispatcher (`services/agents/runtime.py::execute`) reads `ctx.config.adapter` or `DEFAULT_ADAPTER` env and falls back through `pioneer → openai → claude_code → hermes` on failure.

To add a new backend: drop a new file under `services/agents/adapters/`, register it in `registry.py`, document in `CLAUDE.md`. No core changes needed.

## Common workflows

### Run the app locally

```bash
pnpm install
pnpm --filter web dev                     # :3000
# new terminal
cd services/api && uv sync && uv run uvicorn main:app --reload --port 8100
```

### Run tests

```bash
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter web exec playwright test    # frontend
cd services/api && uv run pytest          # backend
cd services/agents && uv run pytest
```

### Add a new sidebar route

1. Edit `apps/web/components/ui/sidebar.tsx` — add `<Link>` block with route + Lucide icon.
2. Create `apps/web/app/(app)/<route>/page.tsx`.
3. Update `apps/web/tests/demo.spec.ts` if the route is critical to the demo.
4. Update this file + `CLAUDE.md` if it's a major new section.

### Add a new generation model

1. Edit `apps/studio/models.js` — add an entry with `{id, kind, provider, params}`.
2. If it routes through FAL: extend `services/api/adapters_gen/fal.py::SUPPORTED_MODELS`.
3. If it's a new provider: create `services/api/adapters_gen/<provider>.py` and route from `services/api/routers/generate.py`.
4. Add a unit test under `services/api/tests/`.

### Wire a new connector card

1. Append entry to `fixtures/connectors.json` with category + status.
2. If it's an AI Backend, also add env-var detection in `services/api/routers/connectors.py::list_connectors` so real status overrides fixture.
3. UI auto-renders from `/api/connectors` — no frontend code needed unless adding a new category.

### Add an SSE event type

1. Backend: emit from the relevant router or orchestrator using `services/api/sse.py::event_stream`.
2. Frontend: handle in `apps/web/components/studio/chat/ThreadMessageList.tsx` or wherever the stream is consumed (search for `event.type ===`).
3. If the event references a typed shape, mirror it in `packages/shared-types/index.ts` and `services/api/schemas.py`.

## Conventions cheat sheet

- TypeScript: strict, no `any`, zod at boundaries
- Python: `async def`, type hints, `logging.getLogger(__name__)`, no `print()`
- File writes: atomic (temp + `os.replace`)
- Frontend imports: `@/components/ui/button` etc. (`@/*` → `apps/web/`)
- Tests next to code: `*.spec.ts`, `tests/test_*.py`
- Glass classes (`hc-glass`, `hc-glass-strong`, `hc-pill`) live in `apps/web/app/globals.css` — keep
- Coral accent token: `oklch(0.66 0.18 25)`
- Variant fan-out gated by `VARIANTS_PER_SHOT` env (default 3, set to 1 to save FAL credits)

## Hard rules

1. **Never commit `.env` or any real key.**
2. **Never use absolute paths in docs / READMEs.** Repo-relative only.
3. **Never substitute fixture data for live API responses.** `research/shopos/brand_capture.json` is a *seed*, not a *substitute*.
4. **Don't introduce LangGraph or CrewAI** — the orchestrator is plain async Python deliberately.
5. **Don't break the Paperclip-style adapter contract.** Every backend is `async execute(ctx) -> Result`.
6. **Don't break the Studio default route.** `/` always 307s to `/studio` once onboarding is complete; otherwise `/splash`.
7. **The user-facing bot is named Sage**, not CIE / ShopOS / "the AI". Friendly, conversational copy only.
8. **Long-lived onboarding components must ref-guard `onAdvance` callbacks** — see CLAUDE.md "Conventions / Common pitfalls". Effect with `[onAdvance]` deps in a component that stays mounted = repeated phase resets.

## v3 surface map

- `/` → `/splash` → `/onboarding` (5-phase append-feed) → `/studio`
- `/onboarding` phases: `agents` → `intake` → `scanning` → `reward` → `confirm` (Skip jumps `intake` → `reward` directly, bypassing `scanning`)
- Studio empty state: `EmptyStateHello` (Cmd+Enter to submit) | running state: chat rail + liquid canvas with `started`/`thought`/`agent_step` SSE message kinds
- All agent avatars: `apps/web/public/agents/*.png` via `avatarFor(id)` from `apps/web/lib/agentAvatars.ts`

## Quick links

- `CLAUDE.md` — full agent-facing onboarding
- `README.md` — user-facing boot
- `docs/plan.md` — build plan (v1 + v2)
- `.env.example` — env keys
- `services/api/tests/README.md` — manual smoke tests
