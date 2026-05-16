import Link from "next/link";
import { notFound } from "next/navigation";

import { SpaceSteps } from "@/components/spaces/SpaceSteps";
import { SPACE_TEMPLATES, getSpaceById } from "@/components/spaces/templates";

interface SpaceDetailPageProps {
  params: { id: string };
}

export function generateStaticParams(): { id: string }[] {
  return SPACE_TEMPLATES.map((s) => ({ id: s.id }));
}

export function generateMetadata({
  params,
}: SpaceDetailPageProps): { title: string } {
  const space = getSpaceById(params.id);
  return {
    title: space ? `${space.name} — Spaces` : "Space — Creative Intelligence Engine",
  };
}

export default function SpaceDetailPage({
  params,
}: SpaceDetailPageProps) {
  const space = getSpaceById(params.id);
  if (!space) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/spaces" className="hover:text-foreground">
          ← All spaces
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hc-accent-coral)]">
          {space.name}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          New {space.name.toLowerCase()}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {space.description}
        </p>
      </header>

      <SpaceSteps
        space={{
          id: space.id,
          name: space.name,
          description: space.description,
          defaultPrompt: space.defaultPrompt,
        }}
      />
    </div>
  );
}
