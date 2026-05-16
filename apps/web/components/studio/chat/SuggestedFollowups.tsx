"use client";

import { ArrowRight } from "lucide-react";
import type { SuggestedFollowupItem } from "./types";

interface SuggestedFollowupsProps {
  items: SuggestedFollowupItem[];
  onSelect: (item: SuggestedFollowupItem) => void;
}

export function SuggestedFollowups({ items, onSelect }: SuggestedFollowupsProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-black/5 pt-3">
      <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Suggested follow-ups
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item)}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-black/[0.04]"
          >
            <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[oklch(0.66_0.18_25)]" />
            <span className="flex-1 truncate">{item.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
          </button>
        );
      })}
    </div>
  );
}
