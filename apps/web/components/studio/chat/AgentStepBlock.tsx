"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Plug, X } from "lucide-react";
import { avatarFor, type AgentId } from "@/lib/agentAvatars";
import type { AgentStepSubstep } from "./types";
import { cn } from "@/lib/utils";

interface AgentStepBlockProps {
  agentId: AgentId | string;
  label: string;
  completed: number;
  total: number;
  substeps: AgentStepSubstep[];
  defaultExpanded?: boolean;
}

function StatusIcon({ status }: { status: AgentStepSubstep["status"] }) {
  if (status === "joined") {
    return <Plug className="size-3 text-[oklch(0.55_0.15_240)]" />;
  }
  if (status === "done") {
    return <Check className="size-3 text-[oklch(0.55_0.18_145)]" />;
  }
  return <X className="size-3 text-[oklch(0.55_0.22_25)]" />;
}

export function AgentStepBlock({
  agentId,
  label,
  completed,
  total,
  substeps,
  defaultExpanded = false,
}: AgentStepBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const avatar = avatarFor(agentId);
  const safeTotal = total > 0 ? total : 1;

  return (
    <div
      data-testid="cie-chat-agent-step"
      data-agent-id={agentId}
      className="overflow-hidden rounded-xl border border-black/5 bg-background shadow-[0_1px_2px_oklch(0.14_0_0_/_0.04)]"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <Image
          src={avatar.src}
          alt={avatar.label}
          width={24}
          height={24}
          className="size-6 rounded-full object-cover"
        />
        <span className="text-sm font-medium text-foreground">
          {avatar.label}
        </span>
        <span className="text-sm text-muted-foreground">
          {label} · {completed} of {safeTotal} done
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 text-muted-foreground transition-transform",
            expanded ? "rotate-180" : "",
          )}
        />
      </button>
      {expanded && substeps.length > 0 ? (
        <ul className="space-y-1 border-t border-black/5 bg-muted/30 px-4 py-2">
          {substeps.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <StatusIcon status={s.status} />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
