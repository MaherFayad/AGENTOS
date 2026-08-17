'use client';

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import type { InterruptLevel } from '@agnetos/contracts';
import { useT } from '@/i18n';
import { cx } from './cx';

/**
 * InterruptBadge — how disruptively this message lands.
 * `Plan §12` · ADR-023 · thread-model contract §4.2 · tokens contract §11.
 *
 * **The eleventh primitive.** Same decision as the tenth and the ninth, recorded
 * rather than assumed (tokens contract §11.5): `Chip` is the status vocabulary
 * and spends data ink; an interrupt level is not a status, it is a *choice the
 * sender is about to make*. And the enclosure ramp below is not a `Chip` shape at
 * all — `Chip` is always a bordered box, and two of these three deliberately are
 * not.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE THING A READER MUST GET RIGHT BEFORE THEY COMMIT
 *
 *   Will this interrupt work in progress, or will it wait?
 *
 * `note` waits — it sits in the mailbox until the agent reaches a tool boundary.
 * `steer` is injected into a live session *now*. `halt` stops the work, checkpoints
 * it and asks. Three genuinely different consequences, and the ordering is an
 * escalation, so the type carries the escalation — without hue, because chrome is
 * monochrome (§1.3).
 *
 * **This register is a RAMP; the addressing register is a DISCONTINUITY.** That
 * difference is deliberate and it is the reason the two registers do not look
 * alike. `#` and `@@` are not two points on a scale — one costs a run and the
 * other costs N, and a reader who reads them as adjacent has already made the
 * expensive mistake, so `AddressBadge` gives fan-out a silhouette nothing else
 * has. `note → steer → halt` genuinely *is* a scale, and a monotone ramp is the
 * honest drawing of one. Encoding an ordering as a discontinuity would be as
 * wrong as the reverse.
 *
 * Three channels ramp together, and every pair differs on at least two:
 *
 *   1. MARK — the line of work, and what this does to it.
 *        note   an unbroken stem, full height        the work runs on
 *        steer  the stem steps sideways and continues the work changes course
 *        halt   the stem stops against a bar, and    the work stops
 *               the top of the box is EMPTY
 *      The empty top third is the third silhouette, and it is what separates
 *      `halt` from `steer` at 12px without reading either label.
 *   2. ENCLOSURE — nothing · a leading rule · a full box. A logical `border-s`,
 *      so the rule mirrors with the page for free.
 *   3. WEIGHT — `--ivory-2` for the one that waits, `--ivory` for the two that do
 *      not. §9.4b's instrument, the same one `ProvenanceBadge` uses for its two
 *      warning states: open the gap from above, never by pushing the quiet state
 *      down into `--ink-3`, which §9.2 forbids outright.
 *
 * `interruptsWorkInProgress()` is the predicate all three channels answer, and
 * `InterruptBadge.test.tsx` asserts the drawing agrees with it rather than trusting
 * that it does.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `deliverable` IS REQUIRED ON `steer` AND FORBIDDEN ON THE OTHER TWO
 *
 * thread-model §4.2, invariant 7: a `steer` sent to a thread with no run in flight
 * is **refused**, never quietly downgraded to a note — "a human who steered and was
 * silently queued believes they changed course, and nothing did." `note` and `halt`
 * are always deliverable and there is nothing to ask.
 *
 * So the props are a discriminated union: a caller offering `steer` **must** answer
 * "is a run in flight?", and a caller offering `note` **cannot** answer it. A
 * boolean defaulting to `true` would have been a deliverability claim spent by a
 * call site that never made it — §9.6a's lesson, which was about a colour, applied
 * to a semantic prop exactly as `ProvenanceBadge.state` applies it.
 *
 * An undeliverable steer renders with a **dashed** enclosure and stays at
 * `--ink-2`, not `--ink-3`. §9.3 homes `--ink-3` at disabled controls and this is
 * one — but §9.2's delete-the-text test overrules that here: delete the sentence
 * and the reader believes their steer will land. That is required reading, and
 * required reading is `--ink-2` at minimum.
 *
 * **No motion, ever** — a pulsing badge reads as "alive", and alive is copper's
 * single word. Reduced motion is a still with no layout change by construction.
 */

/**
 * Does this level reach into work that is already running?
 *
 * Derived from `Plan §12`'s own table — `note` is "queued, read at the next
 * natural boundary", the other two are not. It lives here rather than in
 * `packages/contracts/src/threads.ts` because it is a *rendering* question and
 * that module is `thread-model-engineer`'s; offered to them if they want it.
 */
