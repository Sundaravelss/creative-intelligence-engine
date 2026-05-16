"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Workflow } from "lucide-react";

import { BriefComposer } from "@/components/canvas/BriefComposer";
import { CharacterLocker } from "@/components/canvas/characters/CharacterLocker";
import { ExportDialog } from "@/components/canvas/export/ExportDialog";
import { OneLinkBar } from "@/components/canvas/marketing/OneLinkBar";
import { MoodboardRail } from "@/components/canvas/moodboard/MoodboardRail";
import { PresetShelf } from "@/components/canvas/presets/PresetShelf";
import { StoryboardGrid } from "@/components/canvas/storyboard/StoryboardGrid";
import {
  composePromptWithPresets,
  findPreset,
} from "@/lib/canvas/presets";
import {
  STORYBOARD_SHOT_KINDS,
  type CanvasCharacter,
  type CanvasMode,
  type MoodboardPin,
  type ShotVariant,
  type StoryboardShot,
  type StoryboardShotKind,
} from "@/lib/canvas/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

interface SsePayload {
  nodeId?: string;
  artifact?: {
    id?: string;
    url?: string;
    kind?: "image" | "video" | "document" | "code";
    name?: string;
    shotId?: string;
    shotKind?: StoryboardShotKind | string;
    variantId?: string;
    variantLabel?: string;
    meta?: Record<string, unknown>;
  };
  message?: string;
  scores?: Array<{ artifactId: string; viralScore: number }>;
}

interface ParsedBlock {
  event: string;
  data: SsePayload;
}

function parseSseBlock(block: string): ParsedBlock | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as SsePayload };
  } catch {
    return null;
  }
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function isStoryboardKind(value: unknown): value is StoryboardShotKind {
  return (
    typeof value === "string" &&
    (STORYBOARD_SHOT_KINDS as readonly string[]).includes(value)
  );
}

interface ApplyArtifactArgs {
  artifactId: string;
  url: string;
  shotKind: StoryboardShotKind;
  variantId: string;
  variantLabel: string;
}

function applyArtifact(
  shots: ReadonlyArray<StoryboardShot>,
  args: ApplyArtifactArgs,
): StoryboardShot[] {
  const next: StoryboardShot[] = shots.map((s) => ({ ...s, variants: [...s.variants] }));
  let target = next.find((s) => s.kind === args.shotKind);
  if (!target) {
    target = {
      id: `shot_${args.shotKind}`,
      kind: args.shotKind,
      variants: [],
      heroVariantId: null,
    };
    next.push(target);
  }
  const variant: ShotVariant = {
    id: args.artifactId,
    label: args.variantLabel,
    url: args.url,
  };
  if (!target.variants.find((v) => v.id === variant.id)) {
    target.variants = [...target.variants, variant];
  }
  if (!target.heroVariantId) target.heroVariantId = variant.id;
  return next;
}

function applyScore(
  shots: ReadonlyArray<StoryboardShot>,
  artifactId: string,
  viralScore: number,
): StoryboardShot[] {
  return shots.map((shot) => ({
    ...shot,
    variants: shot.variants.map((v) =>
      v.id === artifactId ? { ...v, viralScore } : v,
    ),
  }));
}

export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading canvas…
        </div>
      }
    >
      <CanvasPageInner />
    </Suspense>
  );
}

