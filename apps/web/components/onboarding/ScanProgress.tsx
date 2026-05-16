"use client";

// Phase 3 — SSE consumer for POST /api/brand/scan.
//
// We use a manual fetch + ReadableStream reader (rather than EventSource) so we
// can POST a JSON body. The endpoint emits 4 phases in order:
//   fetching → parsing → extracting → complete
// On `phase=complete` it includes the synthesized BrandProfile in the payload.
// On `type=error` we surface an inline retry. Phase 5 of /onboarding consumes
// the profile via onComplete().

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "fetching" | "parsing" | "extracting" | "complete";

const PHASE_LABEL: Record<Phase, string> = {
  fetching: "Fetching",
  parsing: "Parsing",
  extracting: "Extracting",
  complete: "Complete",
};

const PHASE_ORDER: Phase[] = ["fetching", "parsing", "extracting", "complete"];

// Loose shape for the SSE payload — phase events plus an optional profile on
// the terminal `complete` event. We keep it permissive on purpose: the brand
// router occasionally adds meta keys that we don't care about here.
export interface BrandProfileLite {
  id?: string;
  name?: string;
  logoUrl?: string | null;
  tagline?: string;
  palette?: string[];
  voice?: string;
  products?: { id: string; name: string; sku?: string }[];
  sourceUrl?: string;
  // Tavily occasionally returns reference image URLs; we surface them in the
  // confirm card if present.
  referenceImages?: string[];
}

interface ScanProgressProps {
  url: string;
  onComplete: (profile: BrandProfileLite) => void;
  onError?: (msg: string) => void;
  /** Hard timeout — after this we surrender and emit a fallback profile. */
  timeoutMs?: number;
}

export function ScanProgress({
  url,
  onComplete,
  onError,
  timeoutMs = 30_000,
}: ScanProgressProps) {
  const [active, setActive] = useState<Phase>("fetching");
  const [done, setDone] = useState<Set<Phase>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, timeoutMs);

    const run = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/brand/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Scan failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const completed = new Set<Phase>();

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buf += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const dataLine = chunk
              .split("\n")
              .find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;
            try {
              const ev = JSON.parse(json) as
                | { type: "phase"; phase: Phase; profile?: BrandProfileLite }
                | { type: "error"; code: string };
              if (ev.type === "error") {
                throw new Error(ev.code || "scan_error");
              }
              if (ev.type === "phase") {
                if (ev.phase !== "complete") {
                  setActive(ev.phase);
                  // mark all phases up to (but not including) this one as done
                  const idx = PHASE_ORDER.indexOf(ev.phase);
                  for (let i = 0; i < idx; i++) {
                    completed.add(PHASE_ORDER[i]!);
                  }
                  setDone(new Set(completed));
                } else {
                  // complete — mark everything done and bubble up
                  for (const p of PHASE_ORDER) completed.add(p);
                  setDone(new Set(completed));
                  setActive("complete");
                  clearTimeout(timer);
                  if (ev.profile) {
                    onComplete({ ...ev.profile, sourceUrl: url });
                  } else {
                    onComplete({ sourceUrl: url });
                  }
                  return;
                }
              }
            } catch (err) {
              if (err instanceof Error && err.message === "scan_error") {
                throw err;
              }
              // ignore malformed lines
            }
          }
        }
      } catch (err: unknown) {
        if (timedOut) {
          // Per plan R4: surrender to defaults with a toast-style note.
          onComplete({ sourceUrl: url });
          return;
        }
        if ((err as { name?: string })?.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Couldn't reach the site.";
        setError(msg);
        onError?.(msg);
      } finally {
        clearTimeout(timer);
      }
    };

    void run();

    return () => {
      ac.abort();
      clearTimeout(timer);
    };
    // retryToken triggers a re-run when the user clicks Retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, retryToken]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-800 backdrop-blur-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t reach {url}</p>
            <p className="mt-1 text-red-700/80">{error}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setDone(new Set());
              setActive("fetching");
              setRetryToken((n) => n + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2 rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-md">
      {PHASE_ORDER.map((phase) => {
        const isDone = done.has(phase) && active !== phase;
        const isActive = active === phase && !isDone;
        return (
          <li
            key={phase}
            className="flex items-center gap-3 text-sm text-foreground"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-colors",
                isDone &&
                  "bg-[var(--hc-accent-coral-soft)] text-[var(--hc-accent-coral)]",
                isActive &&
                  "ring-2 ring-[var(--hc-accent-coral)] ring-offset-2 ring-offset-white",
                !isDone && !isActive && "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : isActive ? (
                <Loader2 className="size-3.5 animate-spin text-[var(--hc-accent-coral)]" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              )}
            </span>
            <span
              className={cn(
                isActive && "font-medium",
                !isActive && !isDone && "text-muted-foreground",
              )}
            >
              {PHASE_LABEL[phase]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
