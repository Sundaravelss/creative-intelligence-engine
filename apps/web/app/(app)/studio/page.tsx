"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

import { PromptInput } from "../../../components/studio/PromptInput";
import {
  FormatPicker,
  type StudioFormat,
} from "../../../components/studio/FormatPicker";
import { TemplateGrid } from "../../../components/studio/TemplateGrid";
import { RunButton } from "../../../components/studio/RunButton";
import {
  LiveCanvasView,
  type LiveNodeEvent,
} from "../../../components/studio/LiveCanvasView";

interface BrandSummary {
  id: string;
  name: string;
}

interface BrandResponse {
  id?: string;
  name?: string;
  brands?: BrandSummary[];
}

interface SsePayload {
  nodeId?: string;
  artifact?: { url: string; kind: "image" | "video" };
  message?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const DEFAULT_BRANDS: BrandSummary[] = [
  { id: "acme-sneakers", name: "Acme Sneakers" },
  { id: "storm-runner", name: "Storm Runner" },
];

interface TimelineEntry {
  nodeId: string;
  phase: "start" | "complete";
  ts: number;
}

export default function StudioPage() {
  const [prompt, setPrompt] = useState<string>(
    "Launch winter sneakers, Gen-Z, Paris",
  );
  const [format, setFormat] = useState<StudioFormat>("reel");
  const [brandId, setBrandId] = useState<string>(DEFAULT_BRANDS[0].id);
  const [brands, setBrands] = useState<BrandSummary[]>(DEFAULT_BRANDS);
  const [running, setRunning] = useState<boolean>(false);
  const [events, setEvents] = useState<LiveNodeEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Best-effort brand load. Keeps a working default if /api/brand is missing.
  useEffect(() => {
    let cancelled = false;
    async function loadBrands() {
      try {
        const res = await fetch(`${API_BASE}/api/brand`, { cache: "no-store" });
        if (!res.ok) return;
        const data: BrandResponse = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.brands) && data.brands.length > 0) {
          setBrands(data.brands);
          setBrandId(data.brands[0].id);
        } else if (data.id && data.name) {
          setBrands([{ id: data.id, name: data.name }]);
          setBrandId(data.id);
        }
      } catch {
        // Backend offline or stub — keep DEFAULT_BRANDS.
      }
    }
    loadBrands();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickTemplate = useCallback((scaffold: string) => {
    setPrompt(scaffold);
  }, []);

  const subjectFromPrompt = useMemo(() => prompt.split(/[,.\n]/)[0] ?? "", [prompt]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Add a brief before running.");
      return;
    }
    setError(null);
    setEvents([]);
    setTimeline([]);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/api/agents/campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: { keyword: prompt },
          brand_id: brandId,
          format,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Campaign request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE blocks separated by blank line.
        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          parseSseBlock(block, {
            onStart: (nodeId) => {
              setEvents((curr) => [...curr, { nodeId, phase: "start" }]);
              setTimeline((curr) => [
                ...curr,
                { nodeId, phase: "start", ts: Date.now() },
              ]);
            },
            onComplete: (nodeId) => {
              setEvents((curr) => [...curr, { nodeId, phase: "complete" }]);
              setTimeline((curr) => [
                ...curr,
                { nodeId, phase: "complete", ts: Date.now() },
              ]);
            },
            onArtifact: (nodeId, artifact) => {
              setEvents((curr) => [
                ...curr,
                { nodeId, phase: "complete", artifact },
              ]);
            },
            onDone: () => {
              toast.success("Campaign ready");
            },
            onError: (msg) => {
              setError(msg);
              toast.error(msg);
            },
          });
          idx = buffer.indexOf("\n\n");
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user cancelled
      } else {
        const msg =
          err instanceof Error ? err.message : "Failed to run campaign";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [prompt, brandId, format]);

