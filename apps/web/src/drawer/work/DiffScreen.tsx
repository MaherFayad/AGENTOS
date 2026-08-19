'use client';

/**
 * The diff review screen — the second surface that slides over the drawer, and the one the
 * whole M17 seam exists to feed.
 *
 * `comms/contracts/work-product.md` §4.3 and §8. Four things here are load-bearing rather
 * than decorative, and each of them is a way a reviewer could be shown less than they think
 * they are being shown:
 *
 * 1. **The client never parses diff text.** `origin` is a field on `DiffLine`; it is
 *    rendered as a character *and* as data ink, and it is never stripped from the front of a
 *    string. A client that finds its own structure in unified diff is a second parser with a
 *    different author, which is the shape this seam was drawn to prevent.
 * 2. **A cut says it was cut.** `truncated` / `linesWithheld` are rendered as a sentence
 *    with a number in it. The file's `insertions` count still reports the whole change, and
 *    nothing here recomputes it from the lines that arrived — otherwise a reviewer reads
 *    `+3` over a change that inserted three hundred.
 * 3. **A binary file is flagged, never shown as bytes.** `hunks: null`, counts `0`.
 * 4. **The tree is pinned.** `headSha` is displayed, refusal `work_product_moved` (409) is
 *    its own sentence, and the verdict carries the sha it read. A verdict that cannot say
 *    what it looked at is a claim with no observation behind it.
 *
 * And the refusal that is not an error: `work_product_unavailable` (410) means *the tree was
 * removed*, which must not look like *this run changed nothing*. Same empty list, completely
 * different news (§4.2).
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.2, §4.3, §8
 */

import { DEFAULT_LOCALE, translate, type StringKey, type Vars } from '@/i18n';
import type { DiffFile, DiffFileStatus } from '@agnetos/contracts';
import { Pill } from '../primitives';
import s from '../drawer.module.css';
import { fileKey, filePathLabel, type DiffState } from './diff-model';
import type { Verdict } from './review';

const t = (key: StringKey, vars?: Vars): string => translate(DEFAULT_LOCALE, key, vars);

const STATUS_KEY = {
  added: 'work.diff.status.added',
  modified: 'work.diff.status.modified',
  deleted: 'work.diff.status.deleted',
  renamed: 'work.diff.status.renamed',
  binary: 'work.diff.status.binary',
} as const satisfies Record<DiffFileStatus, StringKey>;

export type DiffViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; diff: DiffState }
  /** A refusal with a name. `moved` and `unavailable` are opposite instructions to a reader. */
  | { kind: 'refused'; refusal: 'moved' | 'unavailable' }
  | { kind: 'failed'; message: string };

export interface DiffScreenProps {
  open: boolean;
  state: DiffViewState;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
  /** The note the reader typed. Free text; it goes into the request and nowhere else. */
  note: string;
  onNoteChange: (note: string) => void;
  onVerdict: (verdict: Verdict) => void;
  /** `null` while nothing has been sent. A sentence once something has. */
  result: string | null;
  /** The refusal sentence for a verdict that cannot be sent, or `null` when it can. */
  reviewRefusal: string | null;
  busy: boolean;
}

