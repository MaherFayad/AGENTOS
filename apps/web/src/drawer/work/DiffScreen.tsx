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
 * 5. **The screen is windowed, and a window is not a cut.** Only the rows near the viewport
 *    are in the DOM (`sessions/lib/virtual.ts`, via `diffRows` / `groupWindow`). Nothing is
 *    withheld by it — every row is reachable by scrolling, and the *server's* cut is still a
 *    sentence with a number in it. Before this, a first page was up to 8,000 line rows and
 *    ~24,000 elements mounted at once, inside a panel mid-320ms-slide; the run console has
 *    capped itself at 2,000 lines since M2 and a diff is the same problem at 4× the volume.
 *
 * And the refusal that is not an error: `work_product_unavailable` (410) means *the tree was
 * removed*, which must not look like *this run changed nothing*. Same empty list, completely
 * different news (§4.2).
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.2, §4.3, §8
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LOCALE, translate, type StringKey, type Vars } from '@/i18n';
import type { DiffFile, DiffFileStatus } from '@agnetos/contracts';
import { buildOffsets, windowFor } from '@/sessions/lib/virtual';
import { Pill } from '../primitives';
import s from '../drawer.module.css';
import {
  MAX_DIFF_ROWS_HELD,
  diffRows,
  filePathLabel,
  groupWindow,
  type DiffRow,
  type DiffState,
} from './diff-model';
import type { Verdict } from './review';

/**
 * One 12px monospace line with its padding — used only until a row has been measured.
 *
 * Rows here are genuinely variable height: a file header wraps to two lines on a phone, a
 * diff line is `white-space: pre-wrap` and a long one wraps to four. `virtual.ts` keeps a
 * measured-height cache for exactly that, and the estimate is only the first frame's guess.
 */
const ESTIMATED_ROW = 20;

