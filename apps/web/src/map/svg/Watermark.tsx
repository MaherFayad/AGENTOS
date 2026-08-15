'use client';

import type { GraphNode } from '@agnetos/contracts';
import { departmentCentre } from '../lib/branches';
import { WATERMARK } from '../lib/map-type';

/**
 * §2.2 — giant Instrument Serif department name behind the graph. Opacity is the
 * token `--ivory` at 5%; no new colour.
 */
export function Watermark({
  nodes,
  department,
  label,
}: {
  nodes: readonly GraphNode[];
  department: string;
  label: string;
}): React.JSX.Element | null {
  const centre = departmentCentre(nodes, department);
  if (!centre) return null;

  return (
    <text
      x={centre.x}
      y={centre.y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="var(--font-serif)"
      fontStyle="italic"
      fontSize={WATERMARK.size}
      letterSpacing={WATERMARK.tracking}
      fill="var(--ivory)"
      fillOpacity={WATERMARK.opacity}
      className="pointer-events-none select-none uppercase"
      aria-hidden="true"
    >
      {label}
    </text>
  );
}
