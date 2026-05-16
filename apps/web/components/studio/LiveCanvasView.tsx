"use client";

import { useEffect, useMemo } from "react";
import type { Edge, Node } from "reactflow";
import { defaultDataFor, type NodeKind } from "@cie/canvas-nodes";
import { Canvas } from "../canvas/Canvas";

/**
 * A live "node update" event — what the studio page receives from the
 * SSE stream and forwards to the canvas via prop.
 *
 * `nodeId` is the orchestrator's internal id (e.g. "strategist") and
 * maps 1:1 to a NodeKind below via `KIND_FOR_NODE_ID`.
 */
export interface LiveNodeEvent {
  /** Orchestrator step id, e.g. "strategist". */
  nodeId: string;
  /** Lifecycle phase from the SSE stream. */
  phase: "start" | "complete";
  /** Optional artifact payload attached on `complete`. */
  artifact?: { url: string; kind: "image" | "video" };
}

interface LiveCanvasViewProps {
  events: LiveNodeEvent[];
  /** Active = at least one node is currently in `start` (un-matched) state. */
  active: boolean;
}

const KIND_FOR_NODE_ID: Record<string, NodeKind> = {
  strategist: "brief",
  creative_director: "audience",
  copywriter: "hook",
  art_director: "imageGen",
  analyst: "score",
  publisher: "schedule",
};

const POSITIONS: Record<string, { x: number; y: number }> = {
  strategist: { x: 0, y: 0 },
  creative_director: { x: 280, y: 0 },
  copywriter: { x: 280, y: 180 },
  art_director: { x: 560, y: 0 },
  analyst: { x: 840, y: 0 },
  publisher: { x: 1120, y: 0 },
};

const EDGES_PLAN: Array<[string, string]> = [
  ["strategist", "creative_director"],
  ["creative_director", "copywriter"],
  ["creative_director", "art_director"],
  ["art_director", "analyst"],
  ["analyst", "publisher"],
];

function buildGraph(events: LiveNodeEvent[]): {
  nodes: Node[];
  edges: Edge[];
} {
  // Most recent phase per nodeId.
  const phaseByNode = new Map<string, "start" | "complete">();
  const artifactByNode = new Map<string, { url: string; kind: "image" | "video" }>();
  for (const ev of events) {
    phaseByNode.set(ev.nodeId, ev.phase);
    if (ev.artifact) artifactByNode.set(ev.nodeId, ev.artifact);
  }

  const nodes: Node[] = Object.entries(KIND_FOR_NODE_ID)
    .filter(([nodeId]) => phaseByNode.has(nodeId))
    .map(([nodeId, kind]) => {
      const phase = phaseByNode.get(nodeId);
      const artifact = artifactByNode.get(nodeId);
      const baseData = defaultDataFor(kind) as Record<string, unknown>;
      const merged: Record<string, unknown> = {
        ...baseData,
        _runPhase: phase,
      };
      if (artifact) {
        if (kind === "imageGen" || kind === "videoGen") {
          merged.artifactUrl = artifact.url;
        }
      }
      return {
        id: nodeId,
        type: kind,
        position: POSITIONS[nodeId] ?? { x: 0, y: 0 },
        data: merged,
      };
    });

  const liveSet = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = EDGES_PLAN.filter(
    ([src, tgt]) => liveSet.has(src) && liveSet.has(tgt),
  ).map(([src, tgt]) => {
    const srcDone = phaseByNode.get(src) === "complete";
    const tgtStarted = phaseByNode.has(tgt);
    return {
      id: `${src}->${tgt}`,
      source: src,
      target: tgt,
      type: "custom",
      data: { active: srcDone && tgtStarted && phaseByNode.get(tgt) !== "complete" },
    };
  });

  return { nodes, edges };
}

/**
 * Embeds <Canvas/> driven by SSE events. We intentionally rebuild the
 * graph from the event stream every render — small N, and it keeps
 * the source of truth in one place. The Canvas has its own
 * localStorage persistence which we _intentionally_ flush on mount
 * so a fresh studio run doesn't merge into a stale graph.
 */
export function LiveCanvasView({ events, active }: LiveCanvasViewProps) {
  // Flush stale localStorage graph on first mount of a Studio run.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("cie-canvas-graph");
    } catch {
      /* ignore */
    }
  }, []);

  const { nodes, edges } = useMemo(() => buildGraph(events), [events]);

  return (
    <div
      className="hc-glass relative h-[520px] w-full overflow-hidden rounded-[var(--hc-radius-card)] border border-[color:var(--color-border)]"
      data-testid="cie-live-canvas"
    >
      <Canvas initialNodes={nodes} initialEdges={edges} />
      {active ? (
        <div className="hc-pill pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 border border-[color:var(--hc-accent-coral)] bg-[color:var(--hc-surface-glass-strong)] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--hc-accent-coral)]">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--hc-accent-coral)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--hc-accent-coral)]" />
          </span>
          Live
        </div>
      ) : null}
    </div>
  );
}
