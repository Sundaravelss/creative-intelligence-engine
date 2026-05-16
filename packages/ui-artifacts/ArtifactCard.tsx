import type { ReactNode } from "react";
import { Maximize2, FileText, Image as ImageIcon, Video, Layers, Table, Code, Globe } from "lucide-react";
import { cn } from "./shared/cn";
import type { Artifact, ArtifactType } from "./types";

interface ArtifactCardProps {
  artifact: Artifact;
  children: ReactNode;
  onExpand?: () => void;
  className?: string;
  isActive?: boolean;
}

const TYPE_LABEL: Record<ArtifactType, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  slides: "Slides",
  table: "Table",
  code: "Code",
  webpage: "Webpage",
};

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

export function ArtifactCard({
  artifact,
  children,
  onExpand,
  className,
  isActive,
}: ArtifactCardProps) {
  return (
    <article
      className={cn(
        "hc-card flex flex-col h-full overflow-hidden hc-snap-center",
        isActive ? "ring-1 ring-[color:var(--hc-accent-coral-soft)]" : "",
        className,
      )}
      aria-current={isActive}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[color:var(--color-border,oklch(0.92_0_0))]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hc-pill px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[color:var(--hc-accent-coral-soft)] text-[color:var(--hc-accent-coral)] flex items-center gap-1">
            <TypeIcon type={artifact.type} className="h-3 w-3" />
            {TYPE_LABEL[artifact.type]}
          </span>
          <h3 className="text-sm font-medium truncate">{artifact.name}</h3>
        </div>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="hc-pill p-1.5 hover:bg-[oklch(0.96_0_0)] transition-colors"
            aria-label="Expand artifact"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6">{children}</div>
    </article>
  );
}
