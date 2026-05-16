"use client";

import { Asterisk } from "lucide-react";

interface StartedPillProps {
  ts?: string;
}

export function StartedPill(_props: StartedPillProps) {
  return (
    <div
      data-testid="cie-chat-started"
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
    >
      <Asterisk className="size-3.5 text-[oklch(0.66_0.18_25)]" />
      <span>
        <strong className="font-semibold text-foreground">Sage</strong> started
      </span>
    </div>
  );
}
