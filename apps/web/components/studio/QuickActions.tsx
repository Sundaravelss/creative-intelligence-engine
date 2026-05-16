"use client";

import {
  Image as ImageIcon,
  Presentation,
  ShoppingBag,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BrandProfile } from "./EmptyStateHello";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  brand: BrandProfile | null;
  onSelect: (prefilled: string) => void;
}

interface ActionDef {
  id: string;
  icon: LucideIcon;
  label: string;
  prefill: (brandName: string) => string;
  disabled?: boolean;
  tooltip?: string;
}

const ACTIONS: ActionDef[] = [
  {
    id: "image",
    icon: ImageIcon,
    label: "Create image",
    prefill: (b) => `Generate marketing images for ${b}`,
  },
  {
    id: "video",
    icon: Video,
    label: "Make video",
    prefill: (b) => `Generate a 5-second product reel for ${b}`,
  },
  {
    id: "slides",
    icon: Presentation,
    label: "Create slides",
    prefill: (b) => `Build a 5-slide pitch deck for ${b}`,
  },
  {
    id: "store",
    icon: ShoppingBag,
    label: "Make a store",
    prefill: () => "",
    disabled: true,
    tooltip: "Coming soon",
  },
];

export function QuickActions({ brand, onSelect }: QuickActionsProps) {
  const brandName = brand?.name ?? "your brand";

  return (
    <div
      data-testid="cie-quick-actions"
      className="mt-4 flex flex-wrap items-center justify-center gap-2"
    >
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={a.disabled}
            title={a.tooltip}
            onClick={() => {
              if (a.disabled) return;
              onSelect(a.prefill(brandName));
            }}
            className={cn(
              "h-8 rounded-full border-border/70 bg-white/70 px-3 text-[12px] font-medium backdrop-blur-sm",
              "hover:bg-white hover:shadow-sm",
              a.disabled && "opacity-50 hover:bg-white/70",
            )}
          >
            <Icon className="mr-1.5 size-3.5" />
            {a.label}
          </Button>
        );
      })}
    </div>
  );
}
