'use client';

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import {
  formatThreadAddress,
  type AddressForm,
  type ThreadAddress,
  type TurnCost,
} from '@agnetos/contracts';
import { useT } from '@/i18n';
import { cx } from './cx';

/**
 * AddressBadge — who this turn goes to, and how many runs that costs.
 * `Plan §12` · `Plan §23.8` · ADR-023 · thread-model contract §3, §6 · tokens
 * contract §11.
 *
 * **This is the tenth primitive and the count moved on a written decision, not on
 * convenience** (tokens contract §11.5). The obvious host was `Chip`, and that is
 * exactly why it could not go there — the same argument that produced
 * `ProvenanceBadge` (§10.4), and it is sharper here. `Chip` is the product's
 * *status* vocabulary and the one component permitted to spend data ink. An
 * address is not a status: nothing is wrong, nothing is running, nothing needs a
 * human. It is chrome. Rendering "this costs six runs" in a status hue would put
 * a *price* in the same visual drawer as "at risk", and the reader would then
 * have to learn which colours are conditions and which are money.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SPEND CONTROL AND NOT A DECORATION
 *
 * `Plan §12`, quoted because paraphrase loses the reason:
 *
 *   "`#sales` and `@@sales` must be different characters and must *look*
 *    different, because one costs one run and the other costs six. A UI that
 *    makes broadcast easy to trigger accidentally will cost real money on the
 *    first day."
 *
 * So these are not four decorations of one idea. The failure mode is a person
 * who meant one run and bought N, and near-identical treatments are what produce
 * it. **`@@` is therefore visually DISCONTINUOUS from `#`, not one weight step
 * away from it.** The discontinuity is a silhouette a reader resolves without
 * reading: the fan-out badge is *physically two plates* — a second hairline lip
 * peeks above the frame — and nothing else in this product has a stacked
 * outline. "There is more than one of these" arrives before the characters do.
 *
 * Four channels carry the four forms, and every pair differs on at least two, so
 * no single channel is load-bearing alone:
 *
 *   1. MARK — the arity of the delivery, drawn. A crossbar (one), a crossbar with
 *      something continuing past it (at least one), a trident (N), a stem that
 *      goes somewhere unnamed (the Chief of Staff, whose router is M22's).
 *   2. SILHOUETTE — one plate, or two. `fan-out` alone is stacked.
 *   3. SIGIL — the characters the person actually typed, echoed back verbatim.
 *      Confirming, never load-bearing: `#` and `@@` at 11px are precisely the
 *      confusion this component exists to prevent.
 *   4. WEIGHT — `--ivory-2` settled, `--ivory` for the expensive one, with the
 *      frame stepping `--line` → `--line-2` alongside it. Exactly `ProvenanceBadge`'s
 *      instrument (§9.4b, "open the gap from above"), reused rather than reinvented,
 *      so the two badges are one dialect.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE OPEN END IS THE LOWER BOUND — one drawing rule across all four marks
 *
 *   A mark whose topmost stroke TERMINATES IN A CAP is an exact count.
 *   A mark whose topmost stroke is a FREE-STANDING DASH continues past what we
 *   can count.
 *
 * That is `TurnCost.runsAreExact` drawn rather than described, and it is the
 * answer to the second thing `Plan §23.8` gets wrong. The plan says `#sales`
 * "says 1 run". It does not: the lead answers *or delegates*, and a delegation is
 * a second run. Printing a flat "1 run" beside a mechanism that routinely costs
 * two is a plausible number one decimal place up — the same defect as a plausible
 * zero (BOARD rule 9). So the copy says "at least", and the mark says it too, and
 * `AddressBadge.test.tsx` binds the two together: a form draws the open end **iff**
 * `addressCost()` says its count is inexact.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS COMPONENT CANNOT BE MADE TO RENDER
 *
 * - **A money figure.** `Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`. The `4`
 *   is real — it is the resolved member count. **The `$0.40` has no source**: zero
 *   runs have ever completed, so there is nothing to average, and a cost preview is
 *   exactly the surface where a plausible number gets believed. `TurnCost.estimatedUsd`
 *   is typed `null` by its owner precisely so a figure stops the file compiling, and
 *   this component adds no prop that could carry one: there is no `label`, no
 *   `children`, no `suffix`. The cost slot renders **count without money as its
 *   full state, not as a degraded one** — the sentence is complete, and nothing is
 *   missing from it, because nothing is known that it omits.
 * - **A count it was not given.** `cost="unresolved"` is a first-class state with
 *   its own sentence, and it is *visibly different* from `runs: 0`. Those are two
 *   different facts — "this department has no members" and "nobody has looked" —
 *   and collapsing them is BOARD rule 9 in miniature. The unresolved state carries
 *   no numeral at all: the absence of a figure IS the signal, which is why it does
 *   not borrow the chart's hatch (`chart/model/hatch.ts` fills an *area* that would
 *   otherwise hold data, and a primitive importing from a view inverts the
 *   dependency §9.6a already refused).
 * - **A default `address`.** Required, no fallback — `ProvenanceBadge`'s §9.6a
 *   lesson applied to a semantic prop. A default recipient spent by a call site
 *   that never chose one is a message sent somewhere nobody picked.
 * - **Motion.** None, ever. A pulsing badge reads as "alive", and alive is
 *   copper's single word (§1.3). Reduced motion is therefore a still with no
 *   layout change by construction rather than by a guard.
 * - **Focus.** It renders no focusable node and sets no `tabindex`, so a composer
 *   may legally wrap it in the `@@` confirm button that BOARD requires — a button
 *   containing a button is not reachable, and that is the trap this avoids.
 */

