"use client";

import * as React from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  ChevronsUpDown,
  FileClock,
  GraduationCap,
  Layout,
  LogOut,
  MessageSquareText,
  MessagesSquare,
  Plus,
  Settings,
  UserCircle,
  UserCog,
  UserSearch,
  Sparkles,
  Workflow,
  LayoutGrid,
  Brain,
  Plug,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

const sidebarVariants = {
  open: {
    width: "15rem",
  },
  closed: {
    width: "3.05rem",
  },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
};

const transitionProps = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.2,
  staggerChildren: 0.1,
};

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/canvas", label: "Canvas", icon: Workflow },
  { href: "/spaces", label: "Spaces", icon: LayoutGrid },
  // Loops are now scheduled inline from the studio + canvas composers
  // (see ScheduleModal). The /loops route + page were removed.
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/brand", label: "Brand Memory", icon: Brain },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/agents", label: "Agents", icon: Users },
];

const ACTIVE_TEXT = "text-[oklch(0.66_0.18_25)]";
const ACTIVE_BG = "bg-[oklch(0.97_0.04_25)]";

export function SessionNavBar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === "/studio") return pathname === "/" || pathname.startsWith("/studio");
    return pathname.startsWith(href);
  };

  return (
    <motion.div
      className={cn(
        "sidebar fixed left-0 z-40 h-full shrink-0 border-r fixed bg-white/95 backdrop-blur",
      )}
      initial={isCollapsed ? "closed" : "open"}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className="relative z-40 flex h-full shrink-0 flex-col bg-white text-neutral-700 transition-all"
        variants={contentVariants}
      >
        <motion.ul variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex h-[54px] w-full shrink-0 items-center border-b border-neutral-200 p-2">
            <div className="mt-[1.5px] flex w-full items-center">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="w-full" asChild>
                  <button
                    type="button"
                    className="flex w-fit items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-neutral-100"
                  >
                    <Avatar className="rounded size-4">
                      <AvatarFallback className="rounded-md bg-neutral-200 text-[10px] font-medium text-neutral-700">
                        AS
                      </AvatarFallback>
                    </Avatar>
                    <motion.li
                      variants={variants}
                      className="flex w-fit items-center gap-2"
                    >
                      {!isCollapsed && (
                        <>
                          <p className="text-sm font-medium">
                            Acme Sneakers
                          </p>
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        </>
                      )}
                    </motion.li>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild className="flex items-center gap-2">
                    <Link href="/settings/members">
                      <UserCog className="h-4 w-4" /> Manage members
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="flex items-center gap-2">
                    <Link href="/settings/integrations">
                      <Blocks className="h-4 w-4" /> Integrations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="flex items-center gap-2">
                    <Link href="/select-org">
                      <Plus className="h-4 w-4" /> Create or join an organization
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex h-full w-full flex-col">
            <div className="flex grow flex-col gap-4">
              <ScrollArea className="h-16 grow p-2">
                <div className={cn("flex w-full flex-col gap-1")}>
                  {PRIMARY_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900",
                          active && cn(ACTIVE_BG, ACTIVE_TEXT)
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <motion.li variants={variants}>
                          {!isCollapsed && (
                            <span className="ml-2 flex items-center gap-2 text-sm font-medium">
                              {item.label}
                              {item.badge && (
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-neutral-500">
                                  {item.badge}
                                </span>
                              )}
                            </span>
                          )}
                        </motion.li>
                      </Link>
                    );
                  })}

                  <Separator className="my-1.5 w-full" />

                  {SECONDARY_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900",
                          active && cn(ACTIVE_BG, ACTIVE_TEXT)
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <motion.li variants={variants}>
                          {!isCollapsed && (
                            <span className="ml-2 text-sm font-medium">
                              {item.label}
                            </span>
                          )}
                        </motion.li>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col p-2">
              <Link
                href="/settings/profile"
                className={cn(
                  "mt-auto flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900",
                  isActive("/settings") && cn(ACTIVE_BG, ACTIVE_TEXT)
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <motion.li variants={variants}>
                  {!isCollapsed && (
                    <span className="ml-2 text-sm font-medium">Settings</span>
                  )}
                </motion.li>
              </Link>

              <div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full">
                    <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900">
                      <Avatar className="size-4">
                        <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-700">
                          S
                        </AvatarFallback>
                      </Avatar>
                      <motion.li
                        variants={variants}
                        className="flex w-full items-center gap-2"
                      >
                        {!isCollapsed && (
                          <>
                            <p className="text-sm font-medium">Sundara</p>
                            <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50" />
                          </>
                        )}
                      </motion.li>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent sideOffset={5}>
                    <div className="flex flex-row items-center gap-2 p-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-neutral-200 text-xs font-medium text-neutral-700">
                          SU
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium">Sundara</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          sundaravelselvarajfr@gmail.com
                        </span>
                      </div>
                    </div>
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild className="flex items-center gap-2">
                        <Link href="/settings/profile">
                          <UserCircle className="h-4 w-4" /> Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}

// Suppress unused-import warnings for icons retained for future menu items
void [
  FileClock,
  GraduationCap,
  Layout,
  MessageSquareText,
  MessagesSquare,
  UserSearch,
];
