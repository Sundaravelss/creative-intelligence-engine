import { FileText, Image as ImageIcon, Video, Layers, Table, Code, Globe } from "lucide-react";
import { cn } from "./shared/cn";
import type { Artifact, ArtifactType } from "./types";

interface ArtifactReferenceChipProps {
  artifact: Pick<Artifact, "id" | "name" | "type">;
  onFocus: (id: string) => void;
  className?: string;
}

function TypeIcon({ type, className }: { type: ArtifactType; className?: string }) {
  switch (type) {
    case "document":
      return <FileText className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Video className={className} />;
    case "slides":
      return <Layers className={className} />;
    case "table":
      return <Table className={className} />;
    case "code":
      return <Code className={className} />;
    case "webpage":
      return <Globe className={className} />;
  }
}

export function ArtifactReferenceChip({
  artifact,
  onFocus,
  className,
}: ArtifactReferenceChipProps) {
  return (
    <button
      type="button"
      onClick={() => onFocus(artifact.id)}
      className={cn(
        "group inline-flex items-center gap-2 hc-card hc-pill px-3 py-2 text-left max-w-full",
        "border border-[color:var(--color-border,oklch(0.92_0_0))]",
        "hover:border-[color:var(--hc-accent-coral)] transition-colors",
        className,
      )}
      aria-label={`Open ${artifact.name} in canvas`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--hc-accent-coral-soft)] text-[color:var(--hc-accent-coral)]">
        <TypeIcon type={artifact.type} className="h-3.5 w-3.5" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Generated {artifact.type}
        </span>
        <span className="text-sm font-medium truncate">{artifact.name}</span>
      </span>
    </button>
  );
}