export function DiffScreen({
  open,
  state,
  loadingMore,
  onLoadMore,
  onClose,
  note,
  onNoteChange,
  onVerdict,
  result,
  reviewRefusal,
  busy,
}: DiffScreenProps) {
  const diff = state.kind === 'ready' ? state.diff : null;

  return (
    <div
      className={s.review}
      data-state={open ? 'open' : 'closed'}
      data-testid="diff-review"
      aria-hidden={open ? undefined : true}
      {...(!open ? { inert: true } : {})}
    >
      <div className={s.reviewHead}>
        <span className={s.reviewTitle}>{t('work.diff.title')}</span>
        {/* The tree this page was read from, shown rather than implied. It is the same value
         * the verdict below carries, so a reader can see what they are approving against. */}
        {diff ? <span className={s.reviewTree}>{t('work.diff.tree', { sha: diff.headSha })}</span> : null}
        <Pill variant="ghost" onClick={onClose}>
          {t('work.diff.close')}
        </Pill>
      </div>

      <div className={s.reviewBody}>
        {state.kind === 'loading' ? <p className={s.empty}>{t('work.diff.loading')}</p> : null}

        {state.kind === 'refused' ? (
          <p className={s.empty}>
            {state.refusal === 'moved' ? t('work.diff.moved') : t('work.diff.unavailable')}
          </p>
        ) : null}

        {state.kind === 'failed' ? <p className={s.empty}>{state.message}</p> : null}

        {diff && diff.files.length === 0 ? <p className={s.empty}>{t('work.diff.empty')}</p> : null}

        {diff
          ? diff.files.map((file, index) => <DiffFileView key={fileKey(file, index)} file={file} />)
          : null}

        {diff && diff.nextCursor ? (
          <div className={s.workActions}>
            {/* `totalFiles` is on every page, so "more" can say how much more. A file list
             * that cannot say how many files there are cannot be read in two seconds. */}
            <Pill variant="ghost" onClick={onLoadMore} disabled={loadingMore}>
              {t('work.diff.more')}
            </Pill>
            <span className={s.diffStat}>{t('work.files', { count: diff.totalFiles })}</span>
          </div>
        ) : null}
      </div>

      <div className={s.reviewFoot}>
        <label className={s.srOnly} htmlFor="work-review-note">
          {t('work.review.note')}
        </label>
        <textarea
          id="work-review-note"
          className={s.reviewNote}
          rows={2}
          value={note}
          placeholder={t('work.review.note')}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <div className={s.reviewActions}>
          {reviewRefusal ? (
            <span className={s.disabledAction} title={reviewRefusal}>
              <Pill variant="primary" disabled title={reviewRefusal}>
                {t('work.review.approve')}
              </Pill>
            </span>
          ) : (
            <Pill variant="primary" disabled={busy} onClick={() => onVerdict('approved')}>
              {t('work.review.approve')}
            </Pill>
          )}
          {reviewRefusal ? (
            <span className={s.disabledAction} title={reviewRefusal}>
              <Pill variant="secondary" disabled title={reviewRefusal}>
                {t('work.review.changes')}
              </Pill>
            </span>
          ) : (
            <Pill variant="secondary" disabled={busy} onClick={() => onVerdict('changes_requested')}>
              {t('work.review.changes')}
            </Pill>
          )}
        </div>
        {/* Not a merge, and it does not imply one exists. M17 records push state and
         * performs nothing: a push is data egress and ADR-038 is still `proposed`. */}
        <p className={s.reviewCaveat}>{t('work.review.notMerge')}</p>
        {reviewRefusal ? <p className={s.reviewCaveat}>{reviewRefusal}</p> : null}
        {result ? (
          <p className={s.reviewCaveat} role="status">
            {result}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DiffFileView({ file }: { file: DiffFile }) {
  return (
    <div className={s.diffFile}>
      <div className={s.diffFileHead}>
        <span className={s.diffPath}>{filePathLabel(file)}</span>
        <span className={s.diffStat}>{t(STATUS_KEY[file.status])}</span>
        {/* The whole change, not the part that arrived. See the header note (2). */}
        <span className={s.diffStat}>
          {t('work.lines', { insertions: file.insertions, deletions: file.deletions })}
        </span>
      </div>

      {file.hunks === null ? (
        <p className={s.diffBinary}>{t('work.diff.binary')}</p>
      ) : (
        file.hunks.map((hunk) => (
          <div key={hunk.header}>
            <div className={s.diffHunkHeader}>{hunk.header}</div>
            {hunk.lines.map((line, index) => (
              <div key={index} className={s.diffLine} data-origin={line.origin}>
                {/* Rendered, not implied by the colour. "added" and "removed" are opposite
                 * instructions to a reviewer, and colour alone does not carry them. */}
                <span className={s.diffOrigin}>{line.origin === ' ' ? ' ' : line.origin}</span>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        ))
      )}

      {file.truncated ? (
        <p className={s.diffWithheld}>{t('work.diff.withheld', { count: file.linesWithheld })}</p>
      ) : null}
    </div>
  );
}
