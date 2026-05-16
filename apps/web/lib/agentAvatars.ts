// Agent → stylized PNG avatar map.
//
// Avatars live at apps/web/public/agents/ (copied from
// ai-agency/site/frontend/public/avatars/stylized/ during W0). The keys here
// match the agent_id strings emitted by services/agents/orchestrator.py on the
// new agent_step_start / agent_step_complete SSE events, so callers can resolve
// an avatar with `avatarFor(payload.agentId)` without any glue.

export const AGENT_AVATARS = {
  strategist: { src: "/agents/assistant.png", label: "Sage" },
  creative_director: { src: "/agents/marketing.png", label: "Monica" },
  copywriter: { src: "/agents/social-media.png", label: "Lyra" },
  art_director: { src: "/agents/commercial.png", label: "Atlas" },
  performance_analyst: { src: "/agents/sales.png", label: "Gavin" },
  publisher: { src: "/agents/customer-care.png", label: "Echo" },
  comptable: { src: "/agents/comptable.png", label: "Russ" },
  recruiter: { src: "/agents/recrutement.png", label: "Hera" },
} as const;

export type AgentId = keyof typeof AGENT_AVATARS;

export function avatarFor(id: AgentId | string) {
  return AGENT_AVATARS[id as AgentId] ?? AGENT_AVATARS.strategist;
}
