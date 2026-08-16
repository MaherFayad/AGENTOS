'use client';

/**
 * The Second Brain at 0/20 (§3.3) — the honest empty state of the galaxy's centre.
 *
 * §3.3 makes the galaxy "a delightful, honest progress indicator". Honest means the empty
 * case has to be *stated*, not merely dim: `particleBudget(0)` draws no swirl, and a lone
 * core dot on a starfield is indistinguishable from a canvas that failed to paint. The
 * canvas draws a dashed disc where the swirl belongs; this says the same thing in words,
 * in the SVG layer, where it can be read by a screen reader.
 *
 * It renders only while completeness is exactly 0. From the first answered question the
 * swirl itself carries the signal, and permanent chrome at the core would compete with the
 * galaxy §2.1 is judged on.
 *
 * The count comes from `core.brainAnswered` / `core.brainTotal` — the payload's own numbers,
 * measured from COMPANY.md's `<!-- UNANSWERED: Qn -->` markers. This component never assumes
 * the interview has twenty questions; when the payload does not carry the count it says so
 * without one (Part VII.3 — an honest empty state beats a plausible number).
 */

import type { GraphCore } from '@agnetos/contracts';
import { BRAIN_EMPTY } from '../lib/map-type';

export interface BrainEmptyStateProps {
  core: GraphCore;
  /** Camera scale — the group is counter-scaled by it so the type stays a fixed size. */
  scale: number;
}

/** `0 of 20 questions answered`, or an honest sentence when there is no denominator. */
export function brainCountSentence(core: GraphCore): string {
  const total = core.brainTotal;
  if (typeof total !== 'number' || total <= 0) return 'No interview answers yet';
  const answered = typeof core.brainAnswered === 'number' ? core.brainAnswered : 0;
  return `${answered} of ${total} questions answered`;
}

export function BrainEmptyState({ core, scale }: BrainEmptyStateProps): React.JSX.Element | null {
  if (core.brainCompleteness > 0) return null;

  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const sentence = brainCountSentence(core);

  return (
    <g
      data-testid="brain-empty-state"
      transform={`translate(${core.x} ${core.y}) scale(${1 / k})`}
      role="note"
      aria-label={`Second brain: ${sentence}. Run the company interview to fill the galaxy.`}
      className="pointer-events-none select-none"
    >
      <text
        y={BRAIN_EMPTY.offset}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={BRAIN_EMPTY.eyebrow.size}
        letterSpacing={BRAIN_EMPTY.eyebrow.tracking}
        fill="var(--ink-2)"
        className="uppercase"
      >
        Second brain
      </text>
      <text
        y={BRAIN_EMPTY.offset + BRAIN_EMPTY.row + 4}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={BRAIN_EMPTY.headline.size}
        fill="var(--ivory-2)"
      >
        {sentence}
      </text>
      <text
        y={BRAIN_EMPTY.offset + BRAIN_EMPTY.row * 2 + 4}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={BRAIN_EMPTY.hint.size}
        fill="var(--ink-2)"
      >
        Run the company interview — the galaxy fills as answers land
      </text>
    </g>
  );
}
