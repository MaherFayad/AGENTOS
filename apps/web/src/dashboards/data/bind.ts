/**
 * `$range` binding. Tiny and import-free besides the token, so node --test can load it.
 *
 * Owner: dashboards-engineer · Spec §2.5.2
 */

import type { PanelQuery } from '@agnetos/contracts';

/** Same token as `RANGE_BINDING` in the contract — inlined so this file has no value import. */
const RANGE_BINDING = '$range';

export function bindRange(query: PanelQuery, range: string): PanelQuery {
  if (query.source === 'static') return query;
  if (query.range !== RANGE_BINDING) return query;
  return { ...query, range };
}
