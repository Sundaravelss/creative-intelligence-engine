import type { NodeKind } from "./schemas";

/**
 * Registry of all 9 canvas node kinds with display metadata.
 *
 * Note: this package intentionally does NOT bundle the React node
 * components. They live at the app level (apps/web/components/canvas/nodes)
 * because they consume `@cie/ui-artifacts` and the host app's CSS classes.
 * The Canvas wrapper imports those components and assembles the final
 * `nodeTypes` map for React Flow.
 *
 * Lucide icon names map 1:1 to lucide-react exports — Canvas resolves
 * them dynamically at render time so this package stays icon-agnostic.
 */
export interface NodeKindMeta {
  kind: NodeKind;
  label: string;
  description: string;
  /** Lucide icon name (PascalCase) — must exist in lucide-react. */
  icon: string;
  /** Tailwind text colour class for the icon, picked to evoke the node's role. */
  accent: string;
}

export const nodeKinds: NodeKindMeta[] = [
  {
    kind: "brief",
    label: "Brief",
    description: "Campaign URL, keyword, audience, candidate hooks.",
    icon: "FileText",
    accent: "text-amber-500",
  },
  {
    kind: "audience",
    label: "Audience",
    description: "Demographics + psychographics target.",
    icon: "Users",
    accent: "text-violet-500",
  },
  {
    kind: "hook",
    label: "Hook",
    description: "A single hook line, optionally scored.",
    icon: "Sparkles",
    accent: "text-rose-500",
  },
  {
    kind: "imageGen",
    label: "Image",
    description: "FAL image generation with references.",
    icon: "ImageIcon",
    accent: "text-sky-500",
  },
  {
    kind: "videoGen",
    label: "Video",
    description: "Sora-2 / Kling / Veo motion generation.",
    icon: "Film",
    accent: "text-indigo-500",
  },
  {
    kind: "variant",
    label: "Variant",
    description: "Refined / restyled descendant of an artifact.",
    icon: "Layers",
    accent: "text-teal-500",
  },
  {
    kind: "score",
    label: "Score",
    description: "Virality + hook + hold-rate prediction.",
    icon: "Gauge",
    accent: "text-emerald-500",
  },
  {
    kind: "schedule",
    label: "Schedule",
    description: "Cron + channel for recurring publish.",
    icon: "CalendarClock",
    accent: "text-orange-500",
  },
  {
    kind: "adReference",
    label: "Ad Reference",
    description: "External viral ad to recreate.",
    icon: "Link2",
    accent: "text-fuchsia-500",
  },
];

export const nodeKindByName: Record<NodeKind, NodeKindMeta> = nodeKinds.reduce(
  (acc, m) => {
    acc[m.kind] = m;
    return acc;
  },
  {} as Record<NodeKind, NodeKindMeta>,
);