/** The name a sentence uses for the recipient — no sigil, because prose has none. */
function recipientName(address: ThreadAddress): string {
  switch (address.form) {
    case 'direct':
      return address.department ? `${address.department}/${address.slug}` : address.slug;
    case 'dispatch':
    case 'fan-out':
      return address.department;
    case 'default':
      return '';
  }
}

/**
 * The forms whose mark draws a free, uncapped end. This is the drawing's copy of
 * `runsAreExact === false`, and the test asserts the two agree rather than
 * trusting this list — a second copy of a fact is only safe when something fails
 * when they disagree.
 */
export const OPEN_ENDED_FORMS: readonly AddressForm[] = ['dispatch', 'default'];

/** Settled forms sit on the floor's safe side; the expensive one sits a rung above. */
const TONE = {
  direct: 'text-ivory-2',
  dispatch: 'text-ivory-2',
  'fan-out': 'text-ivory',
  default: 'text-ivory-2',
} as const;

/** The frame steps with the tone, so the two say the same thing twice. */
const FRAME = {
  direct: 'border-line',
  dispatch: 'border-line',
  'fan-out': 'border-line-2',
  default: 'border-line',
} as const;

const SENTENCE = {
  direct: 'a11y.threads.address.direct',
  dispatch: 'a11y.threads.address.dispatch',
  'fan-out': 'a11y.threads.address.fanout',
  default: 'a11y.threads.address.default',
} as const;

/**
 * The marks. 12×12, 1.25px stroke on `currentColor`, no fill anywhere — fill is
 * `Chip`'s and `Chip`'s fill is data ink, so hollow means chrome across both
 * badges (§10.1 channel 2, extended rather than re-decided).
 *
 * Drawn on the BLOCK axis on purpose. A message rises from the composer into the
 * runs it becomes, so there is no inline asymmetry to mirror and the RTL question
 * does not arise — `DOES_NOT_MIRROR['threads.registerMarks']` records that as a
 * decision rather than leaving the next reader to rediscover it.
 */
function Mark({ form }: { form: AddressForm }): React.JSX.Element {
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

  if (form === 'direct') {
    // One stem, one crossbar. Closed at the top: exactly one run, and no more.
    return (
      <svg {...common}>
        <path d="M6 10.4V4.6" />
        <path d="M3.4 4.6h5.2" />
      </svg>
    );
  }

  if (form === 'dispatch') {
    // The lead's own run — and, floating free above it, the delegation that may
    // follow. The gap is the whole point: it is where the second run goes.
    return (
      <svg {...common}>
        <path d="M6 10.4V5.4" />
        <path d="M3.4 5.4h5.2" />
        <path data-open-end="true" d="M6 3.4V1.6" />
      </svg>
    );
  }

  if (form === 'fan-out') {
    // Three arms, three ends, all terminating. N is exact — it is the resolved
    // member count — and the trident is the silhouette that says so at 12px.
    return (
      <svg {...common}>
        <path d="M6 10.4V7.2" />
        <path d="M6 7.2 3 4.6V2.6" />
        <path d="M6 7.2V2.6" />
        <path d="M6 7.2 9 4.6V2.6" />
      </svg>
    );
  }

  // The bare address. It goes somewhere and M16 cannot say where: the Chief of
  // Staff is an *address* here, and the router that would answer it is M22's
  // (`Plan §17`). A broken stem is that fact drawn — the message leaves, and the
  // far end is not ours to draw yet.
  return (
    <svg {...common}>
      <path d="M6 10.4V6.2" />
      <path data-open-end="true" d="M6 4.2V1.8" />
    </svg>
  );
}

