"use client";

import {
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenerationChipData } from "./types";

interface GenerationChipProps {
  data: GenerationChipData;
  onFocus?: (chip: GenerationChipData) => void;
}

export function GenerationChip({ data, onFocus }: GenerationChipProps) {
  const progress =
    data.status === "complete"
      ? 1
      : data.etaSec > 0
        ? Math.min(0.96, data.elapsedSec / data.etaSec)
        : 0.4;

  return (
    <button
      type="button"
      onClick={() => onFocus?.(data)}
      className="group flex w-full flex-col gap-1.5 rounded-xl border border-black/5 bg-white/70 px-3 py-2.5 text-left shadow-sm transition-all hover:border-black/10 hover:bg-white"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[oklch(0.66_0.18_25)]",
            data.status === "complete" && "bg-[oklch(0.94_0.06_145)] text-[oklch(0.4_0.18_145)]",
            data.status === "error" && "bg-[oklch(0.94_0.06_25)] text-[oklch(0.55_0.22_25)]",
            data.status === "running" && "bg-[oklch(0.96_0.04_25)]",
          )}
        >
          {data.status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : data.status === "complete" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.96_0.005_240)] px-2 py-0.5 text-[11px] font-medium text-foreground">
          <ImageIcon className="h-3 w-3" />
          {data.label}
        </span>
        <span className="flex-1 truncate text-[12.5px] text-muted-foreground">
          {data.promptSummary}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
      </div>
      <div className="flex items-center gap-2 pl-8 pr-1">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-[oklch(0.66_0.18_25)] transition-[width] duration-500 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      <p className="pl-8 text-[10.5px] tracking-wide text-muted-foreground">
        {data.status === "complete"
          ? `Generated with ${data.modelName} · ${data.elapsedSec.toFixed(0)}s`
          : `Generating image with ${data.modelName} · ${data.elapsedSec.toFixed(0)}s / ~${data.etaSec.toFixed(0)}s`}
      </p>
    </button>
  );
}
