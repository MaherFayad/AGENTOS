/* =============================================================================
 * i18n/server-copy.ts — which sentence wins when the server sends one too.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, Part VII.3.
 *
 * THE PROBLEM, in one real case.
 *
 * `GET /api/cost/today` returns `ledger.hint` — a written English sentence that
 * carries live detail no static string can hold ("5 failed attempts, reconnecting
 * in 30s"). `CostTicker` renders it verbatim, and it is better than our fallback
 * *in English*. In Arabic it is an English sentence in the middle of an RTL page,
 * which is not a smaller problem than a missing retry count. It is a bigger one:
 * the reader cannot read it at all.
 *
 * The same shape appears in `useGraph` (the runner's own explanation of why the
 * layout is missing), in the drawer's run errors, and it will appear again on
 * every endpoint that ships a `hint`. So the rule lives here once rather than as
 * a ternary in each component.
 *
 * THE RULE.
 *
 *   English  → the server sentence wins when there is one. It is more specific,
 *              and specificity is the whole reason the runner writes it.
 *   Anything else → the catalogue sentence wins. A sentence the reader cannot
 *              read is not more specific, it is less.
 *
 * This is why the catalogue's `shell.cost.outage` / `shell.cost.noLedger` /
 * `map.empty.*` are written as complete standalone sentences rather than as
 * stubs that assume the hint fills in the detail — `shell-navigation-engineer`
 * wrote them that way on purpose when they filed the keys, and this file is the
 * half of that decision that was theirs to ask for and mine to make.
 *
 * WHAT THIS DOES NOT DO. It does not translate the hint, and nothing here can:
 * the hint is composed on the runner, in English, from a retry count. Localising
 * server copy means the runner sending a key and its variables instead of a
 * sentence — a change to `api-contracts.md`, owned by `runner-engineer`, filed
 * rather than assumed. Until then the Arabic reader gets the catalogue sentence,
 * which is complete and true but has no retry count in it. That is a stated
 * limitation, not a silent one, and `check-rtl.mjs` prints `server-copy` as a
 * blind spot on every run for the same reason.
 * ============================================================================= */

import { DEFAULT_LOCALE, type Locale } from './config';

/**
 * @param locale    the reader's locale
 * @param catalogue the translated sentence, already resolved through `t()`
 * @param server    the server's sentence, or null/'' when it sent none
 */
export function serverOrCatalogue(
  locale: Locale,
  catalogue: string,
  server: string | null | undefined,
): string {
  const hint = typeof server === 'string' ? server.trim() : '';
  if (hint === '') return catalogue;
  return locale === DEFAULT_LOCALE ? hint : catalogue;
}

/** True when a server sentence would be shown to this reader. For tests and audits. */
export const prefersServerCopy = (locale: Locale): boolean => locale === DEFAULT_LOCALE;
