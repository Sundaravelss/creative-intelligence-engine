"use client";

import { BarChart3, Brain, Camera, Palette, PenTool, Send } from "lucide-react";
import { AgentCard, type AgentDescriptor } from "./AgentCard";

/**
 * Six specialist agents — the character roster shown on /agents.
 * Avatar uses a single lucide icon per role until proper portraits exist.
 * Default adapter is `pioneer` for every agent (sponsor model).
 */
export const AGENTS: AgentDescriptor[] = [
  {
    id: "strategist",
    name: "Mira Vox",
    role: "Strategist",
    tagline:
      "Reads the brief, names the audience, picks the angle. Decides what gets shipped before pixels exist.",
    icon: Brain,
    accent: "text-violet-500",
    adapter: "pioneer",
  },
  {
    id: "creative_director",
    name: "Sol Ito",
    role: "Creative Director",
    tagline:
      "Holds the visual thesis. Greenlights moodboards, kills generic, refines until it's recognisably ours.",
    icon: Palette,
    accent: "text-rose-500",
    adapter: "pioneer",
  },
  {
    id: "copywriter",
    name: "June Marlow",
    role: "Copywriter",
    tagline:
      "Hooks, headlines, captions. Writes for the scroll, not the page. One idea per asset.",
    icon: PenTool,
    accent: "text-amber-500",
    adapter: "pioneer",
  },
  {
    id: "art_director",
    name: "Kai Renard",
    role: "Art Director",
    tagline:
      "Owns shoot prompts and references. Drives FAL generations until composition, lighting, and brand palette align.",
    icon: Camera,
    accent: "text-sky-500",
    adapter: "pioneer",
  },
  {
    id: "analyst",
    name: "Echo Park",
    role: "Performance Analyst",
    tagline:
      "Scores virality, hold-rate and hook density. Surfaces winners and prunes the rest.",
    icon: BarChart3,
    accent: "text-emerald-500",
    adapter: "pioneer",
  },
  {
    id: "publisher",
    name: "Nova Ash",
    role: "Publisher",
    tagline:
      "Ships to channels, schedules recurring drops, mirrors approvals back to the canvas.",
    icon: Send,
    accent: "text-indigo-500",
    adapter: "pioneer",
  },
];

export function AgentRoster() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="cie-agent-roster"
    >
      {AGENTS.map((a) => (
        <AgentCard key={a.id} agent={a} />
      ))}
    </div>
  );
}
