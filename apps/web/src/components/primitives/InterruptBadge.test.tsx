/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { INTERRUPT_LEVELS, type InterruptLevel } from '@agnetos/contracts';
import { I18nProvider } from '@/i18n/provider';
import { InterruptBadge, interruptsWorkInProgress } from './InterruptBadge';

/**
 * REQ-DS-109…111.
 *
 * The question a reader must answer before they commit: **will this interrupt work
 * in progress, or will it wait?** These tests assert that all three channels answer
 * it the same way, and that the answer is derived from the contract rather than
 * asserted twice.
 */

const LEVELS = INTERRUPT_LEVELS as readonly InterruptLevel[];

const show = (level: InterruptLevel, locale: 'en' | 'ar' = 'en') =>
  level === 'steer'
    ? render(
        <I18nProvider locale={locale}>
          <InterruptBadge level="steer" deliverable />
        </I18nProvider>,
      )
    : render(
        <I18nProvider locale={locale}>
          <InterruptBadge level={level as 'note' | 'halt'} />
        </I18nProvider>,
      );

const drawn = (root: HTMLElement) =>
  new Set([...root.querySelectorAll('svg path')].map((n) => n.getAttribute('d') ?? ''));

const isSubsetOf = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

const rootClass = (root: HTMLElement) => root.firstElementChild?.getAttribute('class') ?? '';

