/* =============================================================================
 * sessions/lib/virtual.ts — transcript windowing (spec §3.1, "virtualized")
 *
 * A long Claude Code session is tens of thousands of lines. Mounting them all
 * jank a phone into uselessness, so the transcript renders only the rows near
 * the viewport.
 *
 * Rows are variable height (a tool call is one line, a diff is forty), so this
 * keeps a measured-height cache and falls back to an estimate for rows it has
 * not seen yet. Offsets are a running prefix sum — recomputed on change, which
 * is O(n) over a few thousand numbers and nowhere near the frame budget.
 *
 * This is ~90 lines instead of a virtualization dependency because the shape of
 * the problem here is one list, one axis, top-anchored, no horizontal scrolling
 * (Part V: no component library).
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

export interface Window {
  /** First index to render. */
  start: number;
  /** One past the last index to render. */
  end: number;
  /** Pixels of spacer above `start`. */
  padTop: number;
  /** Pixels of spacer below `end`. */
  padBottom: number;
  /** Total scrollable height. */
  total: number;
}

/**
 * Prefix sums: `offsets[i]` is the top of row `i`; `offsets[count]` is the
 * total height. Rows without a measurement use `estimate`.
 */
export function buildOffsets(
  count: number,
  heights: ReadonlyMap<number, number>,
  estimate: number,
): number[] {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let i = 0; i < count; i++) {
    offsets[i + 1] = offsets[i] + (heights.get(i) ?? estimate);
  }
  return offsets;
}

/** Largest `i` with `offsets[i] <= value`, by binary search. */
function findIndex(offsets: readonly number[], value: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= value) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The slice to render for a given scroll position.
 *
 * `overscan` rows above and below absorb fast flicks — on a phone a thumb
 * throw can outrun a scroll event, and blank rows during a flick read as a
 * broken app even though nothing is broken.
 */
export function windowFor(
  offsets: readonly number[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 6,
): Window {
  const count = offsets.length - 1;
  const total = offsets[count] ?? 0;
  if (count === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0, total: 0 };

  const clamped = Math.max(0, Math.min(scrollTop, Math.max(0, total - viewportHeight)));
  const first = findIndex(offsets, clamped);
  const last = findIndex(offsets, clamped + viewportHeight);

  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + 1 + overscan);

  return {
    start,
    end,
    padTop: offsets[start],
    padBottom: Math.max(0, total - offsets[end]),
    total,
  };
}

/**
 * Should the view auto-scroll to the newest entry?
 *
 * Only when the user is already at the bottom. Yanking someone back down while
 * they are reading history is the most common way a streaming log becomes
 * unusable — and on a phone it is worse, because they cannot easily get back.
 * `threshold` is generous so momentum scrolling still counts as "at the bottom".
 */
export function isPinnedToBottom(
  scrollTop: number,
  viewportHeight: number,
  total: number,
  threshold = 48,
): boolean {
  return total - (scrollTop + viewportHeight) <= threshold;
}
