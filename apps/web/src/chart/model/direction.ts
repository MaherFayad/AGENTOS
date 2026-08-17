import type { Direction } from '@/i18n';

/**
 * Which way is "next" when the user presses ArrowRight.
 *
 * ---
 *
 * **Why this file exists.** `DepartmentTabs` mapped `ArrowRight` to `+1` unconditionally.
 * Under `dir="rtl"` the tab bar is a flex row, so it reverses on its own and Sales sits at
 * the far *right* — but the key handler did not reverse with it, so ArrowRight walked
 * towards the tab the user could see on their left. The tablist arrow keys have therefore
 * been running backwards in Arabic since the bar was written, at seven tabs; it was never
 * an eighth-department problem. It went uncaught because REQ-CHT-04's verification was
 * manual and the manual pass has only ever been run LTR — and a check that has never been
 * run in one of the two directions the product ships in is not a check.
 *
 * `MIRRORS['shell.segmentedControl']` (i18n/direction.ts) is the governing rule and it is
 * about the whole class, not one component: *"tab order is reading order."* The department
 * bar is the same object one level down.
 *
 * **And the rule that says where this must NOT be applied.** The matrix grid's arrow keys
 * (`model/keyboard.ts`) stay direction-blind on purpose:
 * `DOES_NOT_MIRROR['chart.phaseColumns']` — *"§2.6 — the rollout matrix columns are phases
 * 1→4, i.e. time"*, and time does not reverse because the page does. The test for whether
 * an arrow key flips is the same one that decides whether the pixels flip: reading order
 * mirrors, space and time do not. Applying this helper to the grid would be a second bug,
 * not a completion of this fix.
 *
 * Owner: chart-matrix-engineer · consumes `rtl-arabic-pdpl-specialist`'s §1.4 direction
 * contract, which is the one place that says which surfaces mirror.
 */

/**
 * The element's effective direction, by HTML's own rule: the nearest ancestor carrying a
 * `dir` attribute wins, and the document element is the last one in that chain.
 *
 * Read from the DOM rather than from `useI18n()` for two reasons, and the second is the
 * load-bearing one. (a) `useI18n()` throws outside its provider, so it would break every
 * bare-render test of this component — the same objection that sent CHART to
 * `useProjectSegment()` instead of `useShell()`. (b) A component's keys should follow the
 * direction it is actually *rendered* in, not the app's locale: §2.5 and §3.1 both put LTR
 * islands inside the RTL page, and a bar rendered inside one of those must key LTR.
 *
 * `dir="auto"` resolves per text run and cannot be computed here, so it reads as `ltr` —
 * stated rather than silently assumed. No surface in this app sets it.
 */
export function elementDirection(element: Element | null | undefined): Direction {
  const owner = element?.closest('[dir]');
  return owner?.getAttribute('dir')?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * ArrowRight / ArrowLeft → a step along the *list*, once the reading direction is known.
 * `0` for every other key, so the caller lets it bubble.
 *
 * Pure, so the direction half of the behaviour is provable without a DOM; the component
 * test then proves the DOM half under a real `dir="rtl"` render.
 */
export function inlineStep(key: string, direction: Direction): -1 | 0 | 1 {
  const forward = direction === 'rtl' ? -1 : 1;
  if (key === 'ArrowRight') return forward;
  if (key === 'ArrowLeft') return direction === 'rtl' ? 1 : -1;
  return 0;
}