export const interruptsWorkInProgress = (level: InterruptLevel): boolean => level !== 'note';

const TONE = {
  note: 'text-ivory-2',
  steer: 'text-ivory',
  halt: 'text-ivory',
} as const;

/** Nothing · a leading rule · a full box. Monotone, and logical so it mirrors. */
const ENCLOSURE = {
  note: '',
  steer: 'border-s border-line-2 ps-2',
  halt: 'rounded-chip border border-line-2 px-2 py-1',
} as const;

const LABEL = {
  note: 'threads.interrupt.note',
  steer: 'threads.interrupt.steer',
  halt: 'threads.interrupt.halt',
} as const;

const SENTENCE = {
  note: 'a11y.threads.interrupt.note',
  steer: 'a11y.threads.interrupt.steer',
  halt: 'a11y.threads.interrupt.halt',
} as const;

/**
 * The marks. 12×12, 1.25px on `currentColor`, no fill — hollow means chrome, the
 * same rule `ProvenanceBadge` established and `AddressBadge` inherited.
 *
 * The stem runs on the BLOCK axis and the one lateral step in `steer` is a change
 * of course, not a direction of travel: mirroring it would claim the work was
 * heading somewhere. `DOES_NOT_MIRROR['threads.registerMarks']` records that.
 */
function Mark({ level }: { level: InterruptLevel }): React.JSX.Element {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 12 12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className: 'shrink-0',
  };

  if (level === 'note') {
    // Unbroken, edge to edge. Nothing in flight is disturbed.
    return (
      <svg {...common}>
        <path d="M6 10.6V1.4" />
      </svg>
    );
  }

  if (level === 'steer') {
    // The work continues — along a different line. It still reaches the top.
    return (
      <svg {...common}>
        <path d="M6 10.6V7.4L9.2 5.4V1.4" />
      </svg>
    );
  }

  // The work stops against a bar and the top third of the box is empty. That
  // emptiness is the signal, and an absence survives greyscale, RTL and 12px.
  return (
    <svg {...common}>
      <path d="M6 10.6V5.2" />
      <path data-stop="true" d="M2.4 4.2h7.2" />
    </svg>
  );
}

interface Base extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * `md` (default) = mark + label. `sm` = **mark and enclosure only**, for a dense
   * feed row. The accessible sentence is unchanged, so a reader who cannot see the
   * silhouette loses nothing.
   */
  size?: 'sm' | 'md';
}

/**
 * `deliverable` is present exactly when it is answerable. A `note` or a `halt`
 * cannot be undeliverable (thread-model §4.2: "none — always deliverable"), so the
 * type refuses the question; a `steer` can be, so the type demands the answer.
 */
export type InterruptBadgeProps =
  | (Base & { level: 'note' | 'halt'; deliverable?: never })
  | (Base & { level: 'steer'; deliverable: boolean });

export const InterruptBadge = forwardRef<HTMLSpanElement, InterruptBadgeProps>(
  function InterruptBadge({ level, deliverable, size = 'md', className, ...rest }, ref) {
    const t = useT();
    const refused = level === 'steer' && deliverable === false;

    return (
      <span
        ref={ref}
        className={cx(
          'inline-flex items-center gap-1.5 align-middle font-sans',
          ENCLOSURE[level],
          // A refusal is not a disabled control: delete this and the reader
          // believes their steer will land. §9.2 — required reading, so --ink-2
          // is the floor and --ink-3 is not available.
          refused ? 'border-dashed text-ink-2' : TONE[level],
          className,
        )}
        {...rest}
      >
        <span className="sr-only">{t(SENTENCE[level])}</span>
        {refused && <span className="sr-only">{t('a11y.threads.interrupt.undeliverable')}</span>}

        <Mark level={level} />

        {size === 'md' && (
          // Wide-tracked caps, §1.4. The catalogue holds "Note", not "NOTE" — the
          // shout is `text-transform`, because Arabic has no letter case and a
          // SHOUTED catalogue string arrives there as nothing at all.
          //
          // aria-hidden: the sr-only sentence above says what the level means, and
          // announcing the one-word abbreviation as well reads it twice.
          <span aria-hidden className="uppercase text-label-sm tracking-wider-2">
            {t(LABEL[level])}
          </span>
        )}
      </span>
    );
  },
);
