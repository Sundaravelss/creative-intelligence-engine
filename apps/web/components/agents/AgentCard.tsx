"use client";

import type { LucideIcon } from "lucide-react";

export interface AgentDescriptor {
  id: string;
  name: string;
  role: string;
  tagline: string;
  icon: LucideIcon;
  /** Tailwind colour class for the icon — picks from a constrained palette. */
  accent: string;
  adapter: "pioneer" | "openai" | "claude_code" | "hermes";
}

interface AgentCardProps {
  agent: AgentDescriptor;
}

const ADAPTER_LABEL: Record<AgentDescriptor["adapter"], string> = {
  pioneer: "Pioneer",
  openai: "OpenAI",
  claude_code: "Claude Code",
  hermes: "Hermes",
};

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = agent.icon;
  return (
    <article
      className="hc-glass hc-card group relative flex flex-col gap-3 overflow-hidden border border-[color:var(--color-border)] p-5"
      data-testid="cie-agent-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--hc-accent-coral) 50%, transparent 100%)",
          opacity: 0.5,
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "hc-pill inline-flex h-12 w-12 items-center justify-center border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] transition-transform group-hover:scale-105",
            agent.accent,
          ].join(" ")}
          aria-hidden
        >
          <Icon size={20} />
        </div>
        <span
          className="hc-pill border border-[color:var(--color-border)] bg-[color:var(--hc-surface-recessed)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          title={`Adapter backend: ${ADAPTER_LABEL[agent.adapter]}`}
        >
          {ADAPTER_LABEL[agent.adapter]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {agent.role}
        </span>
        <h3 className="hc-serif-headline text-xl font-semibold leading-tight">
          {agent.name}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {agent.tagline}
      </p>
    </article>
  );
}
