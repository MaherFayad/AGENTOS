import type { GridPos } from '../types';
import { COL_COUNT, ROW_COUNT } from './taxonomy';

/**
 * Roving-focus movement across the matrix. Pure function, no DOM — the component owns
 * `.focus()`, this owns *where*.
 *
 * The spatial model matches what the eye sees: job cards stack vertically inside a cell,
 * so ArrowDown walks the cards in the current cell before dropping to the next tier row.
 * Left/Right always change phase column. Nothing wraps — the edges of a rollout board are
 * meaningful, and wrapping loses that.
 */

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

/** Focusable items in a cell: its cards, or the single empty-cell block (still focusable —
 *  §2.6.6 empty cells carry information, so they are not skipped by the keyboard). */
const itemsIn = (counts: readonly (readonly number[])[], row: number, col: number) =>
  Math.max(1, counts[row]?.[col] ?? 0);

const lastItem = (counts: readonly (readonly number[])[], row: number, col: number) =>
  itemsIn(counts, row, col) - 1;

/**
 * @returns the next position, or `null` when the key is not a grid key (let it bubble).
 */
export function moveGridFocus(
  pos: GridPos,
  key: string,
  counts: readonly (readonly number[])[],
): GridPos | null {
  const row = clamp(pos.row, ROW_COUNT - 1);
  const col = clamp(pos.col, COL_COUNT - 1);
  const item = clamp(pos.item, lastItem(counts, row, col));

  /** At an edge the focus holds still — it never silently jumps to another card. */
  const stay: GridPos = { row, col, item };

  switch (key) {
    case 'ArrowRight':
      return col + 1 > COL_COUNT - 1 ? stay : { row, col: col + 1, item: 0 };
    case 'ArrowLeft':
      return col - 1 < 0 ? stay : { row, col: col - 1, item: 0 };
    case 'ArrowDown': {
      if (item + 1 < itemsIn(counts, row, col)) return { row, col, item: item + 1 };
      return row + 1 > ROW_COUNT - 1 ? stay : { row: row + 1, col, item: 0 };
    }
    case 'ArrowUp': {
      if (item - 1 >= 0) return { row, col, item: item - 1 };
      return row - 1 < 0 ? stay : { row: row - 1, col, item: lastItem(counts, row - 1, col) };
    }
    case 'Home':
      return { row, col: 0, item: 0 };
    case 'End':
      return { row, col: COL_COUNT - 1, item: 0 };
    default:
      return null;
  }
}

/** Enter and Space expand/collapse the focused card (§2.6.4). */
export const isExpandKey = (key: string): boolean => key === 'Enter' || key === ' ';

export const samePos = (a: GridPos, b: GridPos): boolean =>
  a.row === b.row && a.col === b.col && a.item === b.item;

/** Stable DOM id for a focusable grid item, so focus can be restored after a re-render. */
export const posId = (pos: GridPos): string => `chart-cell-${pos.row}-${pos.col}-${pos.item}`;
