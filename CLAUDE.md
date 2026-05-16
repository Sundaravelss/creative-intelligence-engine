# CLAUDE.md — Creative Intelligence Engine

> **Paired file:** When updating this file, also update `AGENTS.md` (same directory). Both are agent-facing onboarding for any AI assistant or human collaborator working in this repo. **Always use repo-relative paths in this doc** — never absolute paths like `/Users/...`.

## What this project is

Unified **agentic Marketing OS** built for the TechEurope Paris hackathon. It merges:
- the **agentic shell** of [shopos.ai](https://shopos.ai) (Spaces / Loops / Cowork / Brand Memory) and
- the **generation surface** of [higgsfield.ai/canvas](https://higgsfield.ai/canvas) (Marketing Studio, DTC Ads, Virality Predictor, multi-model image/video, Sora 2 presets)

into a single liquid-glass UI where multi-agent campaigns turn a brand brief into multi-modal ad creative, score it for viral potential, and publish (mocked for hackathon scope).

The `Studio` page is the default landing surface: a **two-pane chat (left) + liquid-glass canvas (right)** layout. The chat thread streams reasoning and inline generation chips; the canvas shows artifact variants in carousel / grid / stack view modes with virality scores per variant.

## v3 surfaces (current)

- **`/splash`** — boot screen with serif "Sage" wordmark over the blurred Tavily landscape (`apps/web/public/splash/landscape-bg.webp`). Auto-redirects to `/onboarding` if `getOnboardingState().complete === false`, else to `/studio`. Uses CSS-only fallback (no MP4 was available).
- **`/onboarding`** — vertical-feed state machine over 5 phases that **append** as the user advances (NOT swap-on-advance):
  1. `agents` — "Assembling your agents" with 5 stylized portraits, 200ms stagger reveal. **Fires `onAdvance` exactly once via a ref guard** — see "Conventions / Common pitfalls" below.
  2. `intake` — "Hi, I'm Sage…" bot bubble + sticky `<StoreLinkBar>` with purple→peach halo and Skip / Scan buttons.
  3. `scanning` — `ScanProgress` consumes SSE from `POST /api/brand/scan` (Tavily-backed, 4 phases: fetching → parsing → extracting → complete; 30s timeout falls through to reward).
  4. `reward` — "You've got 250 credits on us!" card. **Auto-advances to `confirm` after 1800ms.**
  5. `confirm` — `BrandConfirmCard` with Brand.md / Logos / Colours / Font / Reference Images + Retry / Proceed. Proceed PUTs onboarding state and pushes to `/studio`.
- **Studio empty-state** (`<EmptyStateHello>`) — replaces v2 hero with serif "Hello {brand.name}" + "What are we going to sell today?" + textarea + 4 quick-action chips (Create image / Make video / Create slides / Make a store-muted) + `<ConnectorDropdown>` + bottom-right `<SpacesHintCard>`. Empty-state textarea submits on **Cmd/Ctrl+Enter**; running-state composer footer submits on plain Enter.
- **Studio chat** — new message kinds: `started` (✻ Sage started pill), `thought` (✻ Sage thought for Ns ▾, click expands full reasoning), `agent_step` (avatar + label + N of M done ▾, expands to substep list with status icons), plus `LiveStreamProse` shimmer tail. SSE handler in `apps/web/app/(app)/studio/page.tsx` dispatches new events ABOVE legacy `node_start` for back-compat.
- **`/agents`** — 6 active agent cards using stylized PNG portraits via `avatarFor(agent.id)` from `apps/web/lib/agentAvatars.ts` + 2 coming-soon tiles (Comptable, Recruiter) faded out.

## Brand persona

The user-facing assistant is named **Sage** (friendly, conversational). The product / repo is "Creative Intelligence Engine" — Sage is the bot persona. Avoid robotic copy like "I'm now going to build your brand's AI agent". Prefer warm, present-tense voice ("Hi, I'm Sage. I'll be helping you set up your brand today…"). Status pills read `Sage started`, `Sage thought for Ns`, never `CIE` / `ShopOS` / `the AI`.

## Conventions / Common pitfalls

- **Long-lived components must not call parent setters from a `useEffect` keyed on the setter.** Anti-pattern: `useEffect(() => setTimeout(onAdvance, 1500), [onAdvance])` in a component that stays mounted across phase changes — the parent re-renders pass a fresh arrow function, the effect re-runs, the timer restarts, and 1500ms later the parent state gets overwritten. Fix: ref-guard the call so it fires **exactly once** on mount. Implementation pattern in `apps/web/components/onboarding/AgentsAssembly.tsx`:
  ```ts
  const fired = useRef(false);
  const cbRef = useRef(onAdvance);
  cbRef.current = onAdvance;
  useEffect(() => {
    if (fired.current) return;
    const t = setTimeout(() => { fired.current = true; cbRef.current(); }, 1500);
    return () => clearTimeout(t);
  }, []);
  ```
  This was the exact bug behind "Skip path on /onboarding silently bounces back to intake" reported on 2026-05-16.

## Dev / debugging tips

- **Reset onboarding for repeated demo runs:**
  ```bash
  echo '{"complete": false}' > fixtures/onboarding.json
  ```
  Or `curl -X PUT http://localhost:8100/api/onboarding/state -H 'content-type: application/json' -d '{"complete": false, "brandUrl": null, "completedAt": null}'`.
- **Skip path bypasses the Tavily scan**, so `BrandConfirmCard` renders fallback voice + palette. The "Brand Memory" page can be revisited later to scan a real URL.
- Diagnostic Playwright test for onboarding flows lives at `apps/web/tests/onboarding-skip.spec.ts`. Each step logs DOM state to console — useful for tracing phase transitions.

## Repo layout

```
.
├── apps/
│   ├── web/                       # Next.js 14 App Router frontend (:3000)
│   │   ├── app/
│   │   │   ├── (app)/             # AppShell + sidebar wraps every authenticated route
│   │   │   │   ├── studio/        # default landing — chat + liquid canvas
│   │   │   │   ├── canvas/        # React Flow node graph (legacy v1)
│   │   │   │   ├── spaces/        # template grid + 2-step Space detail
│   │   │   │   ├── loops/         # recurring jobs
│   │   │   │   ├── brand/         # 5-tab Brand Memory (Boards/Sources/Wiki/Graph/Units)
│   │   │   │   ├── connectors/    # 26 connectors across 7 categories
│   │   │   │   ├── agents/        # 6-agent character roster
│   │   │   │   └── settings/      # profile / members / integrations
│   │   │   ├── layout.tsx         # root providers ONLY (no shell)
│   │   │   └── page.tsx           # 307 → /studio
│   │   ├── components/
│   │   │   ├── ui/                # shadcn primitives (sidebar, button, dropdown-menu, etc.)
│   │   │   ├── layout/AppShell.tsx
│   │   │   ├── studio/chat/       # ChatRail + reasoning + generation chips + composer
│   │   │   ├── studio/canvas/     # LiquidCanvas + view-mode toggle + variant stack
│   │   │   ├── brand/             # 5-tab Memory panels
│   │   │   ├── canvas/            # React Flow nodes (v1, /canvas page)
│   │   │   ├── connectors/        # ConnectorsGrid + ConnectModal
│   │   │   └── loops/             # LoopList + LoopForm + RunHistory
│   │   ├── lib/
│   │   │   ├── api.ts             # typed fetch wrapper, base = NEXT_PUBLIC_API_BASE_URL || :8100
│   │   │   ├── sse.ts             # generic useSSE<T> hook
│   │   │   └── utils.ts           # shadcn cn() helper
│   │   └── tests/demo.spec.ts     # Playwright smoke
│   └── studio/                    # forked Open-Generative-AI model registry (apps/studio/models.js)
├── packages/
│   ├── ui-artifacts/              # ArtifactCarousel + 6 renderers (image/video/doc/slide/table/code)
│   ├── canvas-nodes/              # React Flow node types + zod schemas
│   └── shared-types/              # cross-cutting TS types (Artifact, BrandProfile, Brief, ScoreResult, …)
├── services/
│   ├── api/                       # FastAPI gateway (:8100)
│   │   ├── main.py
│   │   ├── routers/{generate,research,agents,publish,loops,score,connectors,brand}.py
│   │   ├── adapters_gen/{fal,openai_image}.py
│   │   ├── schemas.py             # Pydantic mirror of packages/shared-types
│   │   └── tests/                 # pytest, 35+ tests
│   ├── agents/                    # Paperclip-style adapter pattern (Python)
│   │   ├── contract.py            # AdapterExecutionContext + Result
│   │   ├── registry.py            # ADAPTERS dict
│   │   ├── runtime.py             # execute(ctx) dispatcher with fallback chain
│   │   ├── adapters/{pioneer,openai,claude_code,hermes}.py
│   │   ├── orchestrator.py        # CampaignGraph (async state machine — NOT LangGraph)
│   │   └── nodes/{strategist,creative_director,copywriter,art_director,analyst,publisher}.py
│   └── scheduler/                 # APScheduler worker for Loops
├── fixtures/                      # mock data (connectors, insights, posts, briefs, brand)
├── infra/docker-compose.yml
├── docs/plan.md                   # canonical build plan (mirror of ~/.claude/plans/*.md)
├── .env.example                   # all env keys, see Env section
├── README.md                      # boot + layout (user-facing)
├── CLAUDE.md                      # this file (agent-facing)
└── AGENTS.md                      # paired file — keep in sync
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router · React 19 · Tailwind v4 · shadcn/ui · Framer Motion · React Flow · pnpm workspace |
| Backend | FastAPI · `uv` workspace (`services/api`, `services/agents`, `services/scheduler`) · httpx async · sse-starlette |
| LLM (agent layer) | **Pioneer** primary · **OpenAI** fallback · **Claude Code** (CLI subprocess) · **Hermes** (Together AI) — all swappable via `DEFAULT_ADAPTER` env or `?adapter=` query |
| Image / Video | **FAL** (Flux/Sora 2/Kling/Veo) · OpenAI gpt-image-1 fallback for stills |
| Research | **Tavily** (`extract` + `search` + LLM voice synthesis pass) |
| Scheduling | APScheduler |
| Auth | None in hackathon scope (mocked) |

## Boot

```bash
# from repo root
pnpm install                                                  # JS deps
pnpm --filter web dev                                         # frontend :3000

# backend (separate terminal)
cd services/api && uv sync && uv run uvicorn main:app --reload --port 8100

# scheduler worker (optional)
cd services/scheduler && uv run python main.py
```

Demo URLs: `/studio` (default), `/canvas`, `/spaces`, `/loops`, `/connectors`, `/brand`, `/agents`.

## Env

`.env.example` declares every key. Copy to `.env` and fill:

| Var | Purpose |
|---|---|
| `PIONEER_API_KEY` / `PIONEER_BASE_URL` / `LLM_MARKETING_MODEL_ID` | Pioneer fine-tune backend (sponsor — confirm at booth) |
| `OPENAI_API_KEY` / `OPENAI_MODEL_DEFAULT` / `OPENAI_MODEL_HERO` | OpenAI fallback |
| `HERMES_API_BASE` / `HERMES_API_KEY` / `HERMES_MODEL` | Hermes via Together AI |
| `CLAUDE_CODE_CLI_PATH` | path to `claude` CLI binary |
| `FAL_KEY` / `FAL_DEFAULT_IMAGE_MODEL` / `FAL_DEFAULT_VIDEO_MODEL` | FAL image+video |
| `TAVILY_API_KEY` | brand scan + research nodes |
| `DEFAULT_ADAPTER` | one of `pioneer | openai | claude_code | hermes` |
| `VARIANTS_PER_SHOT` | 1-3, controls fan-out cost (default 3) |
| `BRAND_SCAN_FALLBACK` | set to `httpx` to force the Tavily-less path |

Never commit `.env`. Real keys live in the user's local environment.

## Key APIs

All under `http://localhost:8100`:

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /api/generate` | image/video gen via FAL or OpenAI (SSE) |
| `GET /api/generate/models` | model registry |
| `POST /api/research` | Tavily extract + search → Brief |
| `GET/PUT /api/brand` · `POST /api/brand/logo` · `POST /api/brand/scan` | Brand Memory CRUD + URL scan (SSE, Tavily-backed) |
| `POST /api/agents/campaign` | multi-agent orchestration (SSE) — body `{ brief, format, brand_id, adapter? }` |
| `POST /api/score` | Virality Predictor — heuristic + LLM critique |
| `POST /api/publish/{channel}` | mock publish (`meta-ads`, `tiktok-ads`, `instagram`, …) |
| `GET/POST /api/loops` · `POST /api/loops/{id}/run-now` · `GET /api/loops/{id}/runs` | recurring jobs |
| `GET /api/connectors` · `POST /api/connectors/{id}/connect` | 26 connectors, 7 categories |

## Agent layer (Paperclip-style adapter pattern)

`services/agents/runtime.py::execute(ctx)` dispatches to one of 4 adapters based on `ctx.config.adapter` or `DEFAULT_ADAPTER` env, with automatic fallback through the chain `pioneer → openai → claude_code → hermes`.

The `CampaignGraph` orchestrator (`services/agents/orchestrator.py`) is a plain async Python state machine (not LangGraph) running 6 specialist agents:

1. **Strategist** — turns brief + research into audience + hooks
2. **Creative Director** — picks format mix + budget per asset
3. **Copywriter** — produces headlines + CTAs per hook
4. **Art Director** — picks references + image/video model + params; **fans out 3 style variants per shot** (editorial / golden-hour / overcast)
5. **Performance Analyst** — calls `/api/score` for each variant, returns Virality scores
6. **Publisher** — calls mock `/api/publish/{channel}` with the user-selected variant

Each transition emits an SSE event `{type, nodeId, payload}` consumed by the Studio chat rail.

## Design language

- **Liquid glass**: lavender→sand gradient + 4% SVG film grain on the canvas pane (`apps/web/components/studio/canvas/LiquidCanvas.tsx`)
- **Coral accent**: `oklch(0.66 0.18 25)` for active state, selected variants, Live status dot
- **shadcn neutrals** for controls, frosted cards (`bg-white/60 backdrop-blur-sm`) for artifacts
- **Sidebar**: hover-collapsible (3.05rem → 15rem), Framer Motion staggered children
- The `hc-glass*` Tailwind utilities in `apps/web/app/globals.css` are kept from v1 for the artifact card chrome — don't remove

## Conventions

- TypeScript **strict**, no `any`. Use `unknown` + zod parse at boundaries.
- All new React components use shadcn primitives from `apps/web/components/ui/`.
- All Python code is async, type-hinted, uses `logging.getLogger(__name__)` (no `print`).
- Atomic file writes for `fixtures/*.json` (tempfile + `os.replace`).
- Frontend `@/` alias resolves to `apps/web/` (not repo root). Use `@/components/ui/button` etc.
- Backend reuses `services/api/sse.py::event_stream` for any new SSE endpoint.
- Tests live next to the code: `apps/web/tests/*.spec.ts` (Playwright), `services/*/tests/*.py` (pytest).

## Hard constraints

- **Never commit secrets.** `.env` is gitignored; `.env.example` has placeholders only.
- **Never commit instance / runtime state.** `fixtures/posts.json` is runtime-mutated and gitignored.
- **Never use absolute paths in docs.** Use repo-relative paths (`apps/web/...`, `services/api/...`).
- **Sidebar (`apps/web/components/ui/sidebar.tsx`)** uses Framer Motion — keep React 19 compat in mind.
- **Fixture seed data** (`research/shopos/brand_capture.json`) is the source of truth for the Allbirds seed in `fixtures/brand.json`. Don't substitute it for live `/api/brand/scan` results — that endpoint always does real work via Tavily.

## Tests

| Suite | Location | Run |
|---|---|---|
| Backend pytest | `services/api/tests/`, `services/agents/tests/` | `cd services/api && uv run pytest` |
| Frontend Playwright | `apps/web/tests/demo.spec.ts` | `pnpm --filter web exec playwright test` |
| TypeScript | n/a | `pnpm --filter web type-check` |

Current pass count: 40+ backend tests, 5+ Playwright tests (will grow with each WS).

## Related docs

- `README.md` — user-facing boot guide
- `AGENTS.md` — paired agent-facing reference (keep in sync with this file)
- `docs/plan.md` — canonical build plan with v1 + v2 workstream structure
- `services/api/tests/README.md` — manual smoke tests with real keys
- `docs/demo.md` — 90-second walkthrough script
