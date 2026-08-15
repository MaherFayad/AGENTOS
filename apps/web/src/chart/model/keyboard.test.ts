import { describe, expect, it } from 'vitest';
import { isExpandKey, moveGridFocus, posId, samePos } from './keyboard';
import { buildMatrix, cellCounts } from './matrix';
import { marketingAgents } from './__fixtures__/agents';

/** counts = [[1,0,1,0], [0,1,2,0], [2,2,1,2]] for the marketing fixture. */
const counts = cellCounts(buildMatrix(marketingAgents));

const at = (row: number, col: number, item = 0) => ({ row, col, item });

describe('moveGridFocus (REQ-CHT-34)', () => {
  it('matches the fixture layout it is reasoning about', () => {
    expect(counts).toEqual([
      [1, 0, 1, 0],
      [0, 1, 2, 0],
      [2, 2, 1, 2],
    ]);
  });

  it('moves right and left between phase columns', () => {
    expect(moveGridFocus(at(0, 0), 'ArrowRight', counts)).toEqual(at(0, 1));
    expect(moveGridFocus(at(0, 1), 'ArrowLeft', counts)).toEqual(at(0, 0));
  });

  it('stops at the edges instead of wrapping — the ends of a rollout are meaningful', () => {
    expect(moveGridFocus(at(0, 3), 'ArrowRight', counts)).toEqual(at(0, 3));
    expect(moveGridFocus(at(0, 0), 'ArrowLeft', counts)).toEqual(at(0, 0));
    expect(moveGridFocus(at(0, 0), 'ArrowUp', counts)).toEqual(at(0, 0));
    expect(moveGridFocus(at(2, 0), 'ArrowDown', counts)).toEqual(at(2, 0, 1));
    expect(moveGridFocus(at(2, 0, 1), 'ArrowDown', counts)).toEqual(at(2, 0, 1));
  });

  it('walks the stacked cards inside a cell before dropping to the next tier', () => {
    expect(moveGridFocus(at(1, 2, 0), 'ArrowDown', counts)).toEqual(at(1, 2, 1));
    expect(moveGridFocus(at(1, 2, 1), 'ArrowDown', counts)).toEqual(at(2, 2, 0));
  });

  it('lands on the LAST card of the cell above when moving up', () => {
    expect(moveGridFocus(at(2, 2, 0), 'ArrowUp', counts)).toEqual(at(1, 2, 1));
  });

  it('treats an empty cell as one focusable stop — empty cells are information', () => {
    expect(moveGridFocus(at(0, 1), 'ArrowDown', counts)).toEqual(at(1, 1, 0));
    expect(moveGridFocus(at(1, 1), 'ArrowUp', counts)).toEqual(at(0, 1, 0));
  });

  it('resets to the first card when changing column', () => {
    expect(moveGridFocus(at(2, 0, 1), 'ArrowRight', counts)).toEqual(at(2, 1, 0));
  });

  it('jumps to the first and last phase with Home and End', () => {
    expect(moveGridFocus(at(1, 2, 1), 'Home', counts)).toEqual(at(1, 0));
    expect(moveGridFocus(at(1, 0), 'End', counts)).toEqual(at(1, 3));
  });

  it('returns null for keys it does not own, so they keep bubbling', () => {
    for (const key of ['Tab', 'Escape', 'a', 'PageDown']) {
      expect(moveGridFocus(at(0, 0), key, counts)).toBeNull();
    }
  });

  it('clamps a stale position rather than throwing', () => {
    expect(moveGridFocus(at(9, 9, 9), 'ArrowLeft', counts)).toEqual(at(2, 2, 0));
  });
});

describe('expansion keys and identity', () => {
  it('expands on Enter and Space (REQ-CHT-35)', () => {
    expect(isExpandKey('Enter')).toBe(true);
    expect(isExpandKey(' ')).toBe(true);
    expect(isExpandKey('ArrowDown')).toBe(false);
  });

  it('compares positions and derives a stable dom id', () => {
    expect(samePos(at(1, 2, 1), at(1, 2, 1))).toBe(true);
    expect(samePos(at(1, 2, 1), at(1, 2, 0))).toBe(false);
    expect(posId(at(1, 2, 1))).toBe('chart-cell-1-2-1');
  });
});