  const handlePublish = useCallback(() => {
    toast.success("Published to Meta Ads (mock).");
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundMesh />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Marketing Studio
            </p>
            <h1 className="hc-serif-headline mt-1 text-4xl font-semibold tracking-tight">
              Brief in. Campaign out.
            </h1>
          </div>
          <BrandSelector
            value={brandId}
            options={brands}
            onChange={setBrandId}
            disabled={running}
          />
        </header>

        <section className="flex flex-col gap-3">
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleRun}
            disabled={running}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FormatPicker value={format} onChange={setFormat} />
            <div className="flex items-center gap-2">
              {running ? (
                <button
                  type="button"
                  onClick={stop}
                  className="hc-pill hc-glass border border-[color:var(--color-border)] px-4 py-2 text-sm"
                >
                  Stop
                </button>
              ) : null}
              <RunButton onClick={handleRun} loading={running} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Templates
          </h2>
          <TemplateGrid subject={subjectFromPrompt} onPick={handlePickTemplate} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Live canvas
            </h2>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!events.some((e) => e.artifact)}
              className="hc-pill hc-glass inline-flex items-center gap-1 border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium transition-colors hover:border-[color:var(--hc-accent-coral)] disabled:opacity-50"
            >
              Publish <ChevronRight size={12} />
            </button>
          </div>
          <LiveCanvasView events={events} active={running} />
          <Timeline entries={timeline} />
          {error ? (
            <div className="hc-glass inline-flex items-center gap-2 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-destructive)]">
              <AlertCircle size={14} />
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

interface BrandSelectorProps {
  value: string;
  options: BrandSummary[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

function BrandSelector({ value, options, onChange, disabled }: BrandSelectorProps) {
  return (
    <label className="hc-pill hc-glass inline-flex items-center gap-2 border border-[color:var(--color-border)] px-3 py-1.5 text-sm">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Brand
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-transparent text-sm font-medium outline-none"
      >
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TimelineProps {
  entries: TimelineEntry[];
}

function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Run a brief to populate the timeline.
      </p>
    );
  }
  return (
    <ol
      className="flex flex-wrap items-center gap-2"
      data-testid="cie-timeline"
    >
      {entries.map((e, i) => (
        <li
          key={`${e.nodeId}-${e.phase}-${i}`}
          className={[
            "hc-pill inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium",
            e.phase === "complete"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-[color:var(--hc-accent-coral)] bg-[color:var(--hc-accent-coral-soft)] text-[color:var(--hc-accent-coral)]",
          ].join(" ")}
        >
          {e.phase === "complete" ? (
            <CheckCircle2 size={11} />
          ) : (
            <Circle size={11} />
          )}
          <span className="font-mono uppercase tracking-wider">{e.nodeId}</span>
        </li>
      ))}
    </ol>
  );
}

function BackgroundMesh() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 15% 0%, var(--hc-accent-coral-soft) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 100% 100%, oklch(0.78 0.14 240 / 0.18) 0%, transparent 60%)",
      }}
    />
  );
}

interface SseHandlers {
  onStart: (nodeId: string) => void;
  onComplete: (nodeId: string) => void;
  onArtifact: (
    nodeId: string,
    artifact: { url: string; kind: "image" | "video" },
  ) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

function parseSseBlock(block: string, h: SseHandlers): void {
  // SSE block can have multiple `event:` and `data:` lines.
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  const dataStr = dataLines.join("\n");
  let data: SsePayload = {};
  try {
    data = JSON.parse(dataStr) as SsePayload;
  } catch {
    return;
  }

  switch (event) {
    case "node_start":
      if (data.nodeId) h.onStart(data.nodeId);
      break;
    case "node_complete":
      if (data.nodeId) h.onComplete(data.nodeId);
      break;
    case "artifact":
      if (data.nodeId && data.artifact) h.onArtifact(data.nodeId, data.artifact);
      break;
    case "done":
      h.onDone();
      break;
    case "error":
      h.onError(data.message ?? "Unknown error");
      break;
    default:
      break;
  }
}
