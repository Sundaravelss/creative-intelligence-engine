/**
 * Named adapter pairings exposed in the Studio composer dropdown.
 *
 * Each pairing maps to a (`adapter`, `fallback`) tuple sent on
 * `POST /api/agents/campaign`. The backend resolves the chain via
 * `services/agents/runtime.py::_resolve_chain`.
 *
 * Default is `pioneer-claude` per .env `DEFAULT_ADAPTER=pioneer` +
 * `ADAPTER_FALLBACK_CHAIN=pioneer,claude_code,hermes_cli,openai,together`.
 */
export type AdapterPairingId =
  | "pioneer-claude"
  | "claude-hermes"
  | "openai-hermes"
  | "pioneer-only"
  | "claude-only";

export interface AdapterPairing {
  id: AdapterPairingId;
  label: string;
  /** Preferred adapter — sent as `?adapter=` on the campaign request. */
  adapter: string;
  /** Comma-separated chain — sent as `fallback`. Empty = use server default. */
  fallback: string;
  /** Short user-facing description. */
  description: string;
}

export const ADAPTER_PAIRINGS: readonly AdapterPairing[] = [
  {
    id: "pioneer-claude",
    label: "Pioneer · fallback Claude",
    adapter: "pioneer",
    fallback: "pioneer,claude_code,hermes_cli,openai",
    description: "Sponsor fine-tune primary; Claude CLI catches if Pioneer is down.",
  },
  {
    id: "claude-hermes",
    label: "Claude · fallback Hermes",
    adapter: "claude_code",
    fallback: "claude_code,hermes_cli,openai",
    description: "Direct Anthropic CLI; Hermes wraps the same Claude with skills + memory.",
  },
  {
    id: "openai-hermes",
    label: "OpenAI · fallback Hermes",
    adapter: "openai",
    fallback: "openai,hermes_cli,pioneer",
    description: "GPT-4o family; Hermes (Claude) as fallback.",
  },
  {
    id: "pioneer-only",
    label: "Pioneer only",
    adapter: "pioneer",
    fallback: "pioneer",
    description: "Sponsor flex — no fallback. Will surface errors directly.",
  },
  {
    id: "claude-only",
    label: "Claude only",
    adapter: "claude_code",
    fallback: "claude_code",
    description: "Local Anthropic CLI only — best for testing reasoning quality.",
  },
];

export const DEFAULT_PAIRING_ID: AdapterPairingId = "pioneer-claude";

export function pairingById(id: string | null | undefined): AdapterPairing {
  return (
    ADAPTER_PAIRINGS.find((p) => p.id === id) ??
    ADAPTER_PAIRINGS.find((p) => p.id === DEFAULT_PAIRING_ID)!
  );
}
