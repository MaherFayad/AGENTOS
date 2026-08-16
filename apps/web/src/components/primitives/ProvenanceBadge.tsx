'use client';

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { useT } from '@/i18n';
import { cx } from './cx';

/**
 * ProvenanceBadge — where the agent you are looking at came from.
 * `Plan §10` · `Plan §23.6` · ADR-014 · tokens contract §10.
 *
 * **This is the ninth primitive, and `index.ts` says adding one is a
 * decision-request rather than a pull request. The reason it is not a prop on an
 * existing primitive is the same reason it exists at all:** the obvious host is
 * `Chip`, and `Chip` is the product's *status* vocabulary — it is the one
 * component permitted to spend data ink, and it carries `live` / `success` /
 * `risk` / `warn` (§1.3). Provenance is not a status. A drifted fork is not
 * unhealthy; it runs fine. Putting provenance inside the status component would
 * teach every reader that a coloured token and a grey one are the same kind of
 * fact, which is precisely the distinction this badge has to protect.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS MONOCHROME, WHICH IS THE HARD PART
 *
 * BOARD rule 1 / §1.3: chrome is monochrome, colour is data ink. Provenance is
 * chrome. So five states have to separate without hue, at 11px, in both themes,
 * in RTL, and sitting inches from status chips that *are* coloured.
 *
 * `Plan §10` says a drifted fork "shows a staleness dot — the same honesty rule
 * as connector health". **The honesty rule is adopted in full; the visual
 * register is not.** Connector health is a status of a running thing and is data
 * ink by §1.3. Drift is a property of provenance. Rendering it amber would file
 * "your parent library moved on" in the same drawer as "approval pending", and
 * the reader would have to learn which greys and which colours belong to which
 * question. Recorded as a deliberate departure — tokens contract §10, ADR
 * requested — rather than taken quietly.
 *
 * Three channels carry the five states, and every state differs on at least two,
 * so no single channel is load-bearing alone:
 *
 *   1. MARK — house / square / fork. Silhouettes, not hues. Survives at 12px,
 *      survives greyscale, survives the label being hidden entirely (`size="sm"`).
 *   2. MARK MODIFIER — the fork's parent arm ends in a hollow ring when the
 *      parent has moved, and is severed when the parent is gone. **Hollow, never
 *      filled: a filled dot is `Chip`'s, and `Chip`'s dot is data ink.** Fill is
 *      therefore reserved as a signal in itself.
 *   3. TEXT WEIGHT — settled states sit at `--ivory-2`, warning states at
 *      `--ivory`. This is the monochrome equivalent of severity colour, and it is
 *      §9.4b's logic pointed at chrome: open the gap from above, never by pushing
 *      the quiet state down into `--ink-3`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE MARKS ARE DRAWN AND NOT TYPED
 *
 * `Plan §10` writes them as characters — `⌂` `▣` `⑂`. Measured at `4e0bbe6`
 * against the 79 CSS files `@fontsource/plus-jakarta-sans` actually ships:
 * U+2302, U+25A3 and U+2442 are in **none** of its 825 unicode-ranges. Typing
 * them would not request our webfont at all — the browser would fall back to
 * whatever the OS has, at a different weight and baseline, and U+2442 is missing
 * outright on many systems, which renders the fork as tofu. BOARD constraint 7
 * says no external font requests; a glyph that silently leaves our type system is
 * the same class of defect one layer down. So the marks are inline SVG on
 * `currentColor`: they inherit every rule above and depend on no font.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS BRIGHTER THAN NORMAL CHROME
 *
 * `--ivory-2` and `--ivory`, not `--ink-2`, and that is deliberate on two counts.
 *
 * A project override and its global parent **share a slug and a name by design**
 * (ADR-014 §2). On a roster row, a MAP node or a drawer header, this badge is the
 * entire difference between them. §9.2's delete-the-text test does not merely
 * pass here, it passes in its strongest form: delete the badge and the reader
 * does not lose a decoration, they *believe something untrue* — that they are
 * looking at the global agent when they are looking at a fork of it.
 *
 * And these rows are hoverable. §9.5: light `--ink-2` on `--card-2` — the standard
 * hover fill for every interactive row in the product — is 4.25:1, sub-AA, at the
 * moment the pointer is on it. Sitting at `--ivory-2` (7.14:1 worst case light)
 * removes that trap by construction instead of documenting it, and needs no
 * "am I inside an interactive row?" prop that call sites would get wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT DO
 *
 * - **No sixth `excluded` state.** An excluded `(department, slug)` has no
 *   resolved agent (ADR-014 §1.2), so there is nothing for a badge to decorate.
 *   Rendering an agent-shaped row carrying an "excluded" badge would put a node
 *   on screen that cannot run — a plausible presence where the truth is absence,
 *   which is BOARD rule 9 in the one direction it never permits. Exclusions are a
 *   status (something is wrong; a human must act) and therefore **data ink, in a
 *   sibling surface** owned by the view. Tokens contract §10.3.
 * - **No default `state`.** A default here would be a provenance claim spent by a
 *   call site that never made it — §9.6a's lesson applied to a semantic prop
 *   rather than a colour. If you do not know where the agent came from, you may
 *   not render this.
 * - **No motion.** A pulsing badge reads as "alive", and alive is copper's word.
 * - **No label prop.** The state→word mapping lives here for the same reason
 *   `Eyebrow` bakes in its tracking: a consumer who *can* choose the word will
 *   eventually choose a different one, and four surfaces answering one question
 *   in four vocabularies is worse than any single wrong answer.
 */

