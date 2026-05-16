# CIE — 90-second demo

A scripted walkthrough showing the two highest-signal flows — **A** (connect a
channel) and **D** (brief → live canvas → publish → loop). Everything below is
designed to run on `localhost:3000` against the local FastAPI on `:8100`.

## Pre-flight

1. `pnpm --filter web dev` on `:3000`.
2. `cd services/api && uv run uvicorn main:app --reload --port 8100`.
3. `cd services/scheduler && uv run python main.py` (Loops worker).
4. Browser open at `http://localhost:3000`.

---

## 0:00 — 0:10 · Landing

Open `http://localhost:3000`.

> "Creative Intelligence Engine — agentic Marketing OS. Six tiles, one
> liquid-glass surface."

Click **Connectors**.

![](./screenshots/01_landing.png)

---

## 0:10 — 0:25 · Flow A · Connectors

On `/connectors`:

- Already-Connected pills: **Pioneer**, **OpenAI**, **FAL**, **Tavily**.
- Click **Connect** on **Meta Ads** → modal → **Authorize**.
- Status flips to **Connected** with a fresh timestamp.

> "Pioneer, OpenAI, FAL, Tavily are pre-wired. Meta Ads just connected — the
> rest of the demo will publish through it."

![](./screenshots/02_connectors.png)

---

## 0:25 — 1:15 · Flow D · Studio → Canvas → Publish

Navigate to `/studio`.

1. Type into the prompt box:
   > `Launch winter sneakers, Gen-Z, Paris`

2. Pick **Reel** in the format picker (9:16 vertical).
3. Brand selector → **Acme Sneakers** (loaded from `/api/brand`).
4. Click **Run** (or press **⌘+Enter**).

Watch the **Live canvas** populate as the SSE stream arrives:

- `node_start strategist` → coral pill in the timeline
- `node_complete strategist` → emerald pill, edge pulses to next node
- … through `creative_director`, `copywriter`, `art_director`, `analyst`,
  `publisher`
- An **image artifact** appears on the Art Director node (FAL Flux/dev)
- A **Score chip** lands on the Analyst node (e.g. "Viral 78")

> "Six agents — Strategist, CD, Copywriter, Art Director, Analyst, Publisher —
> each one a node. The orchestrator ships their outputs as artifacts in the
> same canvas."

Click **Publish** → toast: "Published to Meta Ads (mock)."

![](./screenshots/03_studio_running.png)
![](./screenshots/04_studio_done.png)

---

## 1:15 — 1:30 · Loops

Navigate to `/loops`.

1. Click **New loop** → name "Daily Reels — Storm Runner", cron `0 9 * * *`,
   channel `instagram`, brand `storm-runner`.
2. Save.
3. Click **Run now** on the new row.

A new row appears under **Run history**. The mock post lands in
`fixtures/posts.json`.

> "Same pipeline, recurring. APScheduler ticks Loops; each tick re-runs the
> orchestrator headlessly."

![](./screenshots/05_loops.png)

---

## Wrap

> "Canvas, agents, loops, connectors — one liquid-glass surface, swappable
> backends (`pioneer` by default, `openai` as fallback), real generation on
> FAL, real research on Tavily, mock publish + insights for the demo."

## Speaker notes

- If FAL credits are exhausted: switch `DEFAULT_ADAPTER=openai` and the
  Studio flow still works — image artifact comes from
  `services/api/adapters_gen/openai_image.py`.
- If Pioneer endpoint is unreachable, agents fall back to `openai` adapter
  silently; the timeline doesn't change shape.
- The Score chip is visible on every artifact within ~3s — it's heuristic +
  one LLM critique pass, not a black-box model.
