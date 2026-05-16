"use client";

import { BaseEdge, EdgeProps, getBezierPath } from "reactflow";

/**
 * Animated bezier edge.
 *
 * - Static state: thin frosted line.
 * - `data.active === true`: pulsing accent line driven by a CSS dasharray
 *   animation (no JS rAF loop). The animation auto-respects the
 *   `prefers-reduced-motion` media query in globals.css.
 *
 * Design intent: edges in CIE represent live agent runs, so the
 * active state must read as "data is moving" without screaming for
 * attention. We use coral (--hc-accent-coral) — the system's only
 * "alive" colour — and reserve it for this and ScoreChip overlays.
 */
interface CustomEdgeData {
  active?: boolean;
}

export function CustomEdge(props: EdgeProps<CustomEdgeData>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const active = data?.active === true;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: active ? "var(--hc-accent-coral)" : "var(--color-border)",
          strokeWidth: active ? 2 : 1.25,
          strokeDasharray: active ? "6 6" : undefined,
          animation: active ? "cie-edge-flow 1.2s linear infinite" : undefined,
          opacity: active ? 1 : 0.7,
        }}
      />
      <style jsx>{`
        @keyframes cie-edge-flow {
          to {
            stroke-dashoffset: -24;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.react-flow__edge path) {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