export type ProvenanceState =
  /** L0 — resolved from the global library. */
  | 'global'
  /** L1/L2 — resolved from this project's library or its overrides. */
  | 'project'
  /** A fork whose parent still resolves and still matches its recorded digest. */
  | 'fork'
  /** A fork whose parent resolves but has changed since (ADR-014 §4.3). */
  | 'drifted'
  /** A fork whose parent no longer resolves. Warns, never breaks — §4.4. */
  | 'orphaned';

export interface ProvenanceBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Required. There is no default — see the note above. */
  state: ProvenanceState;
  /** Short parent commit, fork states only. `forked_from.commit` (ADR-014 §4.2). */
  commit?: string;
  /** Parent ref, e.g. `global/sales/database-mining`. Spoken, never printed. */
  parent?: string;
  /**
   * `md` (default) = mark + label. `sm` = **mark only**, for a MAP node or a dense
   * row — the accessible sentence is unchanged, so nothing is lost to a reader
   * who cannot see the silhouette.
   */
  size?: 'sm' | 'md';
}

/** Settled states sit on the floor's safe side; warnings sit one rung above it. */
const TONE = {
  global: 'text-ivory-2',
  project: 'text-ivory-2',
  fork: 'text-ivory-2',
  drifted: 'text-ivory',
  orphaned: 'text-ivory',
} as const;

const LABEL = {
  global: 'provenance.badge.global',
  project: 'provenance.badge.project',
  fork: 'provenance.badge.fork',
  drifted: 'provenance.badge.drifted',
  orphaned: 'provenance.badge.orphaned',
} as const;

const SENTENCE = {
  global: 'a11y.provenance.global',
  project: 'a11y.provenance.project',
  fork: 'a11y.provenance.fork',
  drifted: 'a11y.provenance.drifted',
  orphaned: 'a11y.provenance.orphaned',
} as const;

/**
 * The marks. 12×12, 1.25px stroke on `currentColor`, no fill except the square's
 * core — which is the one place a fill means "this layer, here" rather than a
 * status.
 *
 * The mark is the same size in both variants on purpose: it is the part that has
 * to stay recognisable after the label is gone.
 */
function Mark({ state }: { state: ProvenanceState }): React.JSX.Element {
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

  if (state === 'global') {
    // A house. L0 is where an agent lives when it belongs to everyone.
    return (
      <svg {...common}>
        <path d="M1.75 5.5 6 1.9l4.25 3.6" />
        <path d="M3 5.9v4.2h6V5.9" />
      </svg>
    );
  }

  if (state === 'project') {
    // A square with a solid core — one library, this one, filled in.
    return (
      <svg {...common}>
        <rect x="2" y="2" width="8" height="8" rx="1.2" />
        <rect x="4.6" y="4.6" width="2.8" height="2.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // The fork: a stem that splits. The LEFT arm is this agent, the RIGHT arm is
  // the lineage back to the parent — and it is the right arm that carries drift,
  // because drift is a fact about the parent, not about the file you are reading.
  return (
    <svg {...common}>
      <path d="M6 10.4V6.6" />
      <path d="M6 6.6 3.4 4V2.1" />
      {state === 'fork' && <path d="M6 6.6 8.6 4V2.1" />}
      {state === 'drifted' && (
        <>
          <path d="M6 6.6 8.6 4v-.4" />
          {/* Hollow, not filled. A filled dot is Chip's, and Chip's dot is data ink. */}
          <circle cx="8.6" cy="2.3" r="1.15" />
        </>
      )}
      {state === 'orphaned' && (
        // Severed: the arm starts and stops, and nothing terminates it. The gap is
        // the signal, and a gap survives greyscale, RTL and 12px.
        <path d="M6 6.6 7.1 5.5M8.2 3.6 9 2.8" />
      )}
    </svg>
  );
}

export const ProvenanceBadge = forwardRef<HTMLSpanElement, ProvenanceBadgeProps>(
  function ProvenanceBadge({ state, commit, parent, size = 'md', className, ...rest }, ref) {
    const t = useT();
    const vars = { commit: commit ?? '', parent: parent ?? '' };

    return (
      <span
        ref={ref}
        // `dir` is untouched: the badge flows with its container, and the marks do
        // not mirror. They are symbols, not arrows — a mirrored house is still a
        // house, and mirroring the fork would say the lineage runs the other way.
        // Spacing is logical (`gap`), so an RTL flip needs no override here.
        className={cx('inline-flex items-center gap-1.5 align-middle font-sans', TONE[state], className)}
        {...rest}
      >
        <Mark state={state} />
        {size === 'md' && (
          // `<bdi>` because a fork label carries a commit — a Latin/digit run that
          // in Arabic sits inside an RTL sentence, next to an agent name that may
          // itself be either direction. Isolation keeps the badge's own run from
          // reordering against its neighbour. Whether the commit *also* wants its
          // own isolation is routed to rtl-arabic-pdpl-specialist, since splitting
          // it out would break their catalogue rule 2 (one key, one whole label).
          //
          // aria-hidden because the sr-only sentence below says it properly. The
          // visible form is an abbreviation; announcing both reads it twice.
          <bdi aria-hidden className="uppercase tabular-nums text-label-sm tracking-wider-1">
            {t(LABEL[state], vars)}
          </bdi>
        )}
        <span className="sr-only">{t(SENTENCE[state], vars)}</span>
      </span>
    );
  },
);
