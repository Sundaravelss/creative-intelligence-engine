"use client";

import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  defaultDataFor,
  type NodeKind,
  nodeKindByName,
} from "@cie/canvas-nodes";

import { NODE_DRAG_MIME } from "./NodePalette";
import { CustomEdge } from "./edges/CustomEdge";
import { BriefNode } from "./nodes/BriefNode";
import { AudienceNode } from "./nodes/AudienceNode";
import { HookNode } from "./nodes/HookNode";
import { ImageGenNode } from "./nodes/ImageGenNode";
import { VideoGenNode } from "./nodes/VideoGenNode";
import { VariantNode } from "./nodes/VariantNode";
import { ScoreNode } from "./nodes/ScoreNode";
import { ScheduleNode } from "./nodes/ScheduleNode";
import { AdReferenceNode } from "./nodes/AdReferenceNode";

const STORAGE_KEY = "cie-canvas-graph";

/** Persisted graph shape. We store the bare minimum React Flow needs to rehydrate. */
interface PersistedGraph {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

const nodeTypes: NodeTypes = {
  brief: BriefNode,
  audience: AudienceNode,
  hook: HookNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
  variant: VariantNode,
  score: ScoreNode,
  schedule: ScheduleNode,
  adReference: AdReferenceNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

const defaultEdgeOptions = {
  type: "custom",
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-border)" },
};

function loadFromStorage(): PersistedGraph | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "nodes" in parsed &&
      "edges" in parsed &&
      Array.isArray((parsed as PersistedGraph).nodes) &&
      Array.isArray((parsed as PersistedGraph).edges)
    ) {
      return parsed as PersistedGraph;
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(graph: PersistedGraph) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch {
    // Quota / private mode — ignore silently; persistence is best-effort.
  }
}

function CanvasInner({
  initialNodes,
  initialEdges,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
}: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Hydration: prefer localStorage, fall back to initial props, fall back to empty.
  const [nodes, setNodes] = useState<Node[]>(() => {
    const persisted = loadFromStorage();
    if (persisted) return persisted.nodes;
    return initialNodes ?? [];
  });
  const [edges, setEdges] = useState<Edge[]>(() => {
    const persisted = loadFromStorage();
    if (persisted) return persisted.edges;
    return initialEdges ?? [];
  });

  // Persist on every change. Cheap — graphs are small.
  useEffect(() => {
    saveToStorage({ nodes, edges });
    onNodesChangeProp?.(nodes);
  }, [nodes, edges, onNodesChangeProp]);
  useEffect(() => {
    onEdgesChangeProp?.(edges);
  }, [edges, onEdgesChangeProp]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((curr) => applyNodeChanges(changes, curr)),
    [],
  );
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((curr) => applyEdgeChanges(changes, curr)),
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((curr) =>
        addEdge(
          { ...connection, type: "custom", data: { active: false } },
          curr,
        ),
      ),
    [],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kindRaw = event.dataTransfer.getData(NODE_DRAG_MIME);
      if (!kindRaw) return;
      if (!(kindRaw in nodeKindByName)) return;
      const kind = kindRaw as NodeKind;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
      const newNode: Node = {
        id,
        type: kind,
        position,
        data: defaultDataFor(kind),
      };
      setNodes((curr) => curr.concat(newNode));
    },
    [screenToFlowPosition],
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
  }, []);

  const minimapStyle = useMemo(
    () => ({
      background: "var(--hc-surface-recessed)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
    }),
    [],
  );

  // Suppress unused-variable warning while keeping the instance available for
  // future imperative actions (fitView on demand, exporting, etc).
  void rfInstance;

  return (
    <div ref={wrapperRef} className="h-full w-full" data-testid="cie-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="var(--color-border)" />
        <MiniMap
          pannable
          zoomable
          style={minimapStyle}
          nodeColor={(n) =>
            n.type && n.type in nodeKindByName
              ? "var(--hc-accent-coral)"
              : "var(--color-muted-foreground)"
          }
          maskColor="oklch(0.14 0 0 / 0.06)"
        />
        <Controls
          showInteractive={false}
          className="!bg-[color:var(--hc-surface-elevated)] !border !border-[color:var(--color-border)] !rounded-lg overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
