"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  imageGenNodeSchema,
  nodeKindByName,
  type ImageGenNodeData,
} from "@cie/canvas-nodes";
import { ArtifactRenderer, type ImageArtifact } from "@cie/ui-artifacts";
import { NodeShell, NodeField } from "./NodeShell";

function ImageGenNodeInner({ id, data, selected }: NodeProps<ImageGenNodeData>) {
  const safe = imageGenNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  const artifact: ImageArtifact | null = d.artifactUrl
    ? {
        id: `${id}-art`,
        type: "image",
        name: "preview",
        url: d.artifactUrl,
      }
    : null;

  return (
    <NodeShell meta={nodeKindByName.imageGen} selected={selected}>
      {artifact && (
        <div className="-mx-3 -mt-2 mb-1 overflow-hidden rounded-t-none">
          <ArtifactRenderer artifact={artifact} className="aspect-square w-full object-cover" />
        </div>
      )}
      <NodeField label="Prompt" value={d.prompt} />
      <NodeField label="Model" value={d.model} />
      <NodeField label="Format" value={d.format} />
      <NodeField
        label="Refs"
        value={d.references && d.references.length > 0 ? `${d.references.length} attached` : undefined}
      />
    </NodeShell>
  );
}

export const ImageGenNode = memo(ImageGenNodeInner);
