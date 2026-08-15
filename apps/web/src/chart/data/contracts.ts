/**
 * The ONE place where CHART couples to `packages/contracts` (ADR-002).
 *
 * Everything else in `src/chart/**` imports the taxonomy from here, so if the
 * curator's package specifier or export names move, exactly one file changes.
 *
 * Runtime exports: `DEPARTMENTS` (ADR-001 order — the CHART tab bar), `isDepartment`,
 * `TIERS`, `PHASES`. Nothing else from the package is imported at runtime from here.
 */

export type { Tier, Phase, DepartmentSlug } from '@agnetos/contracts';

/**
 * Ordered, per ADR-001. Index is significant: it is the tab order here and the MAP
 * branch angle order there. Never re-sort, never inline a copy.
 */
export { DEPARTMENTS, isDepartment, TIERS, PHASES } from '@agnetos/contracts';
