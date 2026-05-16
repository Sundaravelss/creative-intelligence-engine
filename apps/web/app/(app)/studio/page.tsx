"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Globe, LayoutTemplate, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Artifact as UiArtifact } from "@cie/ui-artifacts";

import { ChatRail } from "@/components/studio/chat/ChatRail";
import type {
  ChatMessage,
  GenerationChipData,
  SuggestedFollowupItem,
} from "@/components/studio/chat/types";
import { LiquidCanvas } from "@/components/studio/canvas/LiquidCanvas";
import type { CanvasViewMode } from "@/components/studio/canvas/ViewModeToggle";
import {
  EmptyStateHello,
  type BrandProfile,
} from "@/components/studio/EmptyStateHello";
import { SpacesHintCard } from "@/components/studio/SpacesHintCard";
import type { StudioFormat } from "@/components/studio/FormatPicker";
import { ScheduleModal } from "@/components/loops/ScheduleModal";
import { api } from "@/lib/api";
import { useBrand } from "@/lib/brand";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const PROJECT_NAME = "Marketing Image Generation for Bags";

const DEFAULT_FOLLOWUPS: SuggestedFollowupItem[] = [
  {
    icon: Sparkles,
    label: "Generate more variations",
    query: "Generate three more variations of the same shot.",
  },
  {
    icon: Globe,
    label: "Build a campaign landing page",
    query: "Build a campaign landing page based on these images.",
  },
  {
    icon: Film,
    label: "Animate one into a video",
    query: "Animate the selected variant into a 6-second video.",
  },
  {
    icon: LayoutTemplate,
    label: "Social media crops",
    query: "Create social media crops (1:1, 9:16, 4:5) of the chosen variant.",
  },
];

const REASONING_BY_NODE: Record<string, string> = {
  strategist:
    "Reading the brief — bags, marketing imagery. Mapping audience: design-led shoppers, urban, late-20s. Pulling 3 hook angles: heritage craft, daily-carry utility, statement silhouette.",
  creative_director:
    "Picking format mix (9:16 hero + 1:1 supporting). Reserving budget for 3 variants per shot: editorial, golden-hour, overcast. Variants will be scored side by side.",
  art_director:
    "Composing shot list. Flagging references: Helmut Newton's hard light, Margiela atelier flatlays, Saul Leiter colour blocking. Routing to Nano Banana 2 (Flash Im) for variants.",
  analyst:
    "Scoring each variant on hook density, contrast, motion, novelty. Picking the leader.",
  publisher:
    "Standing by to publish the chosen variant to Meta + Instagram.",
};

interface SsePayload {
  nodeId?: string;
  artifact?: {
    id?: string;
    url?: string;
    kind?: "image" | "video" | "document" | "code";
    name?: string;
    shotId?: string;
    variantId?: string;
    variantLabel?: string;
    meta?: Record<string, unknown>;
  };
  message?: string;
  scores?: Array<{
    artifactId: string;
    viralScore: number;
  }>;
  // v3 additive event payloads (started / thought / agent_step_start / agent_step_complete).
  agentId?: string;
  summary?: string;
  fullText?: string;
  elapsedSec?: number;
  label?: string;
  totalSubsteps?: number;
  completedSubsteps?: number;
  substeps?: Array<{ label: string; status: "joined" | "done" | "failed" }>;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowTs(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading studio…
        </div>
      }
    >
      <StudioPageInner />
    </Suspense>
  );
}

function StudioPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const adapterParam = searchParams?.get("adapter") ?? "openai";
  const viewParam = (searchParams?.get("view") as CanvasViewMode) ?? "carousel";

  const [adapter, setAdapter] = useState<string>(adapterParam);
  const [viewMode, setViewModeState] = useState<CanvasViewMode>(viewParam);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<UiArtifact[]>([]);
  const [selectedVariantByShot, setSelectedVariantByShot] = useState<
    Record<string, string>
  >({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [format, _setFormat] = useState<StudioFormat>("reel");
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSeed, setScheduleSeed] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const chipTimers = useRef<Map<string, number>>(new Map());

  const { brandId } = useBrand();
  const brandIdRef = useRef(brandId);
  brandIdRef.current = brandId;

  // Suppress "unused setter" lint — format may be set by future composer affordances.
  void _setFormat;

  // Load brand profile once for the Hello hero.
  useEffect(() => {
    let cancelled = false;
    api
      .get<BrandProfile>("/api/brand")
      .then((b) => {
        if (cancelled) return;
        setBrand(b ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setBrand(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick generation chips so the elapsed counter advances visibly.
  useEffect(() => {
    const id = window.setInterval(() => {
      setThread((curr) =>
        curr.map((msg) => {
          if (msg.kind !== "generation") return msg;
          const next = msg.chips.map((c) =>
            c.status === "running"
              ? { ...c, elapsedSec: c.elapsedSec + 1 }
              : c,
          );
          return { ...msg, chips: next };
        }),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Sync view to URL.
  const setViewMode = useCallback(
    (m: CanvasViewMode) => {
      setViewModeState(m);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", m);
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setAdapterAndUrl = useCallback(
    (a: string) => {
      setAdapter(a);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("adapter", a);
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const updateGenerationChip = useCallback(
    (chipId: string, patch: Partial<GenerationChipData>) => {
      setThread((curr) =>
        curr.map((msg) => {
          if (msg.kind !== "generation") return msg;
          const found = msg.chips.find((c) => c.id === chipId);
          if (!found) return msg;
          return {
            ...msg,
            chips: msg.chips.map((c) =>
              c.id === chipId ? { ...c, ...patch } : c,
            ),
          };
        }),
      );
    },
    [],
  );

  const appendChipToActiveGen = useCallback(
    (chip: GenerationChipData) => {
      setThread((curr) => {
        // Find the LAST generation block.
        const lastIdx = [...curr]
          .reverse()
          .findIndex((m) => m.kind === "generation");
        if (lastIdx === -1) {
          return [
            ...curr,
            { kind: "generation", id: uid("gen"), chips: [chip] },
          ];
        }
        const realIdx = curr.length - 1 - lastIdx;
        const target = curr[realIdx];
        if (target.kind !== "generation") return curr;
        const next = [...curr];
        next[realIdx] = { ...target, chips: [...target.chips, chip] };
        return next;
      });
    },
    [],
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      if (running) {
        toast.error("A run is already streaming. Wait for it to finish.");
        return;
      }
      // Abort any prior controller; reset run state for this turn.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      chipTimers.current.clear();

      const userMsg: ChatMessage = {
        kind: "user",
        id: uid("u"),
        text,
        timestamp: nowTs(),
      };

      setThread((curr) => [...curr, userMsg]);
      setRunning(true);

      try {
        const res = await fetch(
          `${API_BASE}/api/agents/campaign?adapter=${encodeURIComponent(adapter)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief: { keyword: text },
              brand_id: brandIdRef.current,
              format,
              variants_per_shot: 3,
            }),
            signal: controller.signal,
          },
        );

        if (!res.ok || !res.body) {
          throw new Error(`Campaign request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let genBlockOpened = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseSseBlock(block);
            if (!parsed) {
              idx = buffer.indexOf("\n\n");
              continue;
            }
            const { event, data } = parsed;

            if (event === "started") {
              setThread((curr) => [
                ...curr,
                { kind: "started", id: uid("st"), ts: new Date().toISOString() },
              ]);
            } else if (event === "thought") {
              setThread((curr) => [
                ...curr,
                {
                  kind: "thought",
                  id: uid("th"),
                  agentId: data.agentId ?? "strategist",
                  summary: data.summary ?? "",
                  fullText: data.fullText ?? "",
                  elapsedSec: Number(data.elapsedSec) || 0,
                  collapsed: true,
                },
              ]);
            } else if (event === "agent_step_start") {
              setThread((curr) => [
                ...curr,
                {
                  kind: "agent_step",
                  id: uid("step"),
                  agentId: data.agentId ?? "strategist",
                  label: data.label ?? "Working",
                  completed: 0,
                  total: Number(data.totalSubsteps) || 1,
                  substeps: [],
                  collapsed: true,
                },
              ]);
            } else if (event === "agent_step_complete") {
              const targetAgentId = data.agentId;
              const completedCount = Number(data.completedSubsteps);
              const nextSubsteps = data.substeps ?? [];
              setThread((curr) => {
                // Match the LAST agent_step block for this agentId that hasn't
                // been completed yet. Walking back-to-front avoids racing past
                // earlier blocks if the same agent runs twice in one campaign.
                let patched = false;
                const next = [...curr];
                for (let i = next.length - 1; i >= 0; i--) {
                  const m = next[i];
                  if (
                    m.kind === "agent_step" &&
                    m.agentId === targetAgentId &&
                    m.completed < m.total
                  ) {
                    next[i] = {
                      ...m,
                      completed:
                        Number.isFinite(completedCount) && completedCount > 0
                          ? completedCount
                          : m.total,
                      substeps: nextSubsteps,
                    };
                    patched = true;
                    break;
                  }
                }
                return patched ? next : curr;
              });
            } else if (event === "node_start" && data.nodeId) {
              const nodeId = data.nodeId;
              const reasoning = REASONING_BY_NODE[nodeId];
              if (reasoning) {
                setThread((curr) => [
                  ...curr,
                  {
                    kind: "reasoning",
                    id: uid("r"),
                    text: reasoning,
                    title: titleForNode(nodeId),
                  },
                ]);
              }
              if (nodeId === "art_director" && !genBlockOpened) {
                setThread((curr) => [
                  ...curr,
                  { kind: "generation", id: uid("gen"), chips: [] },
                ]);
                genBlockOpened = true;
              }
            } else if (event === "artifact" && data.artifact) {
              const a = data.artifact;
              const id = a.id ?? uid("a");
              const variantLabel = a.variantLabel ?? "Variant";
              const shotId = a.shotId ?? id;
              const url = a.url ?? "";
              const kind = a.kind ?? "image";
              if (kind === "image" || kind === "video") {
                const artifact: UiArtifact = (kind === "image"
                  ? {
                      id,
                      type: "image",
                      url,
                      name: a.name ?? variantLabel,
                      source: variantLabel,
                    }
                  : {
                      id,
                      type: "video",
                      url,
                      name: a.name ?? variantLabel,
                      source: variantLabel,
                    }) as UiArtifact;
                // Stash variantOf + meta on the artifact for grouping/scoring.
                (artifact as unknown as { meta: Record<string, unknown> }).meta = {
                  variantOf: shotId,
                  variantLabel,
                  ...(a.meta ?? {}),
                };
                setArtifacts((curr) => [...curr, artifact]);
                if (focusId === null) setFocusId(id);

                const chip: GenerationChipData = {
                  id: uid("chip"),
                  label: "Generated image",
                  promptSummary: `${variantLabel} — ${a.name ?? "shot"}`,
                  modelName: "Nano Banana 2 (Flash Im)",
                  status: "complete",
                  elapsedSec: 7,
                  etaSec: 7,
                  shotId,
                  variantId: id,
                  artifactId: id,
                };
                appendChipToActiveGen(chip);
              }
            } else if (event === "node_complete" && data.scores) {
              // Score patch into existing artifacts.
              setArtifacts((curr) =>
                curr.map((art) => {
                  const match = data.scores?.find(
                    (s) => s.artifactId === art.id,
                  );
                  if (!match) return art;
                  const existing = art as unknown as {
                    meta?: Record<string, unknown>;
                  };
                  const nextMeta = {
                    ...(existing.meta ?? {}),
                    viralScore: match.viralScore,
                  };
                  return {
                    ...(art as unknown as Record<string, unknown>),
                    meta: nextMeta,
                  } as unknown as UiArtifact;
                }),
              );
            } else if (event === "done") {
              setThread((curr) => [
                ...curr,
                {
                  kind: "assistant",
                  id: uid("a"),
                  text:
                    "Three variants are on the canvas — editorial, golden-hour, and overcast. Want me to push any of these further: swap colors, generate matching social crops, or animate the selected shot into a 6-second cut?",
                },
                { kind: "followups", id: uid("f"), items: DEFAULT_FOLLOWUPS },
              ]);
            } else if (event === "error") {
              toast.error(data.message ?? "Stream error");
            }
            idx = buffer.indexOf("\n\n");
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user navigated away
        } else {
          const msg = err instanceof Error ? err.message : "Run failed";
          toast.error(msg);
          // Demo-friendly fallback: stub out a synthetic answer so the screen
          // still tells a story when the FastAPI backend isn't up.
          fallbackSyntheticRun({
            text,
            setThread,
            setArtifacts,
            setFocusId,
            appendChipToActiveGen,
          });
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
        // Mark any still-running chips as complete so the UI doesn't hang.
        setThread((curr) =>
          curr.map((msg) =>
            msg.kind === "generation"
              ? {
                  ...msg,
                  chips: msg.chips.map((c) =>
                    c.status === "running" ? { ...c, status: "complete" } : c,
                  ),
                }
              : msg,
          ),
        );
        void updateGenerationChip;
      }
    },
    [adapter, format, focusId, running, appendChipToActiveGen, updateGenerationChip],
  );

  const handleFollowup = useCallback(
    (item: SuggestedFollowupItem) => {
      void handleSubmit(item.query);
    },
    [handleSubmit],
  );

  const handleChipFocus = useCallback((chip: GenerationChipData) => {
    if (chip.artifactId) setFocusId(chip.artifactId);
  }, []);

  const handleSelectVariant = useCallback(
    (shotId: string, variantId: string) => {
      setSelectedVariantByShot((curr) => ({ ...curr, [shotId]: variantId }));
    },
    [],
  );

  const isEmpty = useMemo(() => thread.length === 0, [thread.length]);

  const openSchedule = useCallback((currentText: string) => {
    setScheduleSeed(currentText);
    setScheduleOpen(true);
  }, []);

  // Empty state: single centered hero, no left rail. After the first message
  // arrives, the layout snaps into the two-pane (chat left, canvas right)
  // shape so the hero composer is replaced by the chat thread that owns it.
  if (isEmpty) {
    return (
      <div className="relative h-full">
        <EmptyStateHello
          brand={brand}
          onSubmit={handleSubmit}
          onSchedule={openSchedule}
          disabled={running}
        />
        <SpacesHintCard />
        <ScheduleModal
          open={scheduleOpen}
          initialPrompt={scheduleSeed}
          onClose={() => setScheduleOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[480px_1fr]">
      <ChatRail
        thread={thread}
        projectName={PROJECT_NAME}
        live={running}
        modelLabel="Opus 4.7"
        adapter={adapter}
        setAdapter={setAdapterAndUrl}
        onSubmit={handleSubmit}
        onSchedule={openSchedule}
        onChipFocus={handleChipFocus}
        onFollowup={handleFollowup}
        disabled={running}
      />
      <LiquidCanvas
        artifacts={artifacts}
        viewMode={viewMode}
        setViewMode={setViewMode}
        focusId={focusId}
        setFocusId={setFocusId}
        selectedVariantByShot={selectedVariantByShot}
        onSelectVariant={handleSelectVariant}
      />
      <ScheduleModal
        open={scheduleOpen}
        initialPrompt={scheduleSeed}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  );
}

function titleForNode(nodeId: string): string {
  if (nodeId === "strategist") return "Reasoning · Strategist";
  if (nodeId === "creative_director") return "Reasoning · Creative Director";
  if (nodeId === "art_director") return "Reasoning · Art Director";
  if (nodeId === "analyst") return "Reasoning · Performance Analyst";
  if (nodeId === "publisher") return "Reasoning · Publisher";
  return "Reasoning…";
}

interface ParsedBlock {
  event: string;
  data: SsePayload;
}

function parseSseBlock(block: string): ParsedBlock | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as SsePayload };
  } catch {
    return null;
  }
}

interface FallbackArgs {
  text: string;
  setThread: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setArtifacts: React.Dispatch<React.SetStateAction<UiArtifact[]>>;
  setFocusId: (id: string) => void;
  appendChipToActiveGen: (chip: GenerationChipData) => void;
}

function fallbackSyntheticRun({
  text,
  setThread,
  setArtifacts,
  setFocusId,
  appendChipToActiveGen,
}: FallbackArgs): void {
  // Tiny, deterministic, demo-shaped local fallback when the backend is offline.
  setThread((curr) => [
    ...curr,
    {
      kind: "reasoning",
      id: uid("r"),
      text: REASONING_BY_NODE.strategist,
      title: "Reasoning · Strategist",
    },
    {
      kind: "reasoning",
      id: uid("r"),
      text: REASONING_BY_NODE.art_director,
      title: "Reasoning · Art Director",
    },
    { kind: "generation", id: uid("gen"), chips: [] },
  ]);
  const variants = ["Editorial", "Golden Hour", "Overcast"];
  const shotId = uid("shot");
  variants.forEach((label, i) => {
    const id = `${shotId}-v${i}`;
    const placeholderUrl = `https://picsum.photos/seed/${shotId}-${i}/600/800`;
    const artifact: UiArtifact = {
      id,
      type: "image",
      url: placeholderUrl,
      name: `${label} — ${text.slice(0, 32)}`,
      source: label,
    };
    (artifact as unknown as { meta: Record<string, unknown> }).meta = {
      variantOf: shotId,
      variantLabel: label,
      viralScore: 60 + i * 10,
    };
    setArtifacts((curr) => [...curr, artifact]);
    if (i === 0) setFocusId(id);
    appendChipToActiveGen({
      id: uid("chip"),
      label: "Generated image",
      promptSummary: `${label} — ${text.slice(0, 40)}`,
      modelName: "Nano Banana 2 (Flash Im)",
      status: "complete",
      elapsedSec: 7,
      etaSec: 7,
      shotId,
      variantId: id,
      artifactId: id,
    });
  });
  setThread((curr) => [
    ...curr,
    {
      kind: "assistant",
      id: uid("a"),
      text: "Three style variants are on the canvas. The golden-hour cut is leading on hook density — want me to lock it and generate matching social crops?",
    },
    { kind: "followups", id: uid("f"), items: DEFAULT_FOLLOWUPS },
  ]);
}
