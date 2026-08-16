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
import { DEFAULT_LOCALE, translate, type Locale } from '@/i18n';
import { useI18n } from '@/i18n';
import { BRAIN_EMPTY } from '../lib/map-type';

export interface BrainEmptyStateProps {
  core: GraphCore;
  /** Camera scale — the group is counter-scaled by it so the type stays a fixed size. */
  scale: number;
}

/**
 * `0 of 20 questions answered`, or an honest sentence when there is no denominator.
 *
 * Takes a locale rather than reading a hook so it stays a pure function the tests
 * can call directly. It defaults to English for exactly one caller — a test — and
 * never for a rendered surface: the component below passes the reader's locale.
 */
export function brainCountSentence(core: GraphCore, locale: Locale = DEFAULT_LOCALE): string {
  const total = core.brainTotal;
  if (typeof total !== 'number' || total <= 0) return translate(locale, 'map.brain.noCount');
  const answered = typeof core.brainAnswered === 'number' ? core.brainAnswered : 0;
  return translate(locale, 'map.brain.count', { answered, total, count: total });
}

export function BrainEmptyState({ core, scale }: BrainEmptyStateProps): React.JSX.Element | null {
  const { t, locale } = useI18n();
  if (core.brainCompleteness > 0) return null;

  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const sentence = brainCountSentence(core, locale);
  const total = core.brainTotal;
  // One key, one whole sentence. The label is NOT the eyebrow plus the count plus
  // the hint concatenated: clause order differs between languages, and a label
  // assembled at the call site can only ever come out in English's order.
  const label =
    typeof total === 'number' && total > 0
      ? t('map.brain.aria', {
          answered: typeof core.brainAnswered === 'number' ? core.brainAnswered : 0,
          total,
          count: total,
        })
      : t('map.brain.aria.noCount');

  return (
    <g
      data-testid="brain-empty-state"
      transform={`translate(${core.x} ${core.y}) scale(${1 / k})`}
      role="note"
      aria-label={label}
      className="pointer-events-none select-none"
    >
      <text
        y={BRAIN_EMPTY.offset}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={BRAIN_EMPTY.eyebrow.size}
        letterSpacing={BRAIN_EMPTY.eyebrow.tracking}
        fill="var(--ink-2)"
        // `letterSpacing` is a presentation attribute here, so no CSS class carries it and
        // check-rtl's tracking rule cannot see it. rtl.css flattens it under :lang(ar) and
        // `u-svg-eyebrow` puts the emphasis back as weight + word-spacing (§1.4).
        className="uppercase u-svg-eyebrow"
      >
        {t('map.brain.eyebrow')}
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
        {t('map.brain.hint')}
      </text>
    </g>
  );
}
