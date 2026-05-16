"use client";

export type StudioFormat = "reel" | "square" | "story" | "banner" | "carousel";

interface FormatOption {
  id: StudioFormat;
  label: string;
  aspect: string;
  hint: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { id: "reel", label: "Reel", aspect: "9:16", hint: "Short-form vertical video" },
  { id: "square", label: "Square", aspect: "1:1", hint: "Feed image / static ad" },
  { id: "story", label: "Story", aspect: "9:16", hint: "Ephemeral vertical" },
  { id: "banner", label: "Banner", aspect: "16:9", hint: "Display / hero" },
  { id: "carousel", label: "Carousel", aspect: "1:1×N", hint: "Multi-card sequence" },
];

interface FormatPickerProps {
  value: StudioFormat;
  onChange: (next: StudioFormat) => void;
}

/**
 * Five segmented pills. Selected = coral fill, unselected = glass.
 * Aspect ratio sits as a tiny mono caption beside the label so the
 * picker doubles as a Sora-2-style preset reference.
 */
export function FormatPicker({ value, onChange }: FormatPickerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="radiogroup"
      aria-label="Output format"
      data-testid="cie-format-picker"
    >
      {FORMAT_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            title={opt.hint}
            className={[
              "hc-pill group inline-flex items-center gap-2 px-3.5 py-1.5 text-sm transition-all duration-200",
              "border",
              active
                ? "border-transparent bg-[color:var(--hc-accent-coral)] text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)]"
                : "hc-glass border-[color:var(--color-border)] text-foreground hover:border-[color:var(--hc-accent-coral)]",
            ].join(" ")}
          >
            <span className="font-medium">{opt.label}</span>
            <span
              className={[
                "font-mono text-[10px] uppercase tracking-wider",
                active ? "opacity-80" : "text-muted-foreground",
              ].join(" ")}
            >
              {opt.aspect}
            </span>
          </button>
        );
      })}
    </div>
  );
}
