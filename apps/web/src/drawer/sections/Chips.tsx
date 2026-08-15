'use client';

/**
 * §2.3 items 5 and 7, and §2.6.5's TOOLS row.
 *
 *   BREAKS INTO — 11px chips, 1px border, 6px radius. Clicking one flies the map to that
 *                 leaf node: it goes out on the shell bus as `shell:flyTo` with
 *                 `source: 'chip'`, which `src/lib/shell-bus.ts` already defines.
 *   BUILDS ON   — the same chip with a dashed border, linking the prerequisite agent.
 *   TOOLS       — static chips, nothing to click.
 *
 * Owner: drawer-engineer · Consumes: src/lib/shell-bus.ts (owner: shell-navigation-engineer)
 */

import { DURATION } from '../primitives';
import { emit } from '@/lib/shell-bus';
import { openDrawer } from '../events';
import type { ChipRef } from '../data/project';
import s from '../drawer.module.css';

/** BREAKS INTO — chip click centres the map on that leaf node. */
export function BreaksIntoChips({ items }: { items: ChipRef[] }) {
  return (
    <div className={s.chips}>
      {items.map((item) => (
        <button
          key={item.nodeId}
          type="button"
          className={s.chip}
          title={`Show ${item.label} on the map`}
          onClick={() =>
            emit('shell:flyTo', {
              target: { kind: 'node', id: item.nodeId, department: item.department },
              source: 'chip',
              durationMs: DURATION.zoom,
            })
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** BUILDS ON — dashed chip; opening it swaps the drawer to the prerequisite agent. */
export function BuildsOnChips({ items }: { items: ChipRef[] }) {
  return (
    <div className={s.chips}>
      {items.map((item) => (
        <button
          key={item.nodeId}
          type="button"
          className={`${s.chip} ${s.chipDashed}`}
          title={`Open ${item.label}`}
          onClick={() => {
            emit('shell:flyTo', {
              target: { kind: 'node', id: item.nodeId, department: item.department },
              source: 'chip',
              durationMs: DURATION.zoom,
            });
            if (item.agentSlug) openDrawer({ slug: item.agentSlug });
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** §2.6.5 TOOLS — the same names as WIRED INTO, drawn as chips instead of a list. */
export function ToolChips({ tools }: { tools: string[] }) {
  return (
    <div className={s.chips}>
      {tools.map((tool) => (
        <span key={tool} className={`${s.chip} ${s.chipStatic}`}>
          {tool}
        </span>
      ))}
    </div>
  );
}
