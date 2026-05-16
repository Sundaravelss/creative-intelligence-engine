"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Brain,
  ChevronRight,
  Facebook,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Mail,
  MessageSquare,
  Music,
  Plug,
  Search,
  ShoppingBag,
  Slack,
  Terminal,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Connector {
  id: string;
  name: string;
  category: string;
  status: "connected" | "not-connected" | "coming-soon";
  icon?: string;
  description?: string;
}

interface ConnectorDropdownProps {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

const ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  music: Music,
  slack: Slack,
  mail: Mail,
  "shopping-bag": ShoppingBag,
  search: Search,
  brain: Brain,
  image: ImageIcon,
  terminal: Terminal,
  message: MessageSquare,
};

function iconFor(key?: string): LucideIcon {
  if (!key) return Plug;
  return ICON_MAP[key] ?? Plug;
}

export function ConnectorDropdown({
  trigger,
  align = "start",
  side = "bottom",
}: ConnectorDropdownProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Connector[]>("/api/connectors")
      .then((data) => {
        if (cancelled) return;
        setConnectors(data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setConnectors([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = connectors.filter(
    (c) => c.status === "connected" || c.status === "not-connected",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className="w-72 rounded-xl border bg-popover/95 p-1 backdrop-blur-md"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Connectors
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Loading connectors…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No connectors available.
          </div>
        )}
        {!loading &&
          visible.map((c) => {
            const Icon = iconFor(c.icon);
            const dot =
              c.status === "connected"
                ? "bg-emerald-500"
                : "bg-muted-foreground/40";
            return (
              <DropdownMenuItem
                key={c.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-muted/70">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <span
                  className={cn("size-1.5 rounded-full", dot)}
                  aria-label={c.status}
                />
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </DropdownMenuItem>
            );
          })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="/connectors"
            className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium"
          >
            Manage connectors
            <ChevronRight className="size-3.5" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
