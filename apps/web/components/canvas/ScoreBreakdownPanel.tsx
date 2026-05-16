"use client";

/**
 * ScoreBreakdownPanel — radar/spider chart of the 5-axis breakdown returned
 * by /api/score. Pure SVG, no chart libraries (constraint from WS-F plan).
 *
 * Click handler on ScoreChip toggles this panel. Closing is the parent's job;
 * we just render and call onClose.
 */

import { X } from "lucide-react";
import { useMemo } from "react";
import type { ScoreResult } from "@cie/shared-types";

export interface ScoreBreakdownPanelProps {
  result: ScoreResult;
  onClose: () => void;
}

interface Axis {
  key: keyof ScoreResult["breakdown"];
  label: string;
}

const AXES: readonly Axis[] = [
  { key: "aspect", label: "Aspect" },
  { key: "motion", label: "Motion" },
  { key: "hookDensity", label: "Hook density" },
  { key: "contrast", label: "Contrast" },
  { key: "novelty", label: "Novelty" },
];

const SVG_SIZE = 220;
const CENTER = SVG_SIZE / 2;
const RADIUS = 80;
const RING_STEPS = 4; // gridlines at 0.25, 0.5, 0.75, 1.0

interface Point {
  x: number;
  y: number;
}

function axisAngle(index: number, total: number): number {
  // -90deg to put first axis at the top, then clockwise
  return (-Math.PI / 2) + (index * 2 * Math.PI) / total;
}

function pointOnAxis(index: number, total: number, value: number): Point {
  const angle = axisAngle(index, total);
  const r = RADIUS * Math.max(0, Math.min(1, value));
  return {
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  };
}

function pointOnRing(index: number, total: number, ratio: number): Point {
  return pointOnAxis(index, total, ratio);
}

function clampValue(v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function ScoreBreakdownPanel({ result, onClose }: ScoreBreakdownPanelProps) {
  const total = AXES.length;

  const polygonPoints = useMemo(() => {
    return AXES
      .map((axis, i) => {
        const v = clampValue(result.breakdown[axis.key]);
        const p = pointOnAxis(i, total, v);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");
  }, [result, total]);

  const gridPolygons = useMemo(() => {
    return Array.from({ length: RING_STEPS }, (_, ringIdx) => {
      const ratio = (ringIdx + 1) / RING_STEPS;
      const pts = AXES
        .map((_, i) => {
          const p = pointOnRing(i, total, ratio);
          return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
        })
        .join(" ");
      return { ratio, pts };
    });
  }, [total]);

  const axisLines = useMemo(() => {
    return AXES.map((axis, i) => {
      const end = pointOnAxis(i, total, 1);
      const labelPos = pointOnAxis(i, total, 1.22);
      return { axis, end, labelPos };
    });
  }, [total]);

  return (
    <div
      className="hc-glass fixed right-4 top-20 z-50 w-[280px] rounded-xl p-4 shadow-xl"
      role="dialog"
      aria-label="Score breakdown"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-60">Virality</div>
          <div className="text-2xl font-semibold leading-none">
            {Math.round(result.viralScore)}
            <span className="text-sm opacity-50">/100</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close breakdown panel"
          onClick={onClose}
          className="rounded-full p-1 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex justify-center my-2">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          aria-hidden
        >
          {/* gridlines */}
          {gridPolygons.map((ring) => (
            <polygon
              key={`ring-${ring.ratio}`}
              points={ring.pts}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          ))}

          {/* axis spokes */}
          {axisLines.map(({ axis, end }) => (
            <line
              key={`axis-${axis.key}`}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeWidth={1}
            />
          ))}

          {/* current values polygon */}
          <polygon
            points={polygonPoints}
            fill="oklch(0.50 0.15 255 / 0.32)"
            stroke="oklch(0.50 0.15 255 / 0.85)"
            strokeWidth={1.5}
          />

          {/* axis labels */}
          {axisLines.map(({ axis, labelPos }) => (
            <text
              key={`label-${axis.key}`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {axis.label}
            </text>
          ))}
        </svg>
      </div>

      <ul className="space-y-1 text-xs">
        {AXES.map((axis) => {
          const v = clampValue(result.breakdown[axis.key]);
          return (
            <li key={axis.key} className="flex justify-between gap-2">
              <span className="opacity-70">{axis.label}</span>
              <span className="font-mono tabular-nums">{v.toFixed(2)}</span>
            </li>
          );
        })}
        <li className="flex justify-between gap-2 pt-1 border-t border-current/10">
          <span className="opacity-70">Hook</span>
          <span className="font-mono tabular-nums">{clampValue(result.hookScore).toFixed(2)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="opacity-70">Hold</span>
          <span className="font-mono tabular-nums">{clampValue(result.holdRate).toFixed(2)}</span>
        </li>
      </ul>
    </div>
  );
}

export default ScoreBreakdownPanel;
