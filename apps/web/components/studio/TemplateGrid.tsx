"use client";

import {
  Camera,
  Coffee,
  Film,
  LayoutGrid,
  Mail,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Scaffolding text that pre-fills the prompt. */
  scaffold: (subject: string) => string;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: "product-photo",
    name: "Product Photo",
    description: "Studio still with brand-correct lighting.",
    icon: Camera,
    scaffold: (s) =>
      `Hero product photo of ${s}. Soft studio lighting, seamless backdrop, brand palette, 1:1.`,
  },
  {
    id: "lifestyle-shot",
    name: "Lifestyle Shot",
    description: "In-context, candid, story-driven.",
    icon: Coffee,
    scaffold: (s) =>
      `Lifestyle shot featuring ${s}. Authentic moment, golden-hour light, real-world setting, 4:5.`,
  },
  {
    id: "ugc-avatar",
    name: "UGC Avatar",
    description: "Selfie-style talking-head with hook caption.",
    icon: Sparkles,
    scaffold: (s) =>
      `UGC-style avatar holding ${s}, talking to camera. Vertical 9:16, hook caption overlay, casual indoor setting.`,
  },
  {
    id: "promo-reel",
    name: "Promo Reel",
    description: "6-second vertical motion ad.",
    icon: Film,
    scaffold: (s) =>
      `6-second vertical reel for ${s}. Three quick cuts, on-beat motion, hook in first frame, 9:16.`,
  },
  {
    id: "carousel-ad",
    name: "Carousel Ad",
    description: "5-card narrative sequence.",
    icon: LayoutGrid,
    scaffold: (s) =>
      `5-card carousel for ${s}. Card 1 hook, cards 2–4 benefit beats, card 5 CTA. Square 1:1 each.`,
  },
  {
    id: "email-hero",
    name: "Email Hero",
    description: "Wide banner with headline area.",
    icon: Mail,
    scaffold: (s) =>
      `Email hero banner for ${s}. 16:9 with negative space top-right for headline, brand-consistent palette.`,
  },
];

interface TemplateGridProps {
  /** Subject extracted from current prompt — used to pre-fill scaffolds. */
  subject: string;
  onPick: (scaffold: string) => void;
}

export function TemplateGrid({ subject, onPick }: TemplateGridProps) {
  const subj = subject.trim().length > 0 ? subject.trim() : "your product";
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      data-testid="cie-template-grid"
    >
      {STUDIO_TEMPLATES.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.scaffold(subj))}
            className="hc-glass hc-card group flex flex-col items-start gap-2 border border-[color:var(--color-border)] p-4 text-left transition-transform hover:-translate-y-0.5"
          >
            <span
              className="hc-pill inline-flex h-9 w-9 items-center justify-center border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] text-[color:var(--hc-accent-coral)] transition-colors group-hover:bg-[color:var(--hc-accent-coral-soft)]"
              aria-hidden
            >
              <Icon size={16} />
            </span>
            <span className="text-sm font-semibold leading-tight">{t.name}</span>
            <span className="text-xs leading-snug text-muted-foreground">
              {t.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