function CanvasPageInner() {
  const [shots, setShots] = useState<StoryboardShot[]>([]);
  const [pins, setPins] = useState<MoodboardPin[]>([]);
  const [characters, setCharacters] = useState<CanvasCharacter[]>([]);
  const [activePresetIds, setActivePresetIds] = useState<string[]>([]);
  const [lockedCharacterId, setLockedCharacterId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exportArtifactUrl, setExportArtifactUrl] = useState<string | null>(null);
  const [exportLabel, setExportLabel] = useState<string>("");

  // Hydrate persisted pins/characters once.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/canvas/pins`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MoodboardPin[]) => {
        if (cancelled) return;
        if (Array.isArray(data)) setPins(data);
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/canvas/characters`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CanvasCharacter[]) => {
        if (cancelled) return;
        if (Array.isArray(data)) setCharacters(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePreset = useCallback((presetId: string) => {
    setActivePresetIds((curr) =>
      curr.includes(presetId) ? curr.filter((p) => p !== presetId) : [...curr, presetId],
    );
  }, []);

  const handleAddPin = useCallback((pin: MoodboardPin) => {
    setPins((curr) => [...curr, pin]);
    fetch(`${API_BASE}/api/canvas/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pin),
    }).catch(() => {
      toast.error("Pin saved locally; backend offline.");
    });
  }, []);

  const handleRemovePin = useCallback((pinId: string) => {
    setPins((curr) => curr.filter((p) => p.id !== pinId));
    fetch(`${API_BASE}/api/canvas/pins/${pinId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleCreateCharacter = useCallback((character: CanvasCharacter) => {
    setCharacters((curr) => [...curr, character]);
    fetch(`${API_BASE}/api/canvas/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(character),
    }).catch(() => {
      toast.error("Character saved locally; backend offline.");
    });
  }, []);

  const lockedCharacter = useMemo(
    () => characters.find((c) => c.id === lockedCharacterId) ?? null,
    [characters, lockedCharacterId],
  );

  const modifiersPreview = useMemo(() => {
    const parts: string[] = [];
    if (lockedCharacter) parts.push(lockedCharacter.name);
    parts.push(
      ...activePresetIds
        .map((id) => findPreset(id)?.label)
        .filter((l): l is string => Boolean(l)),
    );
    return parts.join(" · ");
  }, [activePresetIds, lockedCharacter]);

  const launchRun = useCallback(
    async (
      basePrompt: string,
      mode: CanvasMode,
      extras: { productUrl?: string } = {},
    ) => {
      if (running) {
        toast.error("A run is already streaming.");
        return;
      }
      setRunning(true);
      // Reset shots only for storyboard mode; marketing keeps prior storyboard.
      if (mode === "storyboard") {
        setShots(
          STORYBOARD_SHOT_KINDS.map((kind) => ({
            id: `shot_${kind}`,
            kind,
            variants: [],
            heroVariantId: null,
          })),
        );
      }

      const composedPrompt = composePromptWithPresets(basePrompt, activePresetIds);
      const persona = lockedCharacter?.persona ?? "";
      const finalPrompt = persona
        ? `${composedPrompt}, featuring ${lockedCharacter?.name} (${persona})`
        : composedPrompt;

      try {
        const res = await fetch(`${API_BASE}/api/agents/campaign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: {
              keyword: finalPrompt,
              url: extras.productUrl,
              mode,
              characterId: lockedCharacter?.id,
              moodboardPins: pins.map((p) => p.url),
              presetIds: activePresetIds,
            },
            brand_id: "allbirds",
            format: mode === "marketing" ? "reel" : "story",
            variants_per_shot: 3,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`Campaign request failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseSseBlock(block);
            if (parsed) {
              if (parsed.event === "artifact" && parsed.data.artifact) {
                const a = parsed.data.artifact;
                const id = a.id ?? uid("a");
                const url = a.url ?? `https://picsum.photos/seed/${id}/600/800`;
                const variantId = a.variantId ?? id;
                const variantLabel = a.variantLabel ?? "Variant";
                const rawKind = a.shotKind ?? a.meta?.shotKind;
                const shotKind: StoryboardShotKind = isStoryboardKind(rawKind)
                  ? rawKind
                  : "wide";
                setShots((curr) =>
                  applyArtifact(curr, {
                    artifactId: id,
                    url,
                    shotKind,
                    variantId,
                    variantLabel,
                  }),
                );
              } else if (parsed.event === "node_complete" && parsed.data.scores) {
                const scores = parsed.data.scores;
                setShots((curr) => {
                  let next = curr;
                  for (const s of scores) next = applyScore(next, s.artifactId, s.viralScore);
                  return next;
                });
              } else if (parsed.event === "error") {
                toast.error(parsed.data.message ?? "Stream error");
              }
            }
            idx = buffer.indexOf("\n\n");
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Run failed";
        toast.error(`${msg} — using synthetic preview`);
        // Demo-shaped synthetic fallback so the canvas still tells a story.
        STORYBOARD_SHOT_KINDS.forEach((kind, i) => {
          const labels = ["Editorial", "Golden Hour", "Overcast"];
          labels.forEach((label, j) => {
            const id = `synthetic-${kind}-${j}-${Date.now()}`;
            setShots((curr) =>
              applyArtifact(curr, {
                artifactId: id,
                url: `https://picsum.photos/seed/${kind}-${j}-${i}/600/800`,
                shotKind: kind,
                variantId: id,
                variantLabel: label,
              }),
            );
            setShots((curr) => applyScore(curr, id, 55 + ((i + j) % 5) * 8));
          });
        });
      } finally {
        setRunning(false);
      }
    },
    [activePresetIds, lockedCharacter, pins, running],
  );

  const handleBriefSubmit = useCallback(
    (brief: string) => void launchRun(brief, "storyboard"),
    [launchRun],
  );

  const handleOneLinkSubmit = useCallback(
    (productUrl: string) =>
      void launchRun(`product launch: ${productUrl}`, "marketing", { productUrl }),
    [launchRun],
  );

  const handlePromoteVariant = useCallback((shotId: string, variantId: string) => {
    setShots((curr) =>
      curr.map((s) => (s.id === shotId ? { ...s, heroVariantId: variantId } : s)),
    );
  }, []);

  const handleRemix = useCallback(
    (shotId: string) => {
      const target = shots.find((s) => s.id === shotId);
      if (!target) return;
      void launchRun(`remix ${target.kind} angle`, "storyboard");
    },
    [launchRun, shots],
  );

  const handleExport = useCallback(
    (shotId: string) => {
      const target = shots.find((s) => s.id === shotId);
      if (!target) return;
      const hero =
        target.variants.find((v) => v.id === target.heroVariantId) ?? target.variants[0];
      if (!hero) {
        toast.message("Generate a variant before exporting.");
        return;
      }
      setExportArtifactUrl(hero.url);
      setExportLabel(`${target.kind}-${hero.label}`);
    },
    [shots],
  );

  return (
    <main className="grid h-screen w-full overflow-hidden grid-rows-[auto_auto_1fr]">
      {/* Top bar — title + one-link */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--hc-surface-recessed)]/60 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Workflow size={18} className="text-[oklch(0.66_0.18_25)]" />
          <div>
            <h1 className="hc-serif-headline text-[15px] font-semibold leading-tight">
              Canvas
            </h1>
            <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
              One canvas. Every workflow.
            </p>
          </div>
        </div>
        <div className="min-w-[280px] flex-1 max-w-xl">
          <OneLinkBar onSubmit={handleOneLinkSubmit} busy={running} />
        </div>
      </header>

      <PresetShelf activePresetIds={activePresetIds} onTogglePreset={togglePreset} />

      <div
        className="grid min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: "240px 1fr 320px" }}
      >
        <aside
          className="flex min-h-0 flex-col overflow-y-auto"
          aria-label="Left rail"
        >
          <MoodboardRail
            pins={pins}
            onAddPin={handleAddPin}
            onRemovePin={handleRemovePin}
          />
          <CharacterLocker
            characters={characters}
            lockedCharacterId={lockedCharacterId}
            onCreateCharacter={handleCreateCharacter}
            onToggleLock={setLockedCharacterId}
          />
        </aside>

        <section
          className="relative flex min-h-0 flex-col overflow-hidden"
          aria-label="Storyboard"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.96 0.03 320 / 0.6), oklch(0.97 0.02 80 / 0.6))",
          }}
        >
          <div className="border-b border-[color:var(--color-border)] bg-white/40 p-3 backdrop-blur-md">
            <BriefComposer
              busy={running}
              onSubmit={handleBriefSubmit}
              modifiersPreview={modifiersPreview}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <StoryboardGrid
              shots={shots}
              onPromoteVariant={handlePromoteVariant}
              onRemix={handleRemix}
              onExport={handleExport}
              onSelectVariant={handlePromoteVariant}
            />
          </div>
        </section>

        <aside
          className="hc-glass border-l border-[color:var(--color-border)] overflow-y-auto"
          aria-label="Inspector"
        >
          <div className="px-4 py-4">
            <h2 className="hc-serif-headline text-lg font-semibold">Inspector</h2>
            <p className="mt-1 text-[12px] text-[color:var(--color-muted-foreground)]">
              {lockedCharacter
                ? `Locked: ${lockedCharacter.name}. Identity drift possible — review variants before publish.`
                : "Lock a character or pick presets to see them here."}
            </p>
            <div className="mt-4 space-y-2">
              {activePresetIds.length === 0 ? (
                <p className="text-[12px] italic text-[color:var(--color-muted-foreground)]">
                  No presets active.
                </p>
              ) : (
                activePresetIds.map((id) => {
                  const preset = findPreset(id);
                  if (!preset) return null;
                  return (
                    <div
                      key={id}
                      className="hc-glass rounded-md border border-[color:var(--color-border)] bg-white/50 px-2 py-1.5"
                    >
                      <div className="text-[11px] font-medium">{preset.label}</div>
                      <div className="text-[10px] text-[color:var(--color-muted-foreground)]">
                        {preset.promptFragment}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      <ExportDialog
        open={Boolean(exportArtifactUrl)}
        imageUrl={exportArtifactUrl}
        label={exportLabel}
        onClose={() => setExportArtifactUrl(null)}
      />
    </main>
  );
}
