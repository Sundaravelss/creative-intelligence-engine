"use client";

import { useState } from "react";
import { Asterisk, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThoughtPillProps {
  summary: string;
  fullText: string;
  elapsedSec: number;
  defaultExpanded?: boolean;
}

const SUMMARY_TRUNCATE = 60;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function ThoughtPill({
  summary,
  fullText,
  elapsedSec,
  defaultExpanded = false,
}: ThoughtPillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const elapsedLabel = `${Math.max(0, Math.round(elapsedSec))}s`;
  const summaryTrimmed = summary.trim();
  const showSummary = summaryTrimmed.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="cie-chat-thought"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-[oklch(0.94_0.005_240)]"
      >
        <Asterisk className="size-3.5 text-[oklch(0.66_0.18_25)]" />
        <span className="flex items-center gap-1">
          <strong className="font-semibold text-foreground">Sage</strong>
          <span>thought for {elapsedLabel}</span>
          {showSummary ? (
            <span className="text-muted-foreground">
              · {truncate(summaryTrimmed, SUMMARY_TRUNCATE)}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            expanded ? "rotate-180" : "",
          )}
        />
      </button>
      {expanded ? (
        <div className="ml-1 rounded-lg border border-black/5 bg-background p-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {fullText.trim().length > 0 ? fullText : "(no reasoning text)"}
        </div>
      ) : null}
    </div>
  );
}
