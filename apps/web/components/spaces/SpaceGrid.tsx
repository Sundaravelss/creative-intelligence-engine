"use client";

import { SpaceCard } from "./SpaceCard";
import { SPACE_TEMPLATES } from "./templates";

// Re-export for convenience so existing imports keep working.
export {
  SPACE_TEMPLATES,
  getSpaceById,
  type SpaceTemplate,
} from "./templates";

export function SpaceGrid() {
  return (
    <div
      data-testid="cie-space-grid"
      className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {SPACE_TEMPLATES.map((s) => (
        <SpaceCard
          key={s.id}
          id={s.id}
          name={s.name}
          description={s.description}
          icon={s.icon}
          gradient={s.gradient}
        />
      ))}
    </div>
  );
}
