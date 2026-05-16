"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import type { ExtendedBrandProfile } from "./types";

interface GraphPanelProps {
  brand: ExtendedBrandProfile;
  onJumpToSources: () => void;
}

interface PositionedNode {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  fill: string;
  stroke?: string;
  textColor?: string;
  kind: "brand" | "palette" | "product";
  meta?: string;
}

const VIEW_W = 480;
const VIEW_H = 420;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;
const PALETTE_RADIUS = 90;
const PRODUCT_RADIUS = 175;

function pointOnCircle(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

// Pick a contrasting text color for a given background hex.
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0f172a";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Standard luminance check.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

export function GraphPanel({ brand, onJumpToSources }: GraphPanelProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const nodes = useMemo<PositionedNode[]>(() => {
    const palette = (brand.palette ?? []).filter(Boolean);
    const products = brand.products ?? [];
    const list: PositionedNode[] = [];

    // Brand center node
    list.push({
      id: "brand",
      x: CENTER_X,
      y: CENTER_Y,
      r: 36,
      label: brand.name || "Brand",
      fill: "#0f172a",
      textColor: "#ffffff",
      kind: "brand",
    });

    // Palette nodes — evenly spaced on inner circle
    palette.slice(0, 4).forEach((hex, i) => {
      const angle = (i / Math.max(palette.slice(0, 4).length, 1)) * Math.PI * 2 - Math.PI / 2;
      const { x, y } = pointOnCircle(CENTER_X, CENTER_Y, PALETTE_RADIUS, angle);
      list.push({
        id: `palette-${i}`,
        x,
        y,
        r: 22,
        label: hex,
        fill: hex,
        stroke: "#ffffff",
        kind: "palette",
      });
    });

    // Product nodes — outer ring
    const productCount = products.length;
    products.forEach((p, i) => {
      const angle =
        productCount > 0
          ? (i / productCount) * Math.PI * 2 - Math.PI / 3
          : 0;
      const { x, y } = pointOnCircle(CENTER_X, CENTER_Y, PRODUCT_RADIUS, angle);
      list.push({
        id: `product-${p.id}`,
        x,
        y,
        r: 18,
        label: p.name,
        fill: "#ffffff",
        stroke: "#0f172a",
        textColor: "#0f172a",
        kind: "product",
        meta: p.sku,
      });
    });

    return list;
  }, [brand]);

  const palette = (brand.palette ?? []).filter(Boolean);
  const isEmpty = palette.length === 0 && (brand.products?.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
        <p className="text-sm font-medium">Nothing to graph yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Run a scan to populate the brand graph.
        </p>
        <button
          type="button"
          onClick={onJumpToSources}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
        >
          Go to Sources <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Compute connecting edges:
  // - palette nodes connect to brand center
  // - each product connects to the closest palette node (visual heuristic)
  const paletteNodes = nodes.filter((n) => n.kind === "palette");
  const productNodes = nodes.filter((n) => n.kind === "product");
  const brandNode = nodes.find((n) => n.kind === "brand");

  const edges: Array<{ from: PositionedNode; to: PositionedNode }> = [];
  if (brandNode) {
    paletteNodes.forEach((p) => edges.push({ from: brandNode, to: p }));
  }
  productNodes.forEach((prod) => {
    let nearest: PositionedNode | null = null;
    let nearestDist = Infinity;
    for (const p of paletteNodes) {
      const d = Math.hypot(p.x - prod.x, p.y - prod.y);
      if (d < nearestDist) {
        nearest = p;
        nearestDist = d;
      }
    }
    if (nearest) edges.push({ from: nearest, to: prod });
  });

  const hoverNode = nodes.find((n) => n.id === hoverId);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background via-background to-muted/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Brand graph
          </h3>
          <p className="text-xs text-muted-foreground/80">
            {brand.name || "Brand"} · {paletteNodes.length} colors · {productNodes.length} products
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full max-w-2xl"
          role="img"
          aria-label="Brand relationship graph"
        >
          {/* Background grid hint */}
          <defs>
            <radialGradient id="brand-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(15,23,42,0.06)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0)" />
            </radialGradient>
          </defs>
          <circle cx={CENTER_X} cy={CENTER_Y} r={PRODUCT_RADIUS + 30} fill="url(#brand-glow)" />

          {/* Edges */}
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="rgba(15,23,42,0.18)"
              strokeWidth={1}
              strokeDasharray={edge.to.kind === "product" ? "3 3" : undefined}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHover = node.id === hoverId;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoverId(node.id)}
                onMouseLeave={() => setHoverId((cur) => (cur === node.id ? null : cur))}
                className="cursor-pointer"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + (isHover ? 2 : 0)}
                  fill={node.fill}
                  stroke={node.stroke ?? "rgba(15,23,42,0.15)"}
                  strokeWidth={isHover ? 2 : 1}
                  style={{ transition: "all 120ms ease-out" }}
                />
                {node.kind === "brand" && (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={node.textColor ?? readableTextOn(node.fill)}
                  >
                    {node.label.length > 10 ? `${node.label.slice(0, 9)}…` : node.label}
                  </text>
                )}
                {node.kind === "product" && (
                  <text
                    x={node.x}
                    y={node.y + node.r + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#475569"
                  >
                    {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoverNode && hoverNode.kind === "product" && (
        <div className="pointer-events-none absolute right-6 top-6 rounded-lg border border-border/40 bg-background px-3 py-2 text-xs shadow-md">
          <p className="font-medium">{hoverNode.label}</p>
          {hoverNode.meta && (
            <p className="mt-0.5 font-mono text-muted-foreground">SKU: {hoverNode.meta}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GraphPanel;
