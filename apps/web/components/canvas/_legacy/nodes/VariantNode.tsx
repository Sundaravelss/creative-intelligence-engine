"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  variantNodeSchema,
  nodeKindByName,
  type VariantNodeData,
} from "@cie/canvas-nodes";
import { ArtifactRenderer, type ImageArtifact } from "@cie/ui-artifacts";
import { NodeShell, NodeField } from "./NodeShell";

function VariantNodeInner({ id, data, selected }: NodeProps<VariantNodeData>) {
  const safe = variantNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  // Variants default-render as image unless explicit type is later added.
  const artifact: ImageArtifact | null = d.artifactUrl
    ? {
        id: `${id}-art`,
        type: "image",
        name: d.label ?? "variant",
        url: d.artifactUrl,
      }
    : null;

  return (
    <NodeShell meta={nodeKindByName.variant} selected={selected}>
      {artifact && (
        <div className="-mx-3 -mt-2 mb-1 overflow-hidden">
          <ArtifactRenderer artifact={artifact} className="aspect-square w-full object-cover" />
        </div>
      )}
      <NodeField label="Label" value={d.label} />
      <NodeField label="Source" value={d.artifactId} />
    </NodeShell>
  );
}

export const VariantNode = memo(VariantNodeInner);
