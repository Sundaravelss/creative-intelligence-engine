"use client";

import { ReactNode } from "react";
import { Handle, Position } from "reactflow";
import * as Lucide from "lucide-react";
import type { NodeKindMeta } from "@cie/canvas-nodes";

interface NodeShellProps {
  meta: NodeKindMeta;
  children?: ReactNode;
  /** When false, hides the input handle (e.g. BriefNode). */
  showSource?: boolean;
  /** When false, hides the output handle (e.g. ScoreNode, ScheduleNode). */
  showTarget?: boolean;
  selected?: boolean;
}

/**
 * Shared visual shell for every node kind. Renders:
 *  - A frosted-glass "card" using the hc-glass + hc-card utility classes.
 *  - Header strip: icon (lucide), label, faint kind tag.
 *  - Body slot for kind-specific fields.
 *  - 1 input handle (left) + 1 output handle (right) by default.
 *
 * Design anchor: every node is a small "boarding pass" — narrow body,
 * tight rhythm, single accent dot per kind. This keeps a 20-node graph
 * readable and avoids the generic React-Flow look.
 */
export function NodeShell({
  meta,
  children,
  showSource = true,
  showTarget = true,
  selected,
}: NodeShellProps) {
  const Icon = (Lucide as unknown as Record<string, Lucide.LucideIcon>)[meta.icon] ?? Lucide.Box;

  return (
    <div
      className={[
        "hc-glass hc-card",
        "min-w-[220px] max-w-[260px]",
        "border border-[color:var(--color-border)]",
        "rounded-[var(--hc-radius-card)]",
        "overflow-hidden",
        "text-[13px] leading-tight",
        selected ? "ring-2 ring-[color:var(--hc-accent-coral)]" : "",
      ].join(" ")}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: "var(--color-background)",
            borderColor: "var(--hc-accent-coral)",
            width: 10,
            height: 10,
          }}
        />
      )}

      <header className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--color-border)]">
        <span
          className={[
            "inline-flex h-6 w-6 items-center justify-center",
            "rounded-md bg-[color:var(--hc-surface-recessed)]",
            meta.accent,
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="hc-display font-semibold text-[13px] truncate">{meta.label}</div>
        </div>
        <span className="hc-pill px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[color:var(--color-muted-foreground)] bg-[color:var(--hc-surface-recessed)]">
          {meta.kind}
        </span>
      </header>

      {children && <div className="px-3 py-2 space-y-1.5">{children}</div>}

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: "var(--hc-accent-coral)",
            borderColor: "var(--color-background)",
            width: 10,
            height: 10,
          }}
        />
      )}
    </div>
  );
}

/**
 * Compact label/value pair used inside node bodies.
 * Truncates value to keep cards visually consistent.
 */
export function NodeField({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted-foreground)] shrink-0 w-16">
        {label}
      </span>
      <span className="text-[12px] truncate">
        {value === undefined || value === "" ? (
          <span className="text-[color:var(--color-muted-foreground)] italic">empty</span>
        ) : (
          String(value)
        )}
      </span>
    </div>
  );
}
