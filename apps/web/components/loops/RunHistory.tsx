"use client";

import type { LoopRun } from "./types";

interface RunHistoryProps {
  runs: LoopRun[];
  loading: boolean;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RunHistory({ runs, loading }: RunHistoryProps) {
  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading runs…</div>;
  }
  if (runs.length === 0) {
    return (
      <div className="hc-card text-muted-foreground p-5 text-sm">
        No runs yet. Click the play icon on a loop to trigger one now.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {runs
        .slice()
        .reverse()
        .map((run) => (
          <div key={run.post_id} className="hc-card flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">{run.post_id}</span>
              <span className="text-muted-foreground">{formatTime(run.posted_at)}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{run.channel}</span>
              {run.copy ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-muted-foreground line-clamp-2">{run.copy}</span>
                </>
              ) : null}
            </div>
            {run.insights && Object.keys(run.insights).length > 0 ? (
              <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                {Object.entries(run.insights).map(([k, v]) => (
                  <span key={k} className="hc-pill bg-muted px-2 py-0.5">
                    <span className="font-medium">{k}</span>: {String(v)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
    </div>
  );
}
