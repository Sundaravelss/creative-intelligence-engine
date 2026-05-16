"use client";

import { useCallback, useRef, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { toast } from "sonner";
import type { Artifact as UiArtifact } from "@cie/ui-artifacts";

import { AGENTS } from "@/components/agents/AgentRoster";
import { ChatRail } from "@/components/studio/chat/ChatRail";
import type {
  ChatMessage,
  GenerationChipData,
} from "@/components/studio/chat/types";
import { LiquidCanvas } from "@/components/studio/canvas/LiquidCanvas";
import type { CanvasViewMode } from "@/components/studio/canvas/ViewModeToggle";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8100";

interface SsePayload {
  type?: string;
  agentId?: string;
  agentName?: string;
  nodeId?: string;
  chunk?: string;
  fullText?: string;
  tool?: string;
  toolUseId?: string;
  input?: { prompt?: string; aspect?: string };
  artifact?: {
    id?: string;
    url?: string;
    kind?: "image" | "video" | "document" | "code";
    name?: string;
    meta?: Record<string, unknown>;
  };
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

interface ParsedBlock {
  event: string;
  data: SsePayload;
}

function parseSseBlock(block: string): ParsedBlock | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as SsePayload };
  } catch {
    return null;
  }
}

export default function AgentChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) {
    notFound();
  }

  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<UiArtifact[]>([]);
  const [running, setRunning] = useState(false);
  const [adapter, setAdapter] = useState("claude_code");
  const [viewMode, setViewMode] = useState<CanvasViewMode>("carousel");
  const [focusId, setFocusId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (running) {
        toast.error("A reply is still streaming. Wait for it to finish.");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        kind: "user",
        id: uid("u"),
        text,
        timestamp: nowTs(),
      };
      setThread((curr) => [...curr, userMsg]);
      setRunning(true);

      try {
        const res = await fetch(`${API_BASE}/api/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            agent_id: agentId,
            adapter,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // sse-starlette uses CRLF (`\r\n\r\n`); other servers use LF.
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
            next = findEventEnd(buffer);
            if (!parsed) continue;
            const { event, data } = parsed;

            if (event === "started") {
              setThread((curr) => [
                ...curr,
                { kind: "started", id: uid("st"), ts: new Date().toISOString() },
              ]);
            } else if (event === "text_delta") {
              const targetAgentId = String(data.agentId ?? agentId);
              const chunk = String(data.chunk ?? "");
              if (!chunk) continue;
              setThread((curr) => {
                for (let i = curr.length - 1; i >= 0; i--) {
                  const m = curr[i];
                  if (
                    m.kind === "live_stream" &&
                    m.agentId === targetAgentId &&
                    m.isStreaming
                  ) {
                    const next = [...curr];
                    next[i] = { ...m, finalized: m.finalized + chunk };
                    return next;
                  }
                }
                return [
                  ...curr,
                  {
                    kind: "live_stream",
                    id: targetAgentId,
                    agentId: targetAgentId,
                    label: agent!.name,
                    finalized: chunk,
                    isStreaming: true,
                  },
                ];
              });
            } else if (event === "text_done") {
              const targetAgentId = String(data.agentId ?? agentId);
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
            } else if (
              event === "tool_use" &&
              data.tool === "generate_image"
            ) {
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
            } else if (event === "artifact" && data.artifact) {
              const a = data.artifact;
              const id = a.id ?? uid("a");
              const url = a.url ?? "";
              const kind = a.kind ?? "image";
              if ((kind === "image" || kind === "video") && url) {
                const artifact: UiArtifact = {
                  id,
                  type: kind,
                  url,
                  name: a.name ?? "Generated image",
                  source: agent!.role,
                } as UiArtifact;
                (artifact as unknown as { meta: Record<string, unknown> }).meta = {
                  ...(a.meta ?? {}),
                };
                setArtifacts((curr) => [...curr, artifact]);
                if (focusId === null) setFocusId(id);
              }
            } else if (event === "done") {
              setRunning(false);
            } else if (event === "error") {
              setRunning(false);
              toast.error("Reply failed");
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          toast.error("Chat error");
        }
      } finally {
        setRunning(false);
      }
    },
    [adapter, agent, agentId, focusId, running],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[480px_1fr]">
      <ChatRail
        thread={thread}
        projectName={`${agent!.name} · ${agent!.role}`}
        live={running}
        modelLabel={agent!.name}
        adapter={adapter}
        setAdapter={setAdapter}
        onSubmit={handleSubmit}
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
        selectedVariantByShot={{}}
        onSelectVariant={() => undefined}
      />
    </div>
  );
}
