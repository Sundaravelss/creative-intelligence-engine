"use client";

import { useState } from "react";
import { Lock, LockOpen, UserPlus } from "lucide-react";

import type { CanvasCharacter } from "@/lib/canvas/types";

interface CharacterLockerProps {
  characters: ReadonlyArray<CanvasCharacter>;
  lockedCharacterId: string | null;
  onCreateCharacter: (character: CanvasCharacter) => void;
  onToggleLock: (characterId: string | null) => void;
}

function uid(): string {
  return `char_${Math.random().toString(36).slice(2, 10)}`;
}

export function CharacterLocker({
  characters,
  lockedCharacterId,
  onCreateCharacter,
  onToggleLock,
}: CharacterLockerProps) {
  const [drafting, setDrafting] = useState(false);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [refUrl, setRefUrl] = useState("");

  const submit = () => {
    if (!name.trim() || !persona.trim()) return;
    onCreateCharacter({
      id: uid(),
      name: name.trim(),
      persona: persona.trim(),
      referenceUrls: refUrl.trim() ? [refUrl.trim()] : [],
    });
    setName("");
    setPersona("");
    setRefUrl("");
    setDrafting(false);
  };

  return (
    <section
      aria-label="Character locker"
      className="flex flex-col gap-2 border-r border-[color:var(--color-border)] bg-[color:var(--hc-surface-recessed)]/40 p-3"
    >
      <header className="flex items-center justify-between">
        <h3 className="hc-serif-headline text-[13px] font-semibold tracking-tight">
          Different Scenes, Same Star
        </h3>
        <button
          type="button"
          onClick={() => setDrafting((d) => !d)}
          aria-label="Add character"
          className="hc-glass inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/60 hover:bg-white/80"
        >
          <UserPlus size={12} />
        </button>
      </header>

      <p className="text-[11px] leading-snug text-[color:var(--color-muted-foreground)]">
        Build your character. One click does the rest. Identity drift is possible
        in v1 — references + persona are appended to every prompt.
      </p>

      {drafting ? (
        <div className="hc-glass flex flex-col gap-1.5 rounded-md border border-[color:var(--color-border)] bg-white/60 p-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name"
            className="rounded border border-[color:var(--color-border)] bg-white/80 px-2 py-1 text-[11px] outline-none"
          />
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Persona (e.g. wide-eyed Tokyo skater, neon palette)"
            rows={2}
            className="rounded border border-[color:var(--color-border)] bg-white/80 px-2 py-1 text-[11px] outline-none"
          />
          <input
            type="url"
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            placeholder="Reference image URL (optional)"
            className="rounded border border-[color:var(--color-border)] bg-white/80 px-2 py-1 text-[11px] outline-none"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setDrafting(false)}
              className="rounded px-2 py-1 text-[11px] text-[color:var(--color-muted-foreground)] hover:bg-white/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || !persona.trim()}
              className="rounded bg-[oklch(0.66_0.18_25_/_0.85)] px-2 py-1 text-[11px] font-medium text-white hover:bg-[oklch(0.66_0.18_25)] disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {characters.length === 0 ? (
          <p className="text-[11px] italic text-[color:var(--color-muted-foreground)]">
            No characters yet.
          </p>
        ) : (
          characters.map((c) => {
            const isLocked = lockedCharacterId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleLock(isLocked ? null : c.id)}
                aria-pressed={isLocked}
                className={[
                  "hc-glass flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                  isLocked
                    ? "border-[oklch(0.66_0.18_25_/_0.6)] bg-[oklch(0.66_0.18_25_/_0.12)]"
                    : "border-[color:var(--color-border)] bg-white/60 hover:bg-white/80",
                ].join(" ")}
              >
                {isLocked ? (
                  <Lock size={12} className="text-[oklch(0.66_0.18_25)]" />
                ) : (
                  <LockOpen size={12} className="text-[color:var(--color-muted-foreground)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{c.name}</div>
                  <div className="truncate text-[10px] text-[color:var(--color-muted-foreground)]">
                    {c.persona}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

export default CharacterLocker;
