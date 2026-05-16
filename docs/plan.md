# Creative Intelligence Engine — v2 UI Overhaul Plan

## Context

CIE v1 shipped (PR/repo: https://github.com/Sundaravelss/creative-intelligence-engine — 147 files, 35 backend tests + 3 Playwright pass, app boots and all 7 pages render). v1 used a top-glass-nav landing-tile model. This is **wrong for the demo**: shopos.ai (our visual reference, captured in `research/shopos/` — 26 PNGs) is a sidebar app where Studio (the task composer) is the default landing surface.

**v2 task:** integrate the user-supplied shadcn `SessionNavBar` component as the persistent app shell, **rebuild Studio as a hyperagent-style chat (left) + liquid-glass canvas (right)** layout, make Studio the default landing page, and replace the placeholder Acme Sneakers brand fixture with a real shopos-style Brand Memory page (URL scan → Boards / Wiki / Graph / Units / Sources tabs, seeded with the captured Allbirds brand_capture.json).

**Hyperagent reference (4 new screenshots):**
- **Left rail (chat):** user message bubble at top right ("generate the marketing images for bags") · "Reasoning…" pill · italicized reasoning paragraph · 3-4 inline "Generating image" chips with progress bar + "9s / ~7s" timer + model byline ("Generating image with Nano Banana 2") · final assistant prose ("Want me to push any of these further — swap colors…") · feedback row (👍 👎 copy share) · **Suggested follow-ups** stacked list ("Generate more variations", "Build a campaign landing page", "Animate one into a video", "Social media crops") · bottom composer "Add a follow-up…" with `+`, `Execute ▾`, circular send button.
- **Right rail (liquid-glass canvas):** lavender→sand gradient backdrop with subtle film grain · top-center segmented view-mode toggle (3 icons: **stack** / **grid** / **layered**) · in stack/carousel mode: large rounded card (~340×440 9:16) with frosted "label pill" floating above (`📷 Lifestyle — Parisian street with shoulder bag ▾`) · top-right card chrome (eye-toggle + expand) · neighboring cards peeking left/right · floating thumbnail strip below (4 thumbs, active dot beneath the focused one) · Live status pill + model badge ("Live · Opus 4.7") in the header next to the project title ("Marketing Image Generation for Bags ▾").
- **Grid mode:** 2-col masonry of generated artifacts, no chrome on cards, same lavender backdrop.
- **Stack/layered mode:** view-toggle's third icon — cards stacked z-axis style for browsing variants of the same shot.

**Variant fan-out:** each "generate" step now produces **2-3 style variants per shot** (e.g. for "Lifestyle — Parisian street": editorial / golden-hour / overcast). Each variant is scored by the Virality Predictor and shown side-by-side; user picks one and the canvas advances to the next shot.

**Live canvas as slidable carousel** for the demo: images, videos, docs (campaign brief PDF), and a generated landing-page mockup all flow through the same `<ArtifactCarousel>`, with the floating thumbnail strip and view-mode toggle. This is the headline visual for the hackathon demo.

This is a **major UI replatform** but reuses every backend route already shipped. No backend changes are required for v2 except one small new endpoint: `POST /api/brand/scan { url }`.

Build root: `/Users/u1060059/Downloads/setup/tech_hackathon_marketing/creative_intelligence_engine/` (existing, populated).

---

## What changes vs. v1

| Concern | v1 today | v2 target |
|---|---|---|
| Default route `/` | Hero + 6 nav tiles | Redirect → `/studio` |
| App shell | None (top glass nav per page) | `<AppShell>` with hover-collapsible sidebar (shadcn `SessionNavBar`) |
| Studio layout | Single-column: prompt input + format pills + template grid + Run button | **Two-pane:** left = chat thread with reasoning + generation chips + suggested follow-ups + bottom composer; right = liquid-glass canvas with view-mode toggle, frosted artifact cards, thumbnail strip |
| Generation cardinality | 1 artifact per shot | **2-3 style variants per shot**, each scored by Virality Predictor, user picks winner |
| Canvas view modes | None (React Flow only) | **3-mode toggle: carousel / grid / stack** (mirrors hyperagent's 3-icon segment) |
| Composer location | Top of page | Bottom of left chat rail; "Add a follow-up…" placeholder |
| Templates | `TemplateGrid` row above prompt | Moved to `/spaces` (renamed Spaces grid mirroring shopos) |
| Brand profile | One-pager form (Acme Sneakers placeholder, palette swatches + product list editor) | Multi-tab `/brand` page: **Sources** (URL scan), **Boards**, **Wiki**, **Graph**, **Units** — seeded from `research/shopos/brand_capture.json` (Allbirds) |
| Brand fixture | Acme Sneakers seed | Allbirds seed (lifted from captured JSON) |
| `/connectors` `/loops` `/agents` | Standalone pages | Same routes, now nested inside `<AppShell>` sidebar |
| User profile / org switcher | None | Sidebar account dropdown (top: org switcher → manage members / integrations / create org; bottom: account → profile / sign out) |
| Component library | Custom glass cards via `hc-glass*` Tailwind classes | shadcn primitives in `apps/web/components/ui/` (Button, ScrollArea, Separator, DropdownMenu, Skeleton, Avatar, Badge) — keep glass utilities for cards, use shadcn for controls |

Out of scope for v2: dark/light theme toggle, real OAuth on connectors, real Meta/TikTok publishing.

---

## Architecture

```
apps/web/
├── app/
│   ├── layout.tsx                # wraps RootProviders ONLY (no shell yet — shell is in (app))
│   ├── page.tsx                  # redirect → /studio
│   ├── (app)/                    # NEW: app-shell route group
│   │   ├── layout.tsx            # <AppShell><Sidebar/>{children}</AppShell>
│   │   ├── studio/page.tsx       # NEW Studio (default landing)
│   │   ├── canvas/page.tsx       # moved from (canvas)/canvas
│   │   ├── spaces/page.tsx       # NEW (templates grid renamed)
│   │   ├── spaces/[id]/page.tsx  # NEW (Space detail w/ Step 1 upload, Step 2 configure)
│   │   ├── loops/page.tsx        # moved from (canvas)/loops
│   │   ├── brand/page.tsx        # REWRITTEN — multi-tab Memory
│   │   ├── connectors/page.tsx   # moved from (settings)/connectors
│   │   ├── agents/page.tsx       # moved from (settings)/agents
│   │   └── settings/
│   │       ├── profile/page.tsx  # NEW (sidebar Account dropdown target)
│   │       ├── members/page.tsx  # NEW (sidebar Org dropdown target)
│   │       └── integrations/page.tsx  # alias of /connectors
│   └── (canvas)/, (settings)/    # DELETED after migration
├── components/
│   ├── ui/                       # NEW: shadcn primitives
│   │   ├── sidebar.tsx           # SessionNavBar from user spec, adapted
│   │   ├── button.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   └── skeleton.tsx
│   ├── layout/
│   │   ├── AppShell.tsx          # NEW — wraps sidebar + main
│   │   └── Sidebar.tsx           # NEW — CIE-flavored adapter of SessionNavBar
│   ├── studio/                   # REDESIGNED
│   │   ├── StudioComposer.tsx    # NEW — bottom-anchored composer (replaces page-level layout)
│   │   ├── ComposerActions.tsx   # NEW — `+` menu, brand pill, UGC, Avatar, format, Launch
│   │   ├── PlusMenu.tsx          # NEW — file/image/video/integration upload
│   │   ├── UgcPresetsModal.tsx   # NEW — 6 grid (per ref screenshot 6)
│   │   ├── AvatarPresetsModal.tsx # NEW — 8+ grid (per ref screenshot 7)
│   │   ├── FormatPicker.tsx      # KEEP, restyle as pills 9:16 / 1:1 / 9:16 story / 16:9 / 1:1×N
│   │   ├── BrandPill.tsx         # NEW — brand selector pill (briefcase icon)
│   │   ├── PromptInput.tsx       # KEEP (already exists)
│   │   └── LiveCanvasView.tsx    # KEEP (already exists)
│   └── brand/
│       ├── BrandMemoryTabs.tsx   # NEW — Boards | Wiki | Graph | Units | Sources
│       ├── SourcesPanel.tsx      # NEW — URL scan input + scan progress
│       ├── BoardsPanel.tsx       # NEW — visual moodboards grid
│       ├── WikiPanel.tsx         # NEW — voice + tagline editor
│       ├── GraphPanel.tsx        # NEW — relationships viz (basic)
│       └── UnitsPanel.tsx        # NEW — products list (port existing ProductList)
├── lib/
│   └── utils.ts                  # NEW — shadcn `cn()` helper (clsx + tailwind-merge)
└── public/ugc-presets/, avatar-presets/  # NEW — 6 + 8 stock images
fixtures/
└── brand.json                    # REWRITTEN — Allbirds (from research/shopos/brand_capture.json)
services/api/
└── routers/brand.py              # EXTEND — add POST /api/brand/scan
```

---

## Parallel execution model

5 workstreams. WS-V0 is blocking (~30 min); V1–V4 fan out fully in parallel after.

```
[V0 Shell + shadcn primitives] → V1 Studio composer redesign
                                ├ V2 Brand Memory page
                                ├ V3 Spaces page + route migration
                                └ V4 Backend: /api/brand/scan + Allbirds fixture
```

| WS | Owner | Files allowed |
|---|---|---|
| V0 | ui-designer | `components/ui/**`, `components/layout/**`, `lib/utils.ts`, `app/layout.tsx`, `app/page.tsx`, `app/(app)/layout.tsx`, route migrations (move-only, no logic edits) |
| V1 | ui-designer | `app/(app)/studio/page.tsx`, `components/studio/**`, `public/ugc-presets/**`, `public/avatar-presets/**` |
| V2 | ui-designer | `app/(app)/brand/page.tsx`, `components/brand/{BrandMemoryTabs,SourcesPanel,BoardsPanel,WikiPanel,GraphPanel,UnitsPanel}.tsx` |
| V3 | ui-designer | `app/(app)/spaces/**`, `components/spaces/**`, `app/(app)/settings/**` (profile/members/integrations stubs) |
| V4 | backend-engineer | `services/api/routers/brand.py` (extend), `fixtures/brand.json` (rewrite from Allbirds capture), `services/api/tests/test_brand_scan.py` |

---

## WS-V0 — Shell + shadcn primitives (BLOCKING)

**Goal:** install shadcn into the existing Next 14 app, drop in the user-provided sidebar, wrap every authenticated route with `<AppShell>`, redirect `/` → `/studio`, migrate route groups.

### Deps to install

`pnpm --filter web add framer-motion @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-avatar class-variance-authority clsx tailwind-merge`

(`lucide-react`, `tailwind-merge`, `clsx`, `class-variance-authority` already in package.json — verify and skip.)

### Files to create (verbatim from user spec, adapted minimally)

- `apps/web/lib/utils.ts` — `export function cn(...inputs) { return twMerge(clsx(inputs)) }`
- `apps/web/components/ui/{button,scroll-area,separator,dropdown-menu,avatar,badge,skeleton}.tsx` — copy from user-supplied snippets verbatim
- `apps/web/components/ui/sidebar.tsx` — copy `SessionNavBar` from user spec, then adapt nav items to CIE routes:
  - **Studio** (`/studio`, `Sparkles` icon) — primary
  - **Canvas** (`/canvas`, `Workflow` icon)
  - **Spaces** (`/spaces`, `LayoutGrid` icon)
  - **Loops** (`/loops`, `Repeat` icon, BETA badge)
  - separator
  - **Brand Memory** (`/brand`, `Brain` icon)
  - **Connectors** (`/connectors`, `Plug` icon)
  - **Agents** (`/agents`, `Users` icon)
  - separator
  - **Settings** (`/settings/profile`, gear icon — bottom)
  - **Account** dropdown (bottom): Profile / Sign out
  - **Org switcher** (top): Manage members / Integrations / Create org
  - Org name: "Acme Sneakers" (replace hardcoded "Organization")
  - Account name: "Sundara" / `sundaravelselvarajfr@gmail.com` (replace "Andrew Luo")

### Shell

- `apps/web/components/layout/AppShell.tsx` — `<div class="flex h-screen w-screen flex-row">` + `<SessionNavBar />` + `<main class="flex h-screen grow flex-col overflow-auto pl-[3.05rem]">{children}</main>` (left-pad accounts for collapsed sidebar's 3.05rem fixed width).
- `apps/web/app/(app)/layout.tsx` — server component, renders `<AppShell>{children}</AppShell>`

### Routing

- `apps/web/app/page.tsx` — replace landing tiles with `redirect("/studio")` (Next 14 server redirect).
- Move existing pages into `(app)/` route group:
  - `app/(canvas)/canvas/page.tsx` → `app/(app)/canvas/page.tsx`
  - `app/(canvas)/studio/page.tsx` → `app/(app)/studio/page.tsx` (V1 will rewrite contents)
  - `app/(canvas)/loops/page.tsx` → `app/(app)/loops/page.tsx`
  - `app/(settings)/connectors/page.tsx` → `app/(app)/connectors/page.tsx`
  - `app/(settings)/brand/page.tsx` → `app/(app)/brand/page.tsx` (V2 will rewrite)
  - `app/(settings)/agents/page.tsx` → `app/(app)/agents/page.tsx`
- Delete old `(canvas)/` and `(settings)/` route groups after migration.

### Adjustments to user-spec sidebar

- Remove the `next/image` import (not used in CIE; user spec imports it but never uses).
- Replace blue accent (`text-blue-600`, `bg-blue-50`) with CIE's coral accent token (`text-[oklch(0.66_0.18_25)]`) so active state matches existing globals.css.
- The animated `motion.li` collapse semantics from the user spec are kept as-is.

### Verification

- `pnpm --filter web type-check` passes
- `pnpm --filter web build` succeeds
- Boot dev: `/` 302→`/studio`, sidebar visible on every authenticated route, hover expands to 15rem, mouse-leave collapses to 3.05rem
- Existing Playwright `apps/web/tests/demo.spec.ts` still passes (it only checks page content, not chrome)

---

## WS-V1 — Studio: chat rail + liquid-glass canvas (HEADLINE WORK)

The Studio page is now a **two-pane layout**: chat-thread rail on the left (~480px), liquid-glass canvas on the right (fills remainder). Sidebar from V0 sits to the left of both.

```
┌──────┬──────────────────────────┬──────────────────────────────┐
│      │ ChatRail (~480px)        │ LiquidCanvas (flex-1)        │
│ side │  · header: project ▾     │  ┌─[carousel│grid│stack]─┐   │
│ bar  │     · Live · Opus 4.7    │  │                       │   │
│      │  · message thread:       │  │   ┌─ frosted card ─┐  │   │
│      │     - user bubble        │  │   │  9:16 image     │  │   │
│      │     - reasoning pill     │  │   │  with score chip│  │   │
│      │     - reasoning prose    │  │   └─────────────────┘  │   │
│      │     - generation chips × │  │   ← peek    peek →     │   │
│      │     - assistant prose    │  │                       │   │
│      │     - feedback row       │  └───── thumb strip ─────┘   │
│      │     - suggested follow-  │                              │
│      │       ups (4 stacked)    │                              │
│      │  · bottom composer:      │                              │
│      │    "Add a follow-up…"    │                              │
│      │    [+] [Execute ▾] [⬆]   │                              │
└──────┴──────────────────────────┴──────────────────────────────┘
```

### Left rail components (`apps/web/components/studio/chat/`)

- **`ChatRail.tsx`** — full-height column, `flex-col`, header + scrollable thread + sticky composer footer.
- **`ChatHeader.tsx`** — project name dropdown ("Marketing Image Generation for Bags ▾"), Live status dot ("● Live"), model badge pill ("Opus 4.7"). Reads current run state from store.
- **`ThreadMessageList.tsx`** — virtualized list of `ChatMessage` items keyed off SSE events (see WS-D's `node_start`/`node_complete`/`artifact` events).
- **`UserMessageBubble.tsx`** — right-aligned, blue-tinted soft pill, timestamp underneath.
- **`ReasoningBlock.tsx`** — collapsible "■ Reasoning…" pill at top, italicized reasoning paragraph beneath. Streams the orchestrator's *Strategist* and *Creative Director* node outputs as the visible reasoning trace.
- **`GenerationChip.tsx`** — single-line chip: `[🖼 Generating image]` (status icon morphs from spinner → checkmark) · prompt summary truncated · right-aligned chevron `›`. Below the chip: thin progress bar + meta line `Generating image with Nano Banana 2 (Gemini 3.1 Flash Im…) · 9s / ~7s`. Three of these stack per generation step (one per variant). Clicking a chip expands the matching card in the right canvas.
- **`AssistantProse.tsx`** — markdown render of post-generation copy ("Want me to push any of these further — swap colors, generate matching social crops…").
- **`FeedbackRow.tsx`** — inline icon row: 👍 👎 ⎘ copy ⌥ branch · right-aligned globe / play / sound icons.
- **`SuggestedFollowups.tsx`** — 4 stacked rows with leading sparkle/globe icon, label, trailing arrow. Clicking a row submits the row text as a follow-up via composer.
- **`ComposerFooter.tsx`** — sticky bottom: textarea "Add a follow-up…" · `[+]` plus menu · `Execute ▾` dropdown (lets user toggle adapter: Pioneer / OpenAI / Claude Code / Hermes — wired to `?adapter=` query of `/api/agents/campaign`) · circular send button (black, ⬆). Cmd+Enter submits. Hide the higgsfield-style format/UGC/Avatar pills here — those move to a "first-message scaffold" view shown ONLY when thread is empty.

### Right rail components (`apps/web/components/studio/canvas/`)

- **`LiquidCanvas.tsx`** — full-height pane, `bg-gradient-to-br` lavender→sand (`from-[#dcd2e6] via-[#e8dde0] to-[#e7d6c5]`) plus a 4% opacity SVG noise overlay for the "frosted glass" film-grain effect. Hosts:
  - `<ViewModeToggle>` — top-center pill, 3 segments (carousel / grid / stack). Stores mode in URL `?view=`.
  - `<ArtifactCarousel>` (the existing `@cie/ui-artifacts` `ArtifactCarousel.tsx` — already supports 3 view modes) — fed an `Artifact[]` derived from the chat thread's emitted artifacts.
  - `<ThumbnailStrip>` — bottom-center floating frosted strip, ~80px tall, 4-6 thumbs, active indicator dot below the focused one. Click to focus.
- **`ArtifactCard.tsx`** — already exists in `@cie/ui-artifacts/`; restyle to match hyperagent: top-left "label pill" (frosted, with kind icon + truncated title + chevron) floating ABOVE the card, `rounded-2xl shadow-2xl border border-white/30` for the actual image card, top-right action overlay (👁 hide-toggle, ⤢ expand). On hover: card lifts 4px + shadow expands. Each card also renders a `<ScoreChip>` (WS-F component, already shipped) in its bottom-right corner once the variant has a score.
- **`VariantStack.tsx`** — when a single shot has 2-3 variants, render them as a horizontal stack (in carousel mode they peek left/right; in stack mode they overlap z-axis, click to swap front). Selected variant gets a coral accent ring and propagates upward as the "chosen" artifact for downstream nodes.

### Variant fan-out (orchestrator change — minimal backend touch)

The existing `services/agents/orchestrator.py` `CampaignGraph` runs Art Director once per shot. **Update Art Director to emit 3 distinct prompts per shot** (different style modifiers — e.g. `editorial`, `golden-hour`, `overcast`) and fan out to 3 parallel `/api/generate` calls. Each result emits one `artifact` SSE event tagged `{shotId, variantId, variantLabel}`. `LiquidCanvas` groups artifacts by `shotId` and renders each group as a `<VariantStack>`. Performance Analyst then scores all 3, and the user's click on a variant card writes `selectedVariantId` to state — Publisher uses that.

This is a ~30-line change in `art_director.py` + `orchestrator.py` + a small additive type field on the `Artifact` schema (`variantOf?: string`, `variantLabel?: string`). Group under V1's "agents/" allowance — V1 owner edits these two Python files because they're directly tied to the variant UX.

### Empty state (first message)

When the chat thread is empty, the right pane shows:
- Centered hero "Describe your ad script…" with a single big textarea
- Below textarea: format pills (Reel / Square / Story / Banner / Carousel) + a small "📦 Brand · Allbirds" pill + UGC dropdown + Avatar dropdown + Launch button
- Once the user submits, this whole view collapses into the chat thread + canvas layout above.

(So the higgsfield-style pills from the original v2 plan are kept, just gated behind first-message empty state — not the steady-state UX.)

### Static assets

- `apps/web/public/ugc-presets/{1..6}.jpg` — 6 small (max 200KB) Unsplash images. Use `WebFetch` to grab from `unsplash.com/photos/` in the agent task. Filenames per `presets.json`.
- `apps/web/public/avatar-presets/{1..9}.jpg` — 9 stock portraits.
- `presets.json` files at each path listing id + label + image path.

### Verification

- Boot dev, navigate to `/studio` → empty state with format pills + textarea visible
- Submit "generate the marketing images for bags" → chat thread populates: user bubble → Reasoning pill → 4 GenerationChips streaming progress → assistant prose → suggested follow-ups
- Right canvas concurrently fills with 3 variant cards per shot in carousel mode; clicking the view-mode toggle swaps to grid + stack
- Each card shows a ScoreChip after Performance Analyst runs (1-2s post-generation)
- Click a variant → coral ring appears, downstream Publisher uses that variantId
- Click a SuggestedFollowup row ("Generate more variations") → re-submits as follow-up, new chat block appears
- Existing Playwright `apps/web/tests/demo.spec.ts` updated to assert: chat thread visible, ≥3 generation chips, view-mode toggle has 3 segments, thumbnail strip present.

---

## WS-V2 — Brand Memory page

Mirror shopos's `/memory` screen exactly. Tabs: **Boards | Sources | Wiki | Graph | Units** (5 tabs, in that order).

### Sources tab (the active default if `fixtures/brand.json` is empty)

```
┌─────────────────────────────────────────┐
│  Add your Brand                         │
│  ┌────────────────────────────┬─[Scan]┐│
│  │ Paste your website url     │       ││
│  └────────────────────────────┴───────┘│
│  Don't have a website? Create manually  │
└─────────────────────────────────────────┘
```

- Input field + "Scan" pill button (top-right). On submit → `POST /api/brand/scan { url }` (V4).
- Running state: gradient overlay on input, status text "Scraping https://www.allbirds.com…", button label flips to "Generating" disabled.
- On success: brand profile written to `fixtures/brand.json`, all other tabs populate.

### Boards tab

3-column grid of "moodboards" (cards with brand-color gradients + first 3 product images). Each board card shows palette swatches at the bottom. Sourced from current brand fixture's `palette` + `products`.

### Wiki tab

Plain-prose voice paragraph editor (single textarea seeded from `voice` field) + tagline input + "Last scanned" timestamp.

### Graph tab

Simple force-directed-style SVG showing brand → 4 palette colors + N products as nodes. Pure SVG (no chart lib).

### Units tab

Port the existing `ProductList.tsx` (already at `apps/web/components/brand/ProductList.tsx`). Add a "Re-scan products" button that re-hits `/api/brand/scan`.

### Verification

- Load `/brand` shows tabs, Sources active by default
- Submitting `https://www.allbirds.com` triggers scan, status updates, on completion all tabs populate
- Wiki shows the captured Allbirds voice paragraph verbatim
- Boards shows 4 brand-color cards
- Units shows Wool Runner / Tree Runner / Tree Dasher / Mens Cruiser / Allbirds Slipper

---

## WS-V3 — Spaces page + route migration tail

### `/spaces`

Templates grid renamed Spaces; same data source (current `apps/web/components/studio/TemplateGrid.tsx`). Each card opens `/spaces/[id]`.

### `/spaces/[id]` — Space detail (2-step flow)

- **Step 1: Upload** — drag-drop zone for product images/videos
- **Step 2: Configure** — auto-prefilled prompt + format selector + Launch (fires `POST /api/agents/campaign` like Studio)
- Step indicator at top (1 of 2 / 2 of 2)

### `/settings/profile` `/settings/members` `/settings/integrations`

Profile: name + email + avatar editor (single-form). Members: 1-row "Sundara (you, owner)" with mock invite button. Integrations: redirects to `/connectors`.

### Verification

- Sidebar Spaces tile loads `/spaces` with template cards
- Clicking a card lands on Step 1, advancing to Step 2 fires the same campaign endpoint
- Sidebar "Manage members" and "Settings" links resolve

---

## WS-V4 — `/api/brand/scan` (REAL scan via Tavily) + Allbirds fixture

### `services/api/routers/brand.py` — extend

The scan **does a real web crawl** using Tavily (already wired in the project — `tavily-python` is in `services/api/pyproject.toml` and `TAVILY_API_KEY` is in `.env.example`). Reuse the Tavily client pattern from `services/api/routers/research.py` (WS-E shipped this).

```python
@router.post("/scan")
async def scan_brand(body: BrandScanBody) -> EventSourceResponse:
    # SSE: phase=fetching → phase=parsing → phase=extracting → phase=complete
    # Each phase does real work; events stream as it progresses.
    return event_stream(_scan_stream(body.url))


async def _scan_stream(url: str) -> AsyncIterator[dict]:
    # Phase 1: fetching — Tavily extract on the brand homepage
    yield {"type": "phase", "phase": "fetching", "url": url}
    extract = await asyncio.to_thread(
        tavily_client.extract,
        urls=[url],
        include_images=True,         # we use images for logo + moodboard hints
        extract_depth="advanced",
    )

    # Phase 2: parsing — Tavily search for product catalog pages on the same domain
    yield {"type": "phase", "phase": "parsing"}
    domain = urlparse(url).netloc
    catalog = await asyncio.to_thread(
        tavily_client.search,
        query=f"site:{domain} products",
        max_results=8,
        include_raw_content=True,
    )

    # Phase 3: extracting — synthesize BrandProfile from Tavily output
    yield {"type": "phase", "phase": "extracting"}
    profile = _synthesize_profile(url, extract, catalog)
    #   - logo: first image URL whose path matches /logo|brand|header/i
    #   - palette: regex on extracted CSS / inline-style hex literals → top 4 frequencies
    #   - voice: 1-shot LLM critique pass via services/agents/runtime.execute on the
    #     longest prose chunk Tavily returned, asking for "1-paragraph brand voice
    #     summary, calm/factual/bold/playful axes."
    #   - tagline: og:description meta or the largest <h1> Tavily exposes
    #   - products: top 5 catalog hits whose titles look product-shaped (price, SKU,
    #     /products/ in URL); fall back to Tavily search snippets

    # Phase 4: persist + emit
    await _atomic_write_brand(profile)        # writes fixtures/brand.json
    yield {"type": "phase", "phase": "complete", "profile": profile}
```

### Fallback chain (degrades cleanly, never fakes)

1. **Primary:** Tavily extract + search + LLM voice synthesis.
2. **Tavily missing/down (no `TAVILY_API_KEY` or 4xx/5xx):** fall back to plain `httpx.get(url)` + `selectolax`/regex parse for palette, og:tags, and `/collections/` product links. Voice is heuristic-only ("Brand voice not yet inferred — connect Tavily for richer extraction.")
3. **httpx fetch fails (network / blocked / 404):** return a clear SSE error event `{"type": "error", "code": "fetch_failed", "url": url}`. The frontend Sources tab shows the error inline; user can retry.
4. **`research/shopos/brand_capture.json`** stays in the repo as a **seed fixture** for `fixtures/brand.json` (so the app boots populated even before any scan), but the scan endpoint never substitutes it for a real run.

### Voice extraction (small additive contract)

The LLM voice pass uses the existing agents runtime — no new adapter code, just a one-shot call:
```python
ctx = AdapterExecutionContext(
    agent=AgentSpec(
        id="brand-voice", name="Brand Voice", role="critic",
        instructions="Read the website prose. Return 1 paragraph (<60 words) describing the brand voice — register, sentence rhythm, what they emphasize, what they avoid. No headings.",
        adapter_type=os.getenv("DEFAULT_ADAPTER", "openai"),
    ),
    runtime=RuntimeState(),
    config={},
    context={"prose": longest_prose_chunk},
    on_log=lambda *_: None,
)
result = await agents_runtime.execute(ctx)
voice = result.result_json.get("text", "").strip()
```

If the LLM call fails (no key, rate limit), set `voice = ""` and tag `meta.voice_fallback = True` in the response. Frontend renders "Voice not yet captured" with a retry button.

### `fixtures/brand.json` — rewrite from `research/shopos/brand_capture.json`

Read source: `/Users/u1060059/Downloads/setup/tech_hackathon_marketing/research/shopos/brand_capture.json`. Translate field names to match `shared-types BrandProfile`:

```json
{
  "id": "allbirds",
  "name": "Allbirds",
  "logoUrl": "https://www.allbirds.com/cdn/shop/files/allbirds_logo_navy.svg",
  "tagline": "Comfortable, Sustainable Shoes & Apparel",
  "palette": ["#212121", "#A8A2A7", "#216A51", "#F0C511"],
  "voice": "Calm, plain-spoken, sustainability-forward. Uses first-person plural...",
  "products": [
    {"id": "wool-runner", "name": "Wool Runner", "sku": "wool-runner"},
    {"id": "tree-runner", "name": "Tree Runner", "sku": "tree-runner"},
    {"id": "tree-dasher", "name": "Tree Dasher", "sku": "tree-dasher"},
    {"id": "mens-cruiser", "name": "Mens Cruiser", "sku": "mens-cruiser"},
    {"id": "allbirds-slipper", "name": "Allbirds Slipper", "sku": "allbirds-slipper"}
  ],
  "sourceUrl": "https://www.allbirds.com",
  "lastScannedAt": "2026-05-16T12:49:00Z"
}
```

### Tests

`services/api/tests/test_brand_scan.py` — 5 tests, all mocked (no live network):
1. Happy path: mock `tavily_client.extract` + `tavily_client.search` + `agents_runtime.execute`; assert SSE emits 4 phase events ending in `phase=complete` with a populated `BrandProfile`.
2. Fixture write: assert `fixtures/brand.json` is overwritten atomically post-success.
3. Tavily missing → httpx fallback: clear `TAVILY_API_KEY` env, mock `httpx.AsyncClient.get`; assert profile still synthesized with `meta.voice_fallback=True`.
4. Fetch failure: mock httpx to raise `ConnectError`; assert SSE emits `type=error, code=fetch_failed`.
5. Voice LLM failure: mock `agents_runtime.execute` to raise; assert `voice=""` and `meta.voice_fallback=True`, scan still completes.

### Real-network smoke (manual, not in CI)

Documented in `services/api/tests/README.md`:
```bash
export TAVILY_API_KEY=tvly-...
curl -N -X POST http://localhost:8100/api/brand/scan \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.allbirds.com"}'
# expect 4 SSE events ending with `phase: complete`, then
diff <(jq -S . fixtures/brand.json) <(curl -s http://localhost:8100/api/brand | jq -S .)
# (must match)
```

---

## Files to create/modify (top ~35)

**V0 (~12)** — `lib/utils.ts`, 8 `components/ui/*.tsx`, `components/layout/{AppShell,Sidebar}.tsx`, `app/(app)/layout.tsx`, `app/page.tsx` rewrite. Move 6 existing pages into `(app)/`.

**V1 (~22)** — `app/(app)/studio/page.tsx` (rewrite), `components/studio/chat/{ChatRail,ChatHeader,ThreadMessageList,UserMessageBubble,ReasoningBlock,GenerationChip,AssistantProse,FeedbackRow,SuggestedFollowups,ComposerFooter}.tsx`, `components/studio/canvas/{LiquidCanvas,ViewModeToggle,ThumbnailStrip,VariantStack}.tsx`, restyle `@cie/ui-artifacts/ArtifactCard.tsx`, empty-state `components/studio/EmptyStateHero.tsx` + format/UGC/avatar pills (`PlusMenu`, `UgcPresetsModal`, `AvatarPresetsModal`, `BrandPill`), `public/ugc-presets/{presets.json,1..6.jpg}`, `public/avatar-presets/{presets.json,1..9.jpg}`. Plus 2 backend touches: `services/agents/nodes/art_director.py` (3-variant fan-out) and `services/agents/orchestrator.py` (group artifacts by shotId).

**V2 (~7)** — `app/(app)/brand/page.tsx` (rewrite), `components/brand/{BrandMemoryTabs,SourcesPanel,BoardsPanel,WikiPanel,GraphPanel}.tsx` (UnitsPanel reuses existing ProductList).

**V3 (~6)** — `app/(app)/spaces/page.tsx`, `app/(app)/spaces/[id]/page.tsx`, `components/spaces/{SpaceCard,SpaceGrid,SpaceSteps}.tsx`, `app/(app)/settings/{profile,members,integrations}/page.tsx`.

**V4 (~3)** — `services/api/routers/brand.py` (extend), `fixtures/brand.json` (rewrite), `services/api/tests/test_brand_scan.py`.

---

## Reused code references

- `apps/web/components/studio/{PromptInput,FormatPicker}.tsx` — keep, used inside `EmptyStateHero` only.
- `apps/web/components/studio/LiveCanvasView.tsx` — replaced by `LiquidCanvas`; delete after V1.
- `@cie/ui-artifacts/ArtifactCarousel.tsx` — already supports 3 view modes (focus/grid/stack via `Cmd+[` / `Cmd+]`) — feed it directly from V1's LiquidCanvas; restyle to match hyperagent's frosted-card aesthetic.
- `@cie/ui-artifacts/ArtifactCard.tsx` — restyle borders, shadows, label-pill positioning to match hyperagent screenshots.
- `@cie/ui-artifacts/{Image,Video,Document,Slide,Table,Code}Renderer.tsx` — already exist; the carousel pulls them through `ArtifactRenderer.tsx` for mixed-content slidable canvas (image + video + brief PDF + landing-page mockup all flow through the same surface).
- `services/agents/orchestrator.py` + `nodes/art_director.py` — extend to fan out 3 variants per shot.
- `services/api/routers/score.py` — already exists; called per-variant after each generation.
- `apps/web/components/brand/{ProductList,PaletteEditor,LogoUploader}.tsx` — port into V2 tab panels.
- `apps/web/app/globals.css` glass tokens — keep, sidebar uses shadcn neutrals on top.
- `services/api/routers/brand.py` (existing GET/PUT /api/brand) — extend with /scan, don't rewrite.
- `services/api/sse.py event_stream` — reuse for the scan SSE.
- `research/shopos/brand_capture.json` — single source of truth for the Allbirds seed.

---

## Build order (~6h target, hackathon pacing)

- **H0-H1 V0:** install deps, drop in shadcn primitives + sidebar, migrate routes, redirect `/`. Boot dev, click through every sidebar item, no broken links.
- **H1-H3 V1 + V2 + V3 + V4 in parallel** (4 background agents).
- **H3-H4** Merge: typecheck, build, run Playwright smoke, fix selector breakage from layout changes.
- **H4-H5** Live demo dry run with real OPENAI_API_KEY + FAL_KEY: prompt in Studio → SSE → canvas + chips → Publish. Capture 90s screen recording.
- **H5-H6** Polish + push to GitHub. Squash-merge into existing `main`.

---

## Verification (full system)

```bash
pnpm install
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter web dev    # :3000

# In another terminal:
cd services/api && uv run uvicorn main:app --reload --port 8100

# Smoke
curl -s http://localhost:3000/  # 307 → /studio
curl -sN -X POST http://localhost:8100/api/brand/scan -H 'content-type: application/json' \
  -d '{"url":"https://www.allbirds.com"}' | head -20  # SSE phases
diff fixtures/brand.json <(curl -s http://localhost:8100/api/brand)  # match

# Playwright
pnpm --filter web exec playwright test
```

Required:
- All 7 sidebar links resolve to a populated page (no `{todo: true}` placeholder).
- `fixtures/brand.json` contains Allbirds, not Acme Sneakers.
- Studio composer sticks to bottom; UGC + Avatar dropdowns show 6/9 presets each.
- Brand Memory page shows 5 tabs; Sources tab triggers a working scan.
- Existing 35 backend tests + 3 Playwright tests still pass (selector-fix any breakages).

## Risks & cuts

- **R1 shadcn sidebar Framer-Motion conflicts with React 19.** *Cut:* swap `motion.div` for plain `<div>` + Tailwind transition classes; lose stagger animation, keep collapse.
- **R2 Public-domain UGC/Avatar images have licensing friction.** *Cut:* use plain solid-color placeholders with text labels (`UGC 1`, `Avatar 1`) — design intent communicated, no asset risk.
- **R3 Tavily quota exhausted mid-demo.** *Cut:* env flag `BRAND_SCAN_FALLBACK=httpx` forces the plain-httpx path; voice tagged `voice_fallback=True`. Demo still works, just thinner content.
- **R3b Brand-scan SSE adds backend churn.** *Cut:* if SSE wiring blocks too long, replace with a synchronous `POST /api/brand/scan` returning the brand profile after the same 4 real phases run sequentially. UI shows a single "Generating…" spinner instead of the phase cascade. The 4 phase events are nice-to-have, not load-bearing for the demo.
- **R4 Route migration breaks existing Playwright selectors.** *Cut:* update selectors as part of V0; tests must remain green at V0 exit.
- **R5 Variant fan-out triples generation cost / time.** *Cut:* keep the API contract (3 variants per shot) but in the orchestrator fall back to 1 variant when `FAL_KEY` budget is tight (env flag `VARIANTS_PER_SHOT=1`). Frontend keeps the `<VariantStack>` component — it just renders 1 child gracefully.
- **R6 Liquid-glass canvas backdrop may look wrong on a low-spec demo machine.** *Cut:* the gradient + noise overlay is pure CSS — no perf risk. Keep.
- **R7 Restyling `@cie/ui-artifacts/ArtifactCard.tsx` could break existing carousel tests.** *Cut:* carousel keyboard nav (`Cmd+[`/`Cmd+]`) and 3 view modes must remain functional; restyling is class-only, no logic edits.
- **R8 Time pressure forces dropping a workstream.** Drop priority: V3 (Spaces detail) > V2 graph tab > V1 avatar modal > V1 variant fan-out (back to 1 variant per shot). V0 + V1 chat-rail + V1 LiquidCanvas + V2 Brand Sources are non-negotiable for the demo.
