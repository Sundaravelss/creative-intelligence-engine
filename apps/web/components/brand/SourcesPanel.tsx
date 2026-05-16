"use client";

import { useState } from "react";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";

import { API_BASE_URL, ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

import type { ExtendedBrandProfile } from "./types";

type Phase =
  | "idle"
  | "fetching"
  | "parsing"
  | "extracting"
  | "complete"
  | "error";

interface SourcesPanelProps {
  onScanComplete: (brand: ExtendedBrandProfile) => void;
  initialUrl?: string;
}

const PHASE_TEXT: Record<Exclude<Phase, "idle" | "complete" | "error">, (url: string) => string> = {
  fetching: (url) => `Fetching ${url}…`,
  parsing: () => "Parsing site structure…",
  extracting: () => "Extracting brand voice + palette…",
};

interface ScanPhaseEvent {
  type?: string;
  phase?: string;
  url?: string;
  code?: string;
  message?: string;
  profile?: ExtendedBrandProfile;
}

function isPhase(value: string | undefined): value is Phase {
  return (
    value === "fetching" ||
    value === "parsing" ||
    value === "extracting" ||
    value === "complete" ||
    value === "error"
  );
}

async function runFakeProgress(
  setPhase: (p: Phase) => void,
  url: string,
): Promise<void> {
  setPhase("fetching");
  await new Promise<void>((r) => setTimeout(r, 800));
  setPhase("parsing");
  await new Promise<void>((r) => setTimeout(r, 800));
  setPhase("extracting");
  await new Promise<void>((r) => setTimeout(r, 800));
  // Caller will fetch /api/brand and emit complete.
  void url;
}

async function streamScan(
  url: string,
  onEvent: (e: ScanPhaseEvent) => void,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${API_BASE_URL}/api/brand/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ url }),
    signal,
  });
  if (!res.ok) return { ok: false, status: res.status };
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, status: 500 };
  const decoder = new TextDecoder();
  let buffer = "";
  // SSE parse loop. Frames end with double newline; data lines start with "data: ".
  // We accept both bare-JSON-per-line streams and full SSE — be lenient.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n")
        .trim();
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine) as ScanPhaseEvent;
        onEvent(parsed);
      } catch {
        // Ignore non-JSON lines (e.g. event:, id:).
      }
    }
  }
  return { ok: true, status: res.status };
}

export function SourcesPanel({ onScanComplete, initialUrl }: SourcesPanelProps) {
  const [url, setUrl] = useState<string>(initialUrl ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const running =
    phase === "fetching" || phase === "parsing" || phase === "extracting";

  const handleScan = async (): Promise<void> => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    setPhase("fetching");
    const controller = new AbortController();

    try {
      const { ok, status } = await streamScan(
        trimmed,
        (event) => {
          if (event.type === "error" || event.phase === "error") {
            setErrorMessage(event.message ?? `Scan failed (${event.code ?? "unknown"})`);
            setPhase("error");
            controller.abort();
            return;
          }
          if (event.phase && isPhase(event.phase)) {
            setPhase(event.phase);
          }
        },
        controller.signal,
      );

      if (!ok) {
        if (status === 404) {
          // Endpoint not yet shipped (V4 in flight): fall back to fake progress.
          await runFakeProgress(setPhase, trimmed);
          const fetched = await api.get<ExtendedBrandProfile>("/api/brand");
          setPhase("complete");
          onScanComplete(fetched);
          return;
        }
        throw new Error(`Scan endpoint returned ${status}`);
      }

      // Stream finished: fetch the canonical brand record V4 wrote.
      const fetched = await api.get<ExtendedBrandProfile>("/api/brand");
      setPhase("complete");
      onScanComplete(fetched);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        // No brand persisted yet — surface a useful error.
        setErrorMessage("Scan finished but no brand profile was returned.");
        setPhase("error");
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(message);
      setPhase("error");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !running) {
      e.preventDefault();
      void handleScan();
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Brand scan
        </span>
        <h2 className="text-3xl font-semibold tracking-tight">Add your Brand</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Paste a website URL — we'll extract the logo, palette, voice, and product
          catalog into a unified brand memory.
        </p>
      </div>

      <div className="w-full">
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-sm transition-all",
            running &&
              "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-purple-300/30 before:via-pink-200/20 before:to-orange-200/30 before:opacity-100",
          )}
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={running}
            placeholder="https://www.allbirds.com"
            aria-label="Brand website URL"
            className="relative z-10 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={running || url.trim().length === 0}
            className={cn(
              "relative z-10 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all",
              "hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating
              </>
            ) : (
              "Scan"
            )}
          </button>
        </div>

        <div className="mt-3 min-h-[1.5rem] text-center text-sm">
          {phase === "idle" && (
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => {
                // Empty fallback — emit an empty profile so other tabs unlock for manual editing.
                onScanComplete({
                  id: "manual",
                  name: "",
                  palette: ["#0F172A", "#F97316", "#FBBF24", "#FFFFFF"],
                  products: [],
                });
              }}
            >
              Don't have a website? Create manually
            </button>
          )}

          {(phase === "fetching" || phase === "parsing" || phase === "extracting") && (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {PHASE_TEXT[phase](url.trim())}
            </span>
          )}

          {phase === "complete" && (
            <span className="text-emerald-600">Complete!</span>
          )}

          {phase === "error" && (
            <span className="inline-flex items-center gap-2 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMessage ?? "Scan failed"}
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setErrorMessage(null);
                }}
                className="ml-1 rounded-full border border-destructive/40 px-2 py-0.5 text-xs hover:bg-destructive/10"
              >
                Retry
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SourcesPanel;
