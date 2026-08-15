'use client';

import type { GraphNode } from '@agnetos/contracts';
import { clusterLabels } from '../lib/branches';
import { CLUSTER_LABEL } from '../lib/map-type';

export function ClusterLabels({
  nodes,
  department,
  angle,
}: {
  nodes: readonly GraphNode[];
  department: string;
  angle: number;
}): React.JSX.Element {
  const labels = clusterLabels(nodes, department, angle);

  return (
    <g aria-hidden="true">
      {labels.map((placed) => (
        <text
          key={placed.cluster}
          x={placed.x}
          y={placed.y}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={CLUSTER_LABEL.size}
          letterSpacing={CLUSTER_LABEL.tracking}
          fill="var(--ink-2)"
          className="pointer-events-none select-none uppercase"
        >
          {placed.label}
        </text>
      ))}
    </g>
  );
}
