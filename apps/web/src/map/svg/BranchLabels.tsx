'use client';

import type { GraphDepartment, GraphNode } from '@agnetos/contracts';
import { branchLabels } from '../lib/branches';
import { BRANCH_LABEL, BRANCH_SUBLABEL } from '../lib/map-type';

export function BranchLabels({
  departments,
  nodes,
  focusDepartment,
  onActivate,
}: {
  departments: readonly GraphDepartment[];
  nodes: readonly GraphNode[];
  focusDepartment?: string | null;
  onActivate: (department: string) => void;
}): React.JSX.Element {
  const labels = branchLabels(departments, nodes);

  return (
    <g>
      {labels.map((placed) => {
        const dimmed = focusDepartment !== null && focusDepartment !== undefined && placed.department !== focusDepartment;
        return (
          <g
            key={placed.department}
            transform={`translate(${placed.x} ${placed.y})`}
            opacity={dimmed ? 0.22 : 1}
            className="cursor-pointer transition-opacity duration-zoom ease-zoom"
            role="button"
            tabIndex={0}
            aria-label={`${placed.label} department`}
            onClick={(event) => {
              event.stopPropagation();
              onActivate(placed.department);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onActivate(placed.department);
            }}
          >
            <text
              textAnchor={placed.anchor}
              fontFamily="var(--font-serif)"
              fontSize={BRANCH_LABEL.size}
              letterSpacing={BRANCH_LABEL.tracking}
              fill="var(--ivory-2)"
              className="pointer-events-none select-none uppercase"
            >
              {placed.label}
            </text>
            {placed.sublabels.map((line, index) => (
              <text
                key={`${placed.department}-sub-${index}`}
                y={BRANCH_SUBLABEL.row * (index + 1) + 4}
                textAnchor={placed.anchor}
                fontFamily="var(--font-sans)"
                fontSize={BRANCH_SUBLABEL.size}
                letterSpacing={BRANCH_SUBLABEL.tracking}
                fill="var(--ink-3)"
                className="pointer-events-none select-none"
              >
                {line}
              </text>
            ))}
            <title>{placed.label}</title>
          </g>
        );
      })}
    </g>
  );
}
