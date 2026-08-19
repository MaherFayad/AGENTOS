'use client';

/**
 * `WORK PRODUCTS` — the roster, in the same visual grammar as the rest of the drawer.
 *
 * **One route for N runs.** `GET /api/p/:project/work-products` answers the whole list, and
 * with `?review=true` the review queue — which is *a query, not a table*: there is no
 * `ops.review` and there will not be one (§5.2). A roster assembled from one route per row
 * is a spinner, and every part of it is individually correct so no test catches it (§7).
 *
 * **The empty state is the state a human will actually see**, and it is written for that
 * rather than around it. Two preconditions are missing, not one: no agent run has ever
 * executed, and no project has a checked-out repository a run could work in. So this list is
 * empty because nothing has happened — not because a filter narrowed it — and the sentence
 * says which. An honest empty state beats a plausible fake one (rule 9), and here the
 * plausible fake would be a row.
 *
 * **Project-scoped, and it says so.** The route carries no per-agent filter, so this section
 * inside an agent's drawer is showing the project's newest work products, not this agent's.
 * The alternative — filtering client-side — silently shows four rows for a busy project,
 * which is the exact defect `fetchRuns` documents avoiding. A `decision-request` for
 * `?agent=` is open with `runner-engineer`; until it is answered, the scope is disclosed.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.1, §5.2, §7
 */

import { DEFAULT_LOCALE, translate, type StringKey, type Vars } from '@/i18n';
import type { ThreadState, WorkProductSummary } from '@agnetos/contracts';
import s from '../drawer.module.css';
import { RosterLine } from './RosterLine';

const t = (key: StringKey, vars?: Vars): string => translate(DEFAULT_LOCALE, key, vars);

export type WorkProductsState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: WorkProductSummary[]; reviewQueue: boolean }
  | { kind: 'failed'; message: string };

export interface WorkProductsProps {
  state: WorkProductsState;
  /** Which list is being asked for — not which list came back. `state.reviewQueue` is that. */
  review: boolean;
  onReviewFilter: (review: boolean) => void;
  onOpenDiff: (summary: WorkProductSummary) => void;
  /** `null` when the address bar names no project, so there is no thread page to link at. */
  threadHref: (threadId: string) => string | null;
  /** Thread states we actually learned, by run id. Absent ⇒ no `blocked` claim is made. */
  threadStates?: Readonly<Record<string, ThreadState | null>>;
  now?: number;
}

export function WorkProducts({
  state,
  review,
  onReviewFilter,
  onOpenDiff,
  threadHref,
  threadStates,
  now,
}: WorkProductsProps) {
  const filters = (
    <div className={s.workFilters} role="group">
      <button
        type="button"
        className={`${s.chip} ${s.workFilter}`}
        aria-pressed={!review}
        onClick={() => onReviewFilter(false)}
      >
        {t('work.filter.all')}
      </button>
      <button
        type="button"
        className={`${s.chip} ${s.workFilter}`}
        aria-pressed={review}
        onClick={() => onReviewFilter(true)}
      >
        {t('work.filter.review')}
      </button>
    </div>
  );

  if (state.kind === 'loading') {
    return (
      <>
        {filters}
        <p className={s.empty}>{t('work.loading')}</p>
      </>
    );
  }

  if (state.kind === 'failed') {
    return (
      <>
        {filters}
        <p className={s.empty}>
          {t('work.failed')} {state.message}
        </p>
      </>
    );
  }

  if (state.rows.length === 0) {
    // Two different empties. `reviewQueue` comes off the response, not off the request:
    // what narrowed the list is the server's answer about what it did, and reading the
    // local flag instead would describe an intention rather than an observation.
    return (
      <>
        {filters}
        <p className={s.empty}>{state.reviewQueue ? t('work.emptyReview') : t('work.empty')}</p>
      </>
    );
  }

  return (
    <>
      {filters}
      <div className={s.workList}>
        {state.rows.map((row) => (
          <RosterLine
            key={row.runId}
            summary={row}
            {...(now === undefined ? {} : { now })}
            {...(threadStates && row.runId in threadStates
              ? { threadState: threadStates[row.runId] }
              : {})}
            onReview={onOpenDiff}
            threadHref={threadHref(row.threadId)}
          />
        ))}
      </div>
      <p className={s.sectionNote}>{t('work.scopeNote')}</p>
    </>
  );
}
