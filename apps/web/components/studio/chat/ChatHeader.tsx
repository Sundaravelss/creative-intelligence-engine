"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  projectName: string;
  live: boolean;
  modelLabel: string;
}

export function ChatHeader({ projectName, live, modelLabel }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-black/5 bg-background/85 px-4 backdrop-blur-md">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-medium text-foreground transition-colors hover:text-[oklch(0.66_0.18_25)]"
      >
        <span className="truncate">{projectName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      <span className="flex-1" />
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            live
              ? "bg-[oklch(0.66_0.18_25)] animate-pulse"
              : "bg-[oklch(0.7_0.02_240)]",
          )}
        />
        {live ? "Live" : "Idle"}
      </span>
      <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-foreground">
        {modelLabel}
      </span>
    </header>
  );
}