/** Fallback viewport until the scroller reports one. jsdom reports `0` and never lays out. */
const ASSUMED_VIEWPORT = 640;

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
  /**
   * The element `JobDrawer` scopes the review's own focus trap to.
   *
   * This screen is an opaque `inset: 0` overlay — a modal in every way except that it was
   * not confined. The drawer's trap is keyed on `open`, so before M17's fix it kept cycling
   * the roster pills and the inputs form underneath, and opening the review moved focus
   * nowhere at all. A modal that does not take focus is a modal only for people using a
   * mouse.
   */
  rootRef?: React.Ref<HTMLDivElement>;
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
  rootRef,
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

  const scroller = useRef<HTMLDivElement | null>(null);
  const heights = useRef(new Map<number, number>());
  const [, forceRender] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(ASSUMED_VIEWPORT);

  const rows = useMemo(() => diffRows(diff?.files ?? []), [diff?.files]);
  const offsets = buildOffsets(rows.length, heights.current, ESTIMATED_ROW);
  const win = windowFor(offsets, scrollTop, viewport);
  const groups = groupWindow(rows, win.start, win.end);
  /** The model's ceiling, reached only by repeated *Show more*. Stated, never silent. */
  const holdFull = rows.length >= MAX_DIFF_ROWS_HELD;

  const readViewport = useCallback(() => {
    const el = scroller.current;
    // `clientHeight` is 0 under jsdom and during the drawer's slide-in; keeping the
    // assumption rather than adopting a zero is what stops the window collapsing to nothing
    // on the first frame, which would render six rows and look like an empty diff.
    if (el && el.clientHeight > 0) setViewport(el.clientHeight);
  }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    readViewport();
  }, [readViewport]);

  useEffect(() => {
    readViewport();
    window.addEventListener('resize', readViewport);
    return () => window.removeEventListener('resize', readViewport);
  }, [readViewport, open]);

  // A new run, or a fresh refusal, starts at the top — otherwise the second review opens
  // scrolled to wherever the first one was left.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = 0;
    heights.current = new Map();
    setScrollTop(0);
  }, [diff?.runId, diff?.headSha]);

  const measure = useCallback((index: number, height: number) => {
    // A measured `0` means "not laid out yet", not "this row has no height". Recording it
    // would zero every offset and collapse the window to the last six rows — a windowing
    // bug that looks exactly like a truncated diff, which is the one thing this screen
    // must never look like.
    if (height <= 0) return;
    if (heights.current.get(index) === height) return;
    heights.current.set(index, height);
    forceRender((n) => n + 1);
  }, []);

  return (
    <div
      ref={rootRef}
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

      <div className={s.reviewBody} data-testid="diff-scroller" ref={scroller} onScroll={onScroll}>
        {state.kind === 'loading' ? <p className={s.empty}>{t('work.diff.loading')}</p> : null}

        {state.kind === 'refused' ? (
          <p className={s.empty}>
            {state.refusal === 'moved' ? t('work.diff.moved') : t('work.diff.unavailable')}
          </p>
        ) : null}

        {state.kind === 'failed' ? <p className={s.empty}>{state.message}</p> : null}

        {diff && diff.files.length === 0 ? <p className={s.empty}>{t('work.diff.empty')}</p> : null}

        {/* Two spacers and the rows between them. The spacers hold the scrollbar honest —
          * the bar describes the whole diff, not the part currently mounted. */}
        <div style={{ height: win.padTop }} aria-hidden="true" />
        {diff
          ? groups.map((group) => (
              <div className={s.diffFile} key={`${group.file}:${group.rows[0]?.key ?? ''}`}>
                {group.rows.map((row, offset) => (
                  <DiffRowView
                    key={row.key}
                    row={row}
                    file={diff.files[row.file]}
                    index={group.start + offset}
                    onMeasure={measure}
                  />
                ))}
              </div>
            ))
          : null}
        <div style={{ height: win.padBottom }} aria-hidden="true" />

        {diff && diff.nextCursor ? (
          <div className={s.workActions}>
            {/* `totalFiles` is on every page, so "more" can say how much more. A file list
             * that cannot say how many files there are cannot be read in two seconds. */}
            <Pill variant="ghost" onClick={onLoadMore} disabled={loadingMore || holdFull}>
              {t('work.diff.more')}
            </Pill>
            <span className={s.diffStat}>{t('work.files', { count: diff.totalFiles })}</span>
          </div>
        ) : null}

        {/* A control that stopped working says why, in the flow, beside itself. A silent
         * ceiling is the same failure as a silent cut: the reader believes they reached the
         * end of the change when they reached the end of what the browser would hold. */}
        {diff && diff.nextCursor && holdFull ? (
          <p className={s.diffWithheld}>{t('work.diff.holdFull', { count: rows.length })}</p>
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

/**
 * One windowed row, measured on every layout so the offsets stop drifting.
 *
 * The markup per kind is byte-for-byte what `DiffFileView` drew before windowing — same
 * classes, same `data-origin`, same order — because the reviewed thing here was the
 * rendering and only the mounting strategy changed.
 */
function DiffRowView({
  row,
  file,
  index,
  onMeasure,
}: {
  row: DiffRow;
  file: DiffFile | undefined;
  index: number;
  onMeasure: (index: number, height: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (ref.current) onMeasure(index, ref.current.offsetHeight);
  });

  if (row.kind === 'head') {
    return (
      <div className={s.diffFileHead} ref={ref}>
        <span className={s.diffPath}>{file ? filePathLabel(file) : ''}</span>
        <span className={s.diffStat}>{file ? t(STATUS_KEY[file.status]) : ''}</span>
        {/* The whole change, not the part that arrived. See the header note (2). */}
        <span className={s.diffStat}>
          {t('work.lines', { insertions: file?.insertions ?? 0, deletions: file?.deletions ?? 0 })}
        </span>
      </div>
    );
  }

  if (row.kind === 'binary') {
    return (
      <div ref={ref}>
        <p className={s.diffBinary}>{t('work.diff.binary')}</p>
      </div>
    );
  }

  if (row.kind === 'withheld') {
    return (
      <div ref={ref}>
        <p className={s.diffWithheld}>{t('work.diff.withheld', { count: row.count })}</p>
      </div>
    );
  }

  if (row.kind === 'hunk') {
    return (
      <div className={s.diffHunkHeader} ref={ref}>
        {row.text}
      </div>
    );
  }

  return (
    <div className={s.diffLine} data-origin={row.origin} ref={ref}>
      {/* Rendered, not implied by the colour. "added" and "removed" are opposite
       * instructions to a reviewer, and colour alone does not carry them. */}
      <span className={s.diffOrigin}>{row.origin === ' ' ? ' ' : row.origin}</span>
      <span>{row.text}</span>
    </div>
  );
}
