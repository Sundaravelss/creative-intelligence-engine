"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  hookNodeSchema,
  nodeKindByName,
  type HookNodeData,
} from "@cie/canvas-nodes";
import { NodeShell } from "./NodeShell";

function HookNodeInner({ data, selected }: NodeProps<HookNodeData>) {
  const safe = hookNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  return (
    <NodeShell meta={nodeKindByName.hook} selected={selected}>
      <p className="hc-serif-headline text-[14px] leading-snug line-clamp-3">
        {d.text && d.text.length > 0 ? `"${d.text}"` : (
          <span className="text-[color:var(--color-muted-foreground)] italic not-italic-headline">
            Untitled hook
          </span>
        )}
      </p>
      {typeof d.score === "number" && (
        <div className="mt-1 inline-flex items-center gap-1.5">
          <span className="hc-pill text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[color:var(--hc-accent-coral-soft)] hc-accent-coral">
            {Math.round(d.score)}
          </span>
          <span className="text-[10px] text-[color:var(--color-muted-foreground)]">virality</span>
        </div>
      )}
    </NodeShell>
  );
}

export const HookNode = memo(HookNodeInner);
