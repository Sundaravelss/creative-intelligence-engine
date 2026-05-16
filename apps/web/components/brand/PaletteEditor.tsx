"use client";

import { useId } from "react";

interface PaletteEditorProps {
  palette: string[];
  onChange: (next: string[]) => void;
  /** Number of swatches to show. Defaults to 4. */
  slots?: number;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function PaletteEditor({ palette, onChange, slots = 4 }: PaletteEditorProps) {
  const baseId = useId();
  const swatches: string[] = Array.from({ length: slots }, (_, i) => palette[i] ?? "#FFFFFF");

  const updateAt = (index: number, value: string): void => {
    // Always emit a new array — never mutate.
    const next = swatches.map((c, i) => (i === index ? value : c));
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {swatches.map((color, i) => {
        const valid = isValidHex(color);
        const inputId = `${baseId}-swatch-${i}`;
        return (
          <div key={inputId} className="hc-card flex flex-col items-stretch p-3">
            <div
              className="mb-2 h-16 w-full rounded-md border"
              style={{ background: valid ? color : "transparent" }}
              aria-label={`Color swatch ${i + 1}`}
            />
            <div className="flex items-center gap-2">
              <input
                aria-label={`Swatch ${i + 1} color picker`}
                type="color"
                value={valid ? color : "#ffffff"}
                onChange={(e) => updateAt(i, e.target.value.toUpperCase())}
                className="h-8 w-8 cursor-pointer rounded border"
              />
              <input
                id={inputId}
                aria-label={`Swatch ${i + 1} hex value`}
                type="text"
                value={color}
                onChange={(e) => updateAt(i, e.target.value)}
                spellCheck={false}
                className={`w-full rounded border px-2 py-1 text-sm font-mono ${
                  valid ? "" : "border-destructive text-destructive"
                }`}
                placeholder="#RRGGBB"
              />
            </div>
            {!valid ? (
              <span className="mt-1 text-xs text-destructive">Invalid hex</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default PaletteEditor;
