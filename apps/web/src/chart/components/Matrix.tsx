'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEventHandler } from 'react';
import { openDrawer, type OpenDrawerHandler } from '../events';
import { isExpandKey, moveGridFocus, posId, samePos } from '../model/keyboard';
import { cellCounts } from '../model/matrix';
import { PHASE_COLUMNS, TIER_ROWS } from '../model/taxonomy';
import type { ChartMatrix, GridPos } from '../types';
import { MatrixCell } from './MatrixCell';
import { MatrixCorner, PhaseColumnHeader, TierRowHeader } from './MatrixHeaders';

/** Row header column + four equal phase columns. Dense on purpose (§2.6). */
const GRID_COLUMNS = 'minmax(190px, 220px) repeat(4, minmax(0, 1fr))';

export interface MatrixProps {
  matrix: ChartMatrix;
  /** e.g. "Marketing" — used for the grid's accessible name. */
  departmentLabel: string;
  /** Optional direct handler; otherwise the drawer event is dispatched (§2.6.5). */
  onOpenDrawer?: OpenDrawerHandler;
}

/**
 * §2.6.3 — the rollout board itself: 3 autonomy tiers × 4 rollout phases.
 *
 * Keyboard model (a real grid, not a div soup): roving tabindex over the focusable item
 * in each cell, arrows move, Enter/Space expand the focused card via its native button.
 */
export function Matrix({ matrix, departmentLabel, onOpenDrawer }: MatrixProps) {
  const [focus, setFocus] = useState<GridPos>({ row: 0, col: 0, item: 0 });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  /** True only for focus changes the keyboard caused, so the grid never steals focus. */
  const movedByKeyboard = useRef(false);

  const counts = useMemo(() => cellCounts(matrix), [matrix]);

  useEffect(() => {
    if (!movedByKeyboard.current) return;
    movedByKeyboard.current = false;
    document.getElementById(posId(focus))?.focus();
  }, [focus]);

  const onKeyDown = useCallback<KeyboardEventHandler<HTMLElement>>(
    (event) => {
      const next = moveGridFocus(focus, event.key, counts);
      if (next) {
        event.preventDefault();
        if (!samePos(next, focus)) {
          movedByKeyboard.current = true;
          setFocus(next);
        }
        return;
      }
      // Space on a hatch block would scroll the page; an empty cell has nothing to expand.
      if (isExpandKey(event.key) && counts[focus.row]?.[focus.col] === 0) event.preventDefault();
    },
    [counts, focus],
  );

  const onFocusItem = useCallback(
    (pos: GridPos) => setFocus((prev) => (samePos(prev, pos) ? prev : pos)),
    [],
  );

  const onToggle = useCallback((slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });
  }, []);

  const onMoreDetail = useCallback(
    (slug: string) => openDrawer(slug, { side: 'right', handler: onOpenDrawer }),
    [onOpenDrawer],
  );

  return (
    <>
      <p id="chart-grid-help" className="sr-only">
        Arrow keys move between cells. Enter expands a job card. A hatched cell means no job
        runs at that autonomy tier in that rollout phase yet.
      </p>
      <div
        role="grid"
        aria-label={`${departmentLabel} rollout matrix — autonomy tier by rollout phase`}
        aria-describedby="chart-grid-help"
        data-testid="chart-matrix"
        className="overflow-hidden rounded-[14px] border-l border-t border-line"
      >
        <div role="row" className="grid" style={{ gridTemplateColumns: GRID_COLUMNS }}>
          <MatrixCorner />
          {PHASE_COLUMNS.map((column, i) => (
            <PhaseColumnHeader key={column.phase} column={column} progress={matrix.phaseProgress[i]} />
          ))}
        </div>

        {TIER_ROWS.map((row, rowIndex) => (
          <div
            key={row.tier}
            role="row"
            className="grid"
            style={{ gridTemplateColumns: GRID_COLUMNS }}
          >
            <TierRowHeader row={row} count={matrix.tierCounts[rowIndex]} />
            {matrix.cells[rowIndex].map((cell) => (
              <MatrixCell
                key={`${cell.tier}-${cell.phase}`}
                cell={cell}
                focus={focus}
                expanded={expanded}
                onToggle={onToggle}
                onMoreDetail={onMoreDetail}
                onFocusItem={onFocusItem}
                onKeyDown={onKeyDown}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
