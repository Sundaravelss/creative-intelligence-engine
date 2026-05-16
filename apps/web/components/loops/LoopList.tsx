"use client";

import { useState } from "react";
import { Play, Trash2, Clock } from "lucide-react";

import type { Loop } from "./types";

interface LoopListProps {
  loops: Loop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRunNow: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function LoopList({ loops, selectedId, onSelect, onRunNow, onDelete }: LoopListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loops.length === 0) {
    return (
      <div className="hc-card text-muted-foreground p-5 text-sm">
        No loops yet. Create one above to schedule recurring publishes.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {loops.map((loop) => {
        const active = loop.id === selectedId;
        return (
          <div
            key={loop.id}
            className={`hc-card flex items-center justify-between gap-3 p-4 transition ${
              active ? "ring-ring ring-2" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(loop.id)}
              className="flex flex-1 flex-col items-start text-left"
            >
              <div className="font-medium">{loop.name}</div>
              <div className="text-muted-foreground text-xs">
                <Clock className="mr-1 inline h-3 w-3" />
                <span className="font-mono">{loop.cron}</span>
                <span className="mx-2">·</span>
                <span>{loop.channel}</span>
                <span className="mx-2">·</span>
                <span>{loop.format}</span>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Run now"
                disabled={busyId === loop.id}
                onClick={async () => {
                  setBusyId(loop.id);
                  try {
                    await onRunNow(loop.id);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="rounded-md p-2 hover:bg-muted disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Delete loop"
                disabled={busyId === loop.id}
                onClick={async () => {
                  setBusyId(loop.id);
                  try {
                    await onDelete(loop.id);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="text-destructive rounded-md p-2 hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
