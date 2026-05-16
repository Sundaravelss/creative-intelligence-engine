"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  audienceNodeSchema,
  nodeKindByName,
  type AudienceNodeData,
} from "@cie/canvas-nodes";
import { NodeShell, NodeField } from "./NodeShell";

function AudienceNodeInner({ data, selected }: NodeProps<AudienceNodeData>) {
  const safe = audienceNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : {};

  return (
    <NodeShell meta={nodeKindByName.audience} selected={selected}>
      <NodeField label="Who" value={d.description} />
      <NodeField label="Demo" value={d.demographics} />
      <NodeField label="Psycho" value={d.psychographics} />
    </NodeShell>
  );
}

export const AudienceNode = memo(AudienceNodeInner);
