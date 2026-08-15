/**
 * The ONE place where CHART couples to `packages/contracts` (ADR-002).
 *
 * Everything else in `src/chart/**` imports the taxonomy from here, so if the
 * curator's package specifier or export names move, exactly one file changes.
 *
 * Runtime imports here must stay minimal: only `DEPARTMENTS` (ADR-001 — the seven
 * departments and their ORDER are the CHART tab bar, and nothing may hardcode them).
 * The tier/phase unions are `import type` only, so they erase at build time and the
 * pure model + its tests never depend on the package being present.
 */

export type { Tier, Phase, DepartmentSlug } from '@agnetos/contracts';

/**
 * Ordered, per ADR-001. Index is significant: it is the tab order here and the MAP
 * branch angle order there. Never re-sort, never inline a copy.
 */
export { DEPARTMENTS } from '@agnetos/contracts';
