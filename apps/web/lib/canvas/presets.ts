/**
 * Preset shelf data for `/canvas`.
 *
 * Three categories mirror Higgsfield's shelf groupings (see
 * `docs/research/higgsfield/UX-NOTES.md`). Presets are pure prompt
 * fragments that get appended to the brief. No DB needed — this is
 * curated content shipped with the app.
 */

export type PresetCategory = "viral" | "camera" | "mood";

export interface CanvasPreset {
  id: string;
  label: string;
  category: PresetCategory;
  /** Phrase that gets appended to the prompt when this preset is active. */
  promptFragment: string;
  /** Optional model-id hint surfaced to the Art Director. */
  modelHint?: string;
  /** Lucide icon name (PascalCase). */
  icon?: string;
}

export const PRESETS: ReadonlyArray<CanvasPreset> = [
  // -- Viral / Soul ---------------------------------------------------------
  {
    id: "soul-fighter",
    label: "Soul Fighter",
    category: "viral",
    promptFragment: "high-impact action stance, dramatic backlight, hero pose",
    icon: "Flame",
  },
  {
    id: "red-carpet",
    label: "Red Carpet",
    category: "viral",
    promptFragment: "red carpet glamour, paparazzi flashes, celebrity poise",
    icon: "Star",
  },
  {
    id: "magic-spell",
    label: "Magic Spell",
    category: "viral",
    promptFragment: "swirling magical energy, particle effects, mystical glow",
    icon: "Sparkles",
  },
  {
    id: "animal-chase",
    label: "Animal Chase",
    category: "viral",
    promptFragment: "kinetic chase shot, motion blur, low angle tracking",
    icon: "Zap",
  },
  {
    id: "sword-and-sorcery",
    label: "Sword & Sorcery",
    category: "viral",
    promptFragment: "fantasy epic, ancient sword, mystical environment",
    icon: "Swords",
  },
  // -- Camera moves --------------------------------------------------------
  {
    id: "dolly-in",
    label: "Dolly In",
    category: "camera",
    promptFragment: "smooth slow dolly-in, building tension, cinematic push",
    icon: "Move",
  },
  {
    id: "pan",
    label: "Pan",
    category: "camera",
    promptFragment: "horizontal pan across the scene, revealing context",
    icon: "MoveHorizontal",
  },
  {
    id: "orbit",
    label: "Orbit",
    category: "camera",
    promptFragment: "360° orbit around subject, parallax depth",
    icon: "RotateCw",
  },
  {
    id: "earth-zoom-out",
    label: "Earth Zoom Out",
    category: "camera",
    promptFragment: "rapid zoom-out to space, leaving Earth behind",
    icon: "ZoomOut",
  },
  {
    id: "superfast-flight",
    label: "Superfast Flight",
    category: "camera",
    promptFragment: "first-person superhero flight, motion streaks, sky-high",
    icon: "Plane",
  },
  {
    id: "still-world",
    label: "Still World",
    category: "camera",
    promptFragment: "frozen-in-time tableau, only camera moves",
    icon: "Pause",
  },
  // -- Mood packs ----------------------------------------------------------
  {
    id: "editorial",
    label: "Editorial",
    category: "mood",
    promptFragment: "editorial fashion lighting, magazine-grade composition",
    icon: "Newspaper",
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    category: "mood",
    promptFragment: "warm golden-hour light, long shadows, amber tones",
    icon: "Sunrise",
  },
  {
    id: "overcast",
    label: "Overcast",
    category: "mood",
    promptFragment: "soft overcast diffused light, muted palette",
    icon: "Cloud",
  },
  {
    id: "neon-city",
    label: "Neon City",
    category: "mood",
    promptFragment: "neon-drenched night city, cyberpunk reflections",
    icon: "Building2",
  },
  {
    id: "tuscan-yoga",
    label: "Tuscan Yoga",
    category: "mood",
    promptFragment: "soft mediterranean light, terracotta tones, calm",
    icon: "Leaf",
  },
  {
    id: "summer-haze",
    label: "Summer Haze",
    category: "mood",
    promptFragment: "hazy summer afternoon, lens flare, dreamy bokeh",
    icon: "Sun",
  },
];

export const PRESET_CATEGORIES: ReadonlyArray<{
  id: PresetCategory;
  label: string;
  description: string;
}> = [
  {
    id: "viral",
    label: "Viral Presets",
    description: "Every preset, one click away.",
  },
  {
    id: "camera",
    label: "Camera Moves",
    description: "Cinema-Studio motion templates.",
  },
  {
    id: "mood",
    label: "Mood Packs",
    description: "Lighting and atmosphere recipes.",
  },
];

export function presetsByCategory(category: PresetCategory): ReadonlyArray<CanvasPreset> {
  return PRESETS.filter((p) => p.category === category);
}

export function findPreset(id: string): CanvasPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function composePromptWithPresets(
  basePrompt: string,
  activePresetIds: ReadonlyArray<string>,
): string {
  const fragments = activePresetIds
    .map((id) => findPreset(id)?.promptFragment)
    .filter((f): f is string => Boolean(f));
  if (fragments.length === 0) return basePrompt;
  return `${basePrompt}, ${fragments.join(", ")}`;
}
