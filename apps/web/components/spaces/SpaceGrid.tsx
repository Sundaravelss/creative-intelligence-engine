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

import { SpaceCard } from "./SpaceCard";

export interface SpaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind gradient classes for the card thumbnail. */
  gradient: string;
  /** Default prompt scaffold prefilled in Step 2. */
  defaultPrompt: string;
}

/**
 * Six template Spaces, mirroring the shopos.ai surface. Same set as the
 * legacy `STUDIO_TEMPLATES` in `studio/TemplateGrid.tsx` — kept here as
 * the single source of truth for the Spaces grid.
 */
export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: "product-photo",
    name: "Product Photo",
    description: "Studio still with brand-correct lighting.",
    icon: Camera,
    gradient: "bg-gradient-to-br from-[#f4d4c0] via-[#e8b89e] to-[#c98a6f]",
    defaultPrompt:
      "Hero product photo. Soft studio lighting, seamless backdrop, brand palette, 1:1.",
  },
  {
    id: "lifestyle-shot",
    name: "Lifestyle Shot",
    description: "In-context, candid, story-driven.",
    icon: Coffee,
    gradient: "bg-gradient-to-br from-[#dcd2e6] via-[#c9b8d6] to-[#9a8db0]",
    defaultPrompt:
      "Lifestyle shot. Authentic moment, golden-hour light, real-world setting, 4:5.",
  },
  {
    id: "ugc-avatar",
    name: "UGC Avatar",
    description: "Selfie-style talking-head with hook caption.",
    icon: Sparkles,
    gradient: "bg-gradient-to-br from-[#ffd6c2] via-[#ffb89a] to-[#e8866a]",
    defaultPrompt:
      "UGC-style avatar talking to camera. Vertical 9:16, hook caption overlay, casual indoor setting.",
  },
  {
    id: "promo-reel",
    name: "Promo Reel",
    description: "6-second vertical motion ad.",
    icon: Film,
    gradient: "bg-gradient-to-br from-[#1f2a44] via-[#3b4a6b] to-[#6b7a99]",
    defaultPrompt:
      "6-second vertical reel. Three quick cuts, on-beat motion, hook in first frame, 9:16.",
  },
  {
    id: "carousel-ad",
    name: "Carousel Ad",
    description: "5-card narrative sequence.",
    icon: LayoutGrid,
    gradient: "bg-gradient-to-br from-[#e7d6c5] via-[#d6bfa8] to-[#a8896b]",
    defaultPrompt:
      "5-card carousel. Card 1 hook, cards 2–4 benefit beats, card 5 CTA. Square 1:1 each.",
  },
  {
    id: "email-hero",
    name: "Email Hero",
    description: "Wide banner with headline area.",
    icon: Mail,
    gradient: "bg-gradient-to-br from-[#d4e3d4] via-[#a8c4a8] to-[#6b8d6b]",
    defaultPrompt:
      "Email hero banner. 16:9 with negative space top-right for headline, brand-consistent palette.",
  },
];

export function getSpaceById(id: string): SpaceTemplate | undefined {
  return SPACE_TEMPLATES.find((s) => s.id === id);
}

export function SpaceGrid() {
  return (
    <div
      data-testid="cie-space-grid"
      className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {SPACE_TEMPLATES.map((s) => (
        <SpaceCard
          key={s.id}
          id={s.id}
          name={s.name}
          description={s.description}
          icon={s.icon}
          gradient={s.gradient}
        />
      ))}
    </div>
  );
}
