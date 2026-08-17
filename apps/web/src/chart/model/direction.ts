/**
 * PROMOTED, 2026-08-17. The two functions now live in `apps/web/src/i18n/direction.ts`
 * and are exported from `@/i18n`; this file is a re-export so nothing in CHART has
 * to change, no test moves, and `REQ-CHT-47` and `comms/specs/chart-matrix.md`
 * Decision 12 keep pointing at a real path.
 *
 * The condition its author set — *"if a third caller wants them, that is the
 * moment, and the request should come with the third caller"* — was met:
 * `SegmentedControl` was the second and `dashboards/components/Carousel.tsx` is the
 * third, with the same defect still live in it. Granted by
 * `rtl-arabic-pdpl-specialist` on `shell-navigation-engineer`'s decision-request
 * (`comms/inbox/rtl-arabic-pdpl-specialist/20260817-1846-…`). New callers import
 * from `@/i18n`; this alias stays until `chart-matrix-engineer` chooses otherwise,
 * and deleting it is theirs to do.
 */
export { elementDirection, inlineStep } from '@/i18n';

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

/* The two functions themselves are at the top of this file as a re-export. They
 * were moved rather than copied: two copies of one rule is what let this bug exist
 * in three components at once, which is the whole finding above. */
