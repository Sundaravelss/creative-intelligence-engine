"use client";

import { DragEvent } from "react";
import * as Lucide from "lucide-react";
import { nodeKinds, type NodeKindMeta } from "@cie/canvas-nodes";

export const NODE_DRAG_MIME = "application/cie-node";

interface NodePaletteProps {
  className?: string;
}

/**
 * Left-rail palette listing all 9 node kinds.
 * Each tile is a `draggable` div that sets a custom MIME type
 * containing the kind slug — Canvas reads this in onDrop.
 *
 * Editorial choice: items are tall pill-cards with a thin accent
 * vertical line on the left, not generic icon-grid squares. The line
 * is the only piece of colour per row; everything else is greyscale.
 * This is the differentiation anchor for the canvas surface.
 */
export function NodePalette({ className }: NodePaletteProps) {
  function onDragStart(e: DragEvent<HTMLDivElement>, meta: NodeKindMeta) {
    e.dataTransfer.setData(NODE_DRAG_MIME, meta.kind);
    e.dataTransfer.setData("text/plain", meta.kind);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside
      className={[
        "hc-glass border-r border-[color:var(--color-border)]",
        "h-full overflow-y-auto",
        "px-3 py-4",
        className ?? "",
      ].join(" ")}
      aria-label="Node palette"
    >
      <h2 className="hc-serif-headline text-lg font-semibold mb-1 px-1">Add a node</h2>
      <p className="text-[11px] text-[color:var(--color-muted-foreground)] mb-4 px-1">
        Drag onto the canvas.
      </p>

      <ul className="space-y-1.5" role="list">
        {nodeKinds.map((meta) => {
          const Icon =
            (Lucide as unknown as Record<string, Lucide.LucideIcon>)[meta.icon] ?? Lucide.Box;
          return (
            <li key={meta.kind}>
              <div
                draggable
                onDragStart={(e) => onDragStart(e, meta)}
                role="button"
                tabIndex={0}
                aria-label={`Drag ${meta.label} node onto canvas`}
                className={[
                  "group relative flex items-start gap-2.5 cursor-grab active:cursor-grabbing",
                  "rounded-lg border border-transparent",
                  "px-2.5 py-2",
                  "hover:bg-[color:var(--hc-surface-elevated)]",
                  "hover:border-[color:var(--color-border)]",
                  "transition-[background,border] duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hc-accent-coral)]",
                ].join(" ")}
              >
                <span
                  className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
                  style={{ background: "currentColor" }}
                  aria-hidden
                >
                  <span className={meta.accent}>&nbsp;</span>
                </span>
                <span
                  className={[
                    "shrink-0 inline-flex h-7 w-7 items-center justify-center",
                    "rounded-md bg-[color:var(--hc-surface-recessed)]",
                    meta.accent,
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="hc-display text-[13px] font-semibold">{meta.label}</div>
                  <div className="text-[11px] text-[color:var(--color-muted-foreground)] line-clamp-2">
                    {meta.description}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
