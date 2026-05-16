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

// In dev the FastAPI backend runs on :8100 (separate process). When
// NEXT_PUBLIC_API_BASE_URL is unset we default to that so the campaign POST
// hits the real adapter pipeline instead of falling through to the synthetic
// fallback (the picsum landscapes the user kept seeing).
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8100";

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
    "Picking format mix (9:16 hero + 1:1 supporting). Reserving budget for 3 style variants per shot. Variants will be scored side by side.",
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
  // v4 streaming events (text_delta / text_done) — per-token reasoning prose.
  chunk?: string;
  // v5 chat-completions sentinel-tag image-gen tool_use event.
  tool?: string;
  toolUseId?: string;
  input?: { prompt?: string; aspect?: string };
  // /api/chat/completions adds runId on `started` + `done`.
  runId?: string;
  agentName?: string;
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

  // Default to claude_code; tolerate the historical "claude" alias.
  const rawAdapterParam = searchParams?.get("adapter") ?? "claude_code";
  const adapterParam = rawAdapterParam === "claude" ? "claude_code" : rawAdapterParam;
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
    async (
      text: string,
      attachments: Array<{
        url: string;
        filename: string;
        contentType: string;
        preview: string;
      }> = [],
    ) => {
      if (running) {
        toast.error("A run is already streaming. Wait for it to finish.");
        return;
      }
      // Abort any prior in-flight controller. Note: we deliberately don't
      // abort if the prior controller already finished (signal.aborted false
      // and no longer attached) — the manual Stop button handles user-driven
      // cancellation explicitly via abortRef.current?.abort().
      const prior = abortRef.current;
      if (prior && !prior.signal.aborted) {
        prior.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      chipTimers.current.clear();

      const userMsg: ChatMessage = {
        kind: "user",
        id: uid("u"),
        text,
        timestamp: nowTs(),
        attachments: attachments.length
          ? attachments.map((a) => ({
              url: a.url,
              filename: a.filename,
              contentType: a.contentType,
              preview: a.preview,
            }))
          : undefined,
      };

      setThread((curr) => [...curr, userMsg]);
      setRunning(true);

      try {
        // Studio = Claude chat with FAL image-gen tool. The 6-node campaign
        // orchestrator at /api/agents/campaign is reserved for /agents.
        // Body shape matches services/api/routers/chat.py::ChatCompletionsInput.
        const res = await fetch(`${API_BASE}/api/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            // agent_id omitted → backend defaults to "sage". /agents/[id] passes its own.
            adapter: adapter || "claude_code",
            attachments: attachments.map((a) => ({
              url: a.url,
              filename: a.filename,
              content_type: a.contentType,
            })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let genBlockOpened = false;

        // Find the next event-terminator. sse-starlette uses CRLF
        // (`\r\n\r\n`); other servers use LF (`\n\n`). Pick whichever
        // appears first.
        const findEventEnd = (
          buf: string,
        ): { idx: number; sepLen: number } => {
          const crlf = buf.indexOf("\r\n\r\n");
          const lf = buf.indexOf("\n\n");
          if (crlf !== -1 && (lf === -1 || crlf < lf)) {
            return { idx: crlf, sepLen: 4 };
          }
          if (lf !== -1) return { idx: lf, sepLen: 2 };
          return { idx: -1, sepLen: 0 };
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let next = findEventEnd(buffer);
          while (next.idx !== -1) {
            const block = buffer.slice(0, next.idx).replace(/\r\n/g, "\n");
            buffer = buffer.slice(next.idx + next.sepLen);
            const parsed = parseSseBlock(block);
            if (!parsed) {
              next = findEventEnd(buffer);
              continue;
            }
            const { event, data } = parsed;

            if (event === "started") {
              setThread((curr) => [
                ...curr,
                { kind: "started", id: uid("st"), ts: new Date().toISOString() },
              ]);
            } else if (event === "text_delta") {
              // Per-token streaming. The orchestrator tags every chunk with
              // nodeId=agentId; we either append a fresh live_stream message
              // (first chunk for this agent) or mutate the existing buffer.
              const targetNodeId = String(data.nodeId ?? "");
              const targetAgentId = String(data.agentId ?? targetNodeId);
              const chunk = String(data.chunk ?? "");
              if (!targetNodeId || !chunk) {
                next = findEventEnd(buffer);
                continue;
              }
              setThread((curr) => {
                // Find the most recent live_stream for this agent that's
                // still streaming. If none, append a new one.
                for (let i = curr.length - 1; i >= 0; i--) {
                  const m = curr[i];
                  if (
                    m.kind === "live_stream" &&
                    m.agentId === targetAgentId &&
                    m.isStreaming
                  ) {
                    const next = [...curr];
                    next[i] = {
                      ...m,
                      finalized: m.finalized + chunk,
                    };
                    return next;
                  }
                }
                return [
                  ...curr,
                  {
                    kind: "live_stream",
                    id: targetNodeId,
                    agentId: targetAgentId,
                    label: titleForNode(targetNodeId) ?? targetAgentId,
                    finalized: chunk,
                    isStreaming: true,
                  },
                ];
              });
            } else if (event === "text_done") {
              // Mark the matching live_stream as finished. The next
              // canonical event (thought / agent_step_complete) will
              // remove it from the thread.
              const targetAgentId = String(data.agentId ?? "");
              setThread((curr) => {
                for (let i = curr.length - 1; i >= 0; i--) {
                  const m = curr[i];
                  if (
                    m.kind === "live_stream" &&
                    m.agentId === targetAgentId &&
                    m.isStreaming
                  ) {
                    const next = [...curr];
                    next[i] = { ...m, isStreaming: false };
                    return next;
                  }
                }
                return curr;
              });
            } else if (event === "tool_use" && data.tool === "generate_image") {
              // The persona emitted an `<image .../>` sentinel; the backend
              // is calling FAL. Drop a "running" generation chip into the
              // thread; the `artifact` event that follows flips it to
              // "complete" and surfaces the image on the canvas.
              const toolUseId = data.toolUseId ?? uid("tu");
              const promptSummary = data.input?.prompt ?? "";
              const chip: GenerationChipData = {
                id: toolUseId,
                label: "Generating image",
                promptSummary: promptSummary.slice(0, 120),
                modelName: "fal-ai/flux/schnell",
                status: "running",
                elapsedSec: 0,
                etaSec: 12,
              };
              setThread((curr) => [
                ...curr,
                { kind: "generation", id: uid("gen"), chips: [chip] },
              ]);
            } else if (event === "thought") {
              const targetAgentId = data.agentId ?? "strategist";
              setThread((curr) => {
                // Drop any live_stream for this agent — the canonical
                // thought event supersedes the streaming buffer.
                const filtered = curr.filter(
                  (m) =>
                    !(m.kind === "live_stream" && m.agentId === targetAgentId),
                );
                return [
                  ...filtered,
                  {
                    kind: "thought",
                    id: uid("th"),
                    agentId: targetAgentId,
                    summary: data.summary ?? "",
                    fullText: data.fullText ?? "",
                    elapsedSec: Number(data.elapsedSec) || 0,
                    collapsed: true,
                  },
                ];
              });
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
                // Drop any live_stream for this agent — the canonical
                // agent_step_complete supersedes the streaming buffer.
                const filtered = curr.filter(
                  (m) =>
                    !(m.kind === "live_stream" && m.agentId === targetAgentId),
                );
                // Match the LAST agent_step block for this agentId that hasn't
                // been completed yet. Walking back-to-front avoids racing past
                // earlier blocks if the same agent runs twice in one campaign.
                let patched = false;
                const next = [...filtered];
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
                return patched ? next : filtered;
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
                // Seed selection for the shot the first time we see it so the
                // canvas renders the very first variant as selected without
                // waiting for the user to click anything.
                setSelectedVariantByShot((curr) =>
                  curr[shotId] ? curr : { ...curr, [shotId]: id },
                );

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
                    "Three style variants are on the canvas — pick one to lock or push further: swap colors, generate matching social crops, or animate the selected shot into a 6-second cut.",
                },
                { kind: "followups", id: uid("f"), items: DEFAULT_FOLLOWUPS },
              ]);
            } else if (event === "error") {
              toast.error(data.message ?? "Stream error");
            }
            next = findEventEnd(buffer);
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

  // Derive the chat header title from the first user message — falls back to a
  // generic placeholder when the thread is still empty. Trimmed to ~60 chars
  // and capitalised to match the visual weight of the header.
  const projectTitle = useMemo(() => {
    const firstUser = thread.find((m) => m.kind === "user");
    if (!firstUser || firstUser.kind !== "user") return "New conversation";
    const text = firstUser.text.trim();
    if (!text) return "New conversation";
    const truncated = text.length > 60 ? `${text.slice(0, 57)}…` : text;
    return truncated.charAt(0).toUpperCase() + truncated.slice(1);
  }, [thread]);

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
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[480px_1fr]">
      <ChatRail
        thread={thread}
        projectName={projectTitle}
        live={running}
        adapter={adapter}
        setAdapter={setAdapterAndUrl}
        onSubmit={handleSubmit}
        onSchedule={openSchedule}
        onChipFocus={handleChipFocus}
        onFollowup={handleFollowup}
        disabled={running}
        isRunning={running}
        onStop={() => {
          abortRef.current?.abort();
          setRunning(false);
        }}
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
  const variants = pickFallbackLabels(text);
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
      text: `Three style variants are on the canvas — ${variants[0]} is leading on hook density. Want me to lock it and generate matching social crops?`,
    },
    { kind: "followups", id: uid("f"), items: DEFAULT_FOLLOWUPS },
  ]);
}

/**
 * Pick three fallback variant labels from a tiny brief-keyword heuristic.
 * Used only when the backend is offline; production runs use the
 * art_director-emitted style_variants. Returns 3 distinct labels.
 */
function pickFallbackLabels(text: string): [string, string, string] {
  const lc = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => lc.includes(w));

  if (has("bag", "leather", "wallet", "tote", "purse", "luggage")) {
    return ["Matte Studio", "Golden Street", "Rain Glaze"];
  }
  if (has("food", "kettle", "espresso", "coffee", "snack", "drink", "kitchen")) {
    return ["Overhead Market", "Moody Candlelit", "Bright Kitchen"];
  }
  if (has("skin", "cream", "serum", "beauty", "cosmetic", "skincare")) {
    return ["Clean Flatlay", "Macro Dewdrop", "Soft Daylight"];
  }
  if (has("shoe", "sneaker", "boot", "trainer")) {
    return ["Studio Cyc", "Street Motion", "Court Lights"];
  }
  if (has("car", "auto", "vehicle", "ev")) {
    return ["Dawn Drive", "Studio Cyc", "Highway Blur"];
  }
  if (has("home", "furniture", "sofa", "decor", "interior")) {
    return ["Magazine Spread", "Morning Window", "Lifestyle Vignette"];
  }
  return ["Hero Shot", "Lifestyle", "Macro Detail"];
}