export interface AddressBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Required, and there is no default — see the note above. Parsed by
   * `parseThreadAddress`, never assembled by a component.
   */
  address: ThreadAddress;
  /**
   * What this turn costs, from `addressCost()` with a **resolved** member count.
   *
   * `'unresolved'` when the roster has not resolved and N is genuinely unknown.
   * Omit it entirely where cost is not the question — a thread-list row naming
   * its recipient is not a spend decision and should not carry a price tag.
   *
   * There is no money in this type and no prop that can carry one.
   */
  cost?: TurnCost | 'unresolved';
}

export const AddressBadge = forwardRef<HTMLSpanElement, AddressBadgeProps>(
  function AddressBadge({ address, cost, className, ...rest }, ref) {
    const t = useT();
    const form = address.form;
    const typed = formatThreadAddress(address);

    // `runs: 0` and "nobody counted" are two different facts and the badge keeps
    // them apart. A zero that was measured is a real answer; a zero that stands in
    // for an absent measurement is the one thing BOARD rule 9 never permits.
    const costLine =
      cost === undefined
        ? null
        : cost === 'unresolved'
          ? t('threads.cost.unresolved')
          : t(cost.runsAreExact ? 'threads.cost.runs' : 'threads.cost.runsAtLeast', {
              count: cost.runs,
            });

    return (
      // `pt-1` is reserved on ALL four forms, not only the stacked one, so a
      // column of mixed badges sits on one baseline instead of jittering by the
      // height of the lip.
      <span
        ref={ref}
        className={cx('relative inline-flex pt-1 align-middle', className)}
        {...rest}
      >
        {form === 'fan-out' && (
          // The second plate. Inset symmetrically on the inline axis and offset only
          // on the block axis, so it is a stack in both directions of reading and
          // needs no mirror. It is a 1px stroke, not a shadow: dark mode has no
          // shadows outside drawers (§1.5).
          //
          // `--line-2`, matching FRAME['fan-out'] and NOT the `--line` of the three
          // cheap forms. It was `--line` until `fidelity-qa-reviewer` caught the
          // contradiction, and the catch was right: channel 2 (silhouette) is the
          // channel a reader resolves *without reading*, so it is what the whole spend
          // control rests on — and it was being drawn at the weakest line token in the
          // component while channel 3 (the sigil, which only confirms) was drawn at the
          // strongest. §9.4b says open the gap from above. A receding second plate is a
          // coherent drawing, but it is not the one this file argues for forty lines
          // higher up, and of two contradictory instruments one has to go.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 top-0 h-1 rounded-t-chip border border-b-0 border-line-2"
          />
        )}

        <span
          className={cx(
            'inline-flex items-center gap-1.5 rounded-chip border px-2 py-1 font-sans text-chip',
            FRAME[form],
            TONE[form],
          )}
        >
          {/* Read first, so the sentence arrives before the count. */}
          <span className="sr-only">{t(SENTENCE[form], { name: recipientName(address) })}</span>

          <Mark form={form} />

          {form === 'default' ? (
            // The one form whose visible label is copy rather than data: a bare
            // address is what a person types by typing nothing, so there is no
            // typed string to echo back.
            <span>{t('threads.address.default')}</span>
          ) : (
            // `<bdi>` because `@`, `#` and `@@` are direction-neutral characters
            // that will sit against Arabic text. Isolated, the run resolves by its
            // own first strong character — a kebab slug — so `@@sales` renders as
            // typed instead of reordering against its neighbour.
            //
            // `aria-hidden` because "@@sales" is announced as "at at sales". The
            // sr-only sentence above says it properly, once.
            <bdi aria-hidden>{typed}</bdi>
          )}

          {costLine !== null && (
            <>
              {/* A separator between two things, which is §9.3's home for --ink-3. */}
              <span aria-hidden className="text-ink-3">
                ·
              </span>
              {/* Not aria-hidden: the count is a complete label and the reader who
                  cannot see it is exactly the reader who most needs it said. */}
              <span className={cx(cost === 'unresolved' ? 'text-ink-2' : 'tabular-nums')}>
                {costLine}
              </span>
            </>
          )}
        </span>
      </span>
    );
  },
);
