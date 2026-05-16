"use client";

import { useState } from "react";
import { ChevronDown, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  text: string;
  title?: string;
  defaultCollapsed?: boolean;
}

export function ReasoningBlock({
  text,
  title = "Reasoning…",
  defaultCollapsed = false,
}: ReasoningBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-black/5 bg-[oklch(0.96_0.005_240)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[oklch(0.94_0.005_240)]",
        )}
        aria-expanded={!collapsed}
      >
        <Square className="h-2.5 w-2.5 fill-current" />
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            collapsed ? "-rotate-90" : "",
          )}
        />
      </button>
      {!collapsed ? (
        <p className="whitespace-pre-wrap pl-1 text-[13px] italic leading-relaxed text-muted-foreground">
          {text}
        </p>
      ) : null}
    </div>
  );
}
