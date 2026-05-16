"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  adReferenceNodeSchema,
  nodeKindByName,
  type AdReferenceNodeData,
} from "@cie/canvas-nodes";
import { NodeShell, NodeField } from "./NodeShell";

function AdReferenceNodeInner({ data, selected }: NodeProps<AdReferenceNodeData>) {
  const safe = adReferenceNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  const extractedKeys =
    d.extracted && typeof d.extracted === "object"
      ? Object.keys(d.extracted as Record<string, unknown>).length
      : 0;

  return (
    <NodeShell meta={nodeKindByName.adReference} selected={selected}>
      <NodeField label="URL" value={d.url} />
      <NodeField
        label="Extract"
        value={extractedKeys > 0 ? `${extractedKeys} fields` : undefined}
      />
    </NodeShell>
  );
}

export const AdReferenceNode = memo(AdReferenceNodeInner);
