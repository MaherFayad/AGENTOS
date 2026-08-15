'use client';

import type { KeyboardEventHandler } from 'react';
import { isEmptyCell } from '../model/matrix';
import { posId } from '../model/keyboard';
import { phaseColumn, tierRow } from '../model/taxonomy';
import type { ChartCell, GridPos } from '../types';
import { EmptyCell } from './EmptyCell';
import { JobCard } from './JobCard';

export interface MatrixCellProps {
  cell: ChartCell;
  /** Currently focused grid position — decides which item carries `tabIndex={0}`. */
  focus: GridPos;
  expanded: ReadonlySet<string>;
  onToggle: (slug: string) => void;
  onMoreDetail: (slug: string) => void;
  onFocusItem: (pos: GridPos) => void;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
}

/**
 * One tier × phase intersection. Either a stack of job cards or the §2.6.6 hatch block —
 * there is no third state, and in particular there is no "loading" shimmer pretending a
 * cell might fill in.
 */
export function MatrixCell({
  cell,
  focus,
  expanded,
  onToggle,
  onMoreDetail,
  onFocusItem,
  onKeyDown,
}: MatrixCellProps) {
  const isFocusedCell = focus.row === cell.row && focus.col === cell.col;
  const tier = tierRow(cell.tier);
  const phase = phaseColumn(cell.phase);

  return (
    <div
      role="gridcell"
      data-row={cell.row}
      data-col={cell.col}
      className="border-b border-r border-line p-1.5"
    >
      {isEmptyCell(cell) ? (
        <EmptyCell
          id={posId({ row: cell.row, col: cell.col, item: 0 })}
          tabIndex={isFocusedCell ? 0 : -1}
          tierLabel={tier.full}
          phaseLabel={phase.full}
          onFocus={() => onFocusItem({ row: cell.row, col: cell.col, item: 0 })}
          onKeyDown={onKeyDown}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {cell.agents.map((agent, item) => (
            <JobCard
              key={agent.slug}
              agent={agent}
              id={posId({ row: cell.row, col: cell.col, item })}
              tabIndex={isFocusedCell && focus.item === item ? 0 : -1}
              expanded={expanded.has(agent.slug)}
              onToggle={() => onToggle(agent.slug)}
              onMoreDetail={() => onMoreDetail(agent.slug)}
              onFocus={() => onFocusItem({ row: cell.row, col: cell.col, item })}
              onKeyDown={onKeyDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