describe('InterruptBadge — the interrupt register (Plan §12, tokens contract §11)', () => {
  it('draws a mark no other level contains', () => {
    const marks = new Map(
      LEVELS.map((level) => {
        const { container, unmount } = show(level);
        const set = drawn(container);
        unmount();
        return [level, set] as const;
      }),
    );
    for (const [level, set] of marks) {
      expect(set.size, `${level} draws nothing`).toBeGreaterThan(0);
      for (const [other, otherSet] of marks) {
        if (other === level) continue;
        expect(
          isSubsetOf(set, otherSet),
          `${level}'s mark is contained in ${other}'s — these three have genuinely ` +
            `different consequences and must not be one shape with a detail added.`,
        ).toBe(false);
      }
    }
  });

  it('marks "this reaches into running work" the same way in every channel', () => {
    // The property under test is `interruptsWorkInProgress`, and it is read from the
    // contract's own ordering rather than restated here. Enclosure and weight must
    // both agree with it: a reader who scans the shape and a reader who scans the
    // brightness must reach the same conclusion, or one of them is being misled.
    for (const level of LEVELS) {
      const { container, unmount } = show(level);
      const cls = rootClass(container);
      const interrupts = interruptsWorkInProgress(level);

      expect(
        /\bborder\b|\bborder-s\b/.test(cls),
        `${level}: an enclosure means "this reaches into running work"`,
      ).toBe(interrupts);
      expect(
        /text-ivory(?!-2)/.test(cls),
        `${level}: the brighter rung means "this reaches into running work"`,
      ).toBe(interrupts);
      unmount();
    }
    // And the one that waits is the one the contract says waits.
    expect(interruptsWorkInProgress('note')).toBe(false);
    expect(LEVELS.indexOf('note')).toBe(0);
  });

  it('ramps the enclosure monotonically — nothing, a rule, a box', () => {
    // The addressing register is a DISCONTINUITY because `#` and `@@` are not two
    // points on a scale. This one is a RAMP because note → steer → halt genuinely is
    // one, and drawing an ordering as a discontinuity would be as wrong as the
    // reverse. Measured as three distinct enclosure treatments in escalation order.
    const enclosure = (level: InterruptLevel) => {
      const { container, unmount } = show(level);
      const cls = rootClass(container);
      unmount();
      return cls.includes('rounded-chip') ? 2 : cls.includes('border-s') ? 1 : 0;
    };
    expect([enclosure('note'), enclosure('steer'), enclosure('halt')]).toEqual([0, 1, 2]);
  });

  it('leaves the top of halt’s box empty — the third silhouette', () => {
    // What separates halt from steer at 12px without reading either label: steer's
    // line reaches the top of the box, halt's stops against a bar and nothing is
    // above it. Asserted as "halt is the only level that draws a terminating bar",
    // which is redraw-tolerant.
    for (const level of LEVELS) {
      const { container, unmount } = show(level);
      expect(container.querySelector('[data-stop]') !== null, `${level}`).toBe(level === 'halt');
      unmount();
    }
  });

  it('spends no colour at all — chrome is monochrome (BOARD rule 1, §1.3)', () => {
    // An interrupt level is not a status; it is a choice the sender is about to make.
    // Nothing has gone wrong when a reader is looking at "halt".
    for (const level of LEVELS) {
      const { container, unmount } = show(level);
      expect(container.innerHTML).not.toMatch(/ink-(copper|teal|coral|lavender|amber|blue)/);
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
      unmount();
    }
  });

  it('refuses an undeliverable steer visibly, and says why out loud', () => {
    // thread-model invariant 7: a steer with no run in flight is REFUSED, never
    // silently downgraded to a note — "a human who steered and was silently queued
    // believes they changed course, and nothing did."
    const { container } = render(
      <I18nProvider locale="en">
        <InterruptBadge level="steer" deliverable={false} />
      </I18nProvider>,
    );
    expect(rootClass(container)).toContain('border-dashed');
    expect(container.textContent).toContain('would be refused rather than queued');
  });

  it('keeps a refusal at --ink-2, because it is required reading (§9.2)', () => {
    // §9.3 homes --ink-3 at disabled controls and this looks like one. §9.2's
    // delete-the-text test overrules that: delete this and the reader believes their
    // steer will land. Required reading is --ink-2 at minimum, and never below.
    const { container } = render(
      <I18nProvider locale="en">
        <InterruptBadge level="steer" deliverable={false} />
      </I18nProvider>,
    );
    expect(rootClass(container)).toContain('text-ink-2');
    expect(rootClass(container)).not.toContain('text-ink-3');
  });

  it('asks about deliverability exactly where it is answerable', () => {
    // A boolean defaulting to `true` would be a deliverability claim spent by a call
    // site that never made it — §9.6a's lesson, applied to a semantic prop. `note`
    // and `halt` are always deliverable (thread-model §4.2), so the type refuses the
    // question; `steer` can be refused, so the type demands the answer.
    // @ts-expect-error — a steer must state whether a run is in flight.
    const _unanswered = <InterruptBadge level="steer" />;
    // @ts-expect-error — a note is always deliverable; there is nothing to answer.
    const _overAnswered = <InterruptBadge level="note" deliverable={false} />;
    expect([_unanswered, _overAnswered].length).toBe(2);
  });

  it('keeps the whole accessible sentence when the label is dropped', () => {
    // size="sm" is for a dense feed row. A reader who cannot see the silhouette must
    // lose nothing at all.
    const { container } = render(
      <I18nProvider locale="en">
        <InterruptBadge level="halt" size="sm" />
      </I18nProvider>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('stops the work');
    expect(container.textContent).not.toContain('Halt');
  });

  it('tracks its caps inside §1.4’s band, and shouts in CSS rather than in the catalogue', () => {
    // Under-tracking wide caps is the most common fidelity miss in this system, so
    // the tracking is baked in. And the catalogue holds "Note", not "NOTE": Arabic has
    // no letter case, so `text-transform` is a no-op there and one key works in both,
    // where a SHOUTED string would arrive in Arabic as nothing at all.
    const { container } = show('note');
    const label = [...container.querySelectorAll('span')].find((n) =>
      (n.getAttribute('class') ?? '').includes('uppercase'),
    );
    expect(label?.getAttribute('class')).toMatch(/tracking-wider-[1-4]/);
    expect(label?.textContent).toBe('Note');
  });

  it('takes its strings from the catalogue, so check-rtl can see them', () => {
    // A hardcoded English word here would be invisible to the RTL sweep and would ship
    // untranslated. Asserted by rendering under `ar`: if the component held its own
    // strings, English would come out regardless of locale.
    //
    // Both halves are pinned — the level NAME and the behaviour SENTENCE — because they
    // were translated under different reasoning. §10.7's precedent left five provenance
    // terms as `todo()`; those are metaphors with no Arabic technical idiom. `note` ·
    // `steer` · `halt` are three actions with a direct MSA verbal noun each, so they are
    // written. The line between the two acts is drawn in strings.ar.ts beside the keys.
    const { container } = render(
      <I18nProvider locale="ar">
        <InterruptBadge level="halt" />
      </I18nProvider>,
    );
    expect(container.textContent).toContain('يوقف هذا العملَ');
    expect(container.textContent).toContain('إيقاف');
    expect(container.textContent, 'no English may leak into an Arabic render').not.toMatch(
      /[A-Za-z]{3,}/,
    );
  });

  it('never animates — alive is copper’s word, and this is chrome', () => {
    for (const level of LEVELS) {
      const { container, unmount } = show(level);
      expect(container.innerHTML).not.toMatch(/\banimate-|\btransition\b|duration-/);
      unmount();
    }
  });

  it('has no default level — an interrupt may not be spent by silence (§9.6a)', () => {
    expect(InterruptBadge.toString()).not.toMatch(/level\s*=\s*['"]/);
  });
});
