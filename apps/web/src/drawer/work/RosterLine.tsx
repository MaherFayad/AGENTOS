'use client';

/**
 * One roster line — `Plan §13`'s `● weekly-digest done · fix/auth · 3 commits · ⚠ UNPUSHED ·
 * PR #42 · CI green · 4m`, drawn from a `WorkProductSummary`.
 *
 * The line's shape comes from `rosterCells`; this file is the rendering of it, and the two
 * things it adds are both about the same hazard:
 *
 * 1. **Every cell carries `data-evidence`**, so the CSS can refuse colour to a value nothing
 *    observed and the tests can assert the grading against the contract rather than against
 *    a comment.
 * 2. **The qualifier is rendered twice, on purpose** — once per cell, as a `title` and an
 *    off-screen sentence for the reader inspecting one value, and once per line, visibly,
 *    for the reader who inspects nothing. A hover tooltip is not a disclosure on a phone.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §0, §5.1, §7
 */

import { DEFAULT_LOCALE, translate, type StringKey, type Vars } from '@/i18n';
import type { ThreadState, WorkProductSummary } from '@agnetos/contracts';
import { Pill } from '../primitives';
import s from '../drawer.module.css';
import { rosterCells, type RosterCell } from './model';

const t = (key: StringKey, vars?: Vars): string => translate(DEFAULT_LOCALE, key, vars);

function textOf(cell: RosterCell): string {
  return cell.key ? t(cell.key, cell.vars) : (cell.text ?? '');
}

export interface RosterLineProps {
  summary: WorkProductSummary;
  /** From `done.threadState`, when a live run told us. Absent on a row read from the roster. */
  threadState?: ThreadState | null;
  now?: number;
  /** Opens the diff review screen for this run. */
  onReview: (summary: WorkProductSummary) => void;
  /** `/p/:project/threads/:id`, or `null` when the address bar names no project. */
  threadHref: string | null;
}

export function RosterLine({ summary, threadState, now, onReview, threadHref }: RosterLineProps) {
  const cells = rosterCells(summary, {
    ...(now === undefined ? {} : { now }),
    ...(threadState === undefined ? {} : { threadState }),
  });
  const hasRecorded = cells.some((cell) => cell.evidence === 'recorded');

  return (
    <div className={s.workRow} data-testid={`work-product-${summary.runId}`}>
      <div className={s.workCells}>
        {cells.map((cell) => {
          const label = textOf(cell);
          const why = cell.whyKey ? t(cell.whyKey, cell.whyVars) : null;
          const body = (
            <>
              {label}
              {/* The qualifier in the accessible tree, not only in a `title`. AT drops
               * `title` descriptions routinely, and this sentence is the difference between
               * a recorded value and an observed one. */}
              {why ? <span className={s.srOnly}> {why}</span> : null}
            </>
          );
          const className = cell.field === 'branch' ? `${s.workCell} ${s.workBranch}` : s.workCell;
          return cell.href ? (
            <a
              key={cell.field}
              className={className}
              data-field={cell.field}
              data-evidence={cell.evidence}
              href={cell.href}
              target="_blank"
              rel="noreferrer"
              {...(why ? { title: why } : {})}
            >
              {body}
            </a>
          ) : (
            <span
              key={cell.field}
              className={className}
              data-field={cell.field}
              data-evidence={cell.evidence}
              {...(why ? { title: why } : {})}
            >
              {body}
            </span>
          );
        })}
      </div>

      {hasRecorded ? <p className={s.workRecorded}>{t('work.recordedWhy')}</p> : null}

      <div className={s.workActions}>
        {/* Read-only until the tree is readable. `diffAvailable: false` is a removed
         * worktree, which is a different fact from "changed nothing" — so the control is
         * disabled with that reason rather than opening onto an empty list that would read
         * as the second. */}
        {summary.diffAvailable ? (
          <Pill variant="secondary" onClick={() => onReview(summary)}>
            {t('work.review.open')}
          </Pill>
        ) : (
          <span className={s.disabledAction} title={t('work.diffGone')}>
            <Pill variant="secondary" disabled title={t('work.diffGone')}>
              {t('work.review.open')}
            </Pill>
          </span>
        )}
        {threadHref ? (
          <a className={s.chip} href={threadHref}>
            {t('work.thread.open')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
