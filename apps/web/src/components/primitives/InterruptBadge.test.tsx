/** @vitest-environment jsdom */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { INTERRUPT_LEVELS, type InterruptLevel } from '@agnetos/contracts';
import { I18nProvider } from '@/i18n/provider';
import { InterruptBadge, STEER_DELIVERY, interruptsWorkInProgress } from './InterruptBadge';

/**
 * REQ-DS-109…111, REQ-DS-113.
 *
 * The question a reader must answer before they commit: **will this interrupt work
 * in progress, or will it wait?** These tests assert that all three channels answer
 * it the same way, and that the answer is derived from the contract rather than
 * asserted twice.
 *
 * REQ-DS-113 is the M16 scope change made mechanical: the register is a monotone ramp
 * **with one rung currently unavailable**, and a register that drew all three as
 * equally available would be the only part of the design that is not true yet.
 */

const LEVELS = INTERRUPT_LEVELS as readonly InterruptLevel[];

const show = (level: InterruptLevel, locale: 'en' | 'ar' = 'en') =>
  level === 'steer'
    ? render(
        <I18nProvider locale={locale}>
          <InterruptBadge level="steer" deliverable={false} />
        </I18nProvider>,
      )
    : render(
        <I18nProvider locale={locale}>
          <InterruptBadge level={level as 'note' | 'halt'} />
        </I18nProvider>,
      );

/**
 * The levels this build can render in their **available** form. The design ramp is a
 * property of that form, so the ramp assertions below iterate this list rather than
 * `LEVELS` — and it is derived from the capability, so the day `steer` is deliverable
 * the ramp is asserted over all three again with no edit here.
 */
const AVAILABLE = LEVELS.filter((level) => level !== 'steer' || STEER_DELIVERY.supported);

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
    //
    // Enclosure is asserted over ALL three, because a refusal dashes the enclosure
    // rather than removing it. Weight is asserted over the AVAILABLE ones only: an
    // unavailable rung is deliberately NOT at the brighter weight, and that is the
    // next test's subject rather than an exception to this one.
    for (const level of LEVELS) {
      const { container, unmount } = show(level);
      const cls = rootClass(container);
      const interrupts = interruptsWorkInProgress(level);

      expect(
        /\bborder\b|\bborder-s\b/.test(cls),
        `${level}: an enclosure means "this reaches into running work"`,
      ).toBe(interrupts);
      if (AVAILABLE.includes(level)) {
        expect(
          /text-ivory(?!-2)/.test(cls),
          `${level}: the brighter rung means "this reaches into running work"`,
        ).toBe(interrupts);
      }
      unmount();
    }
    // And the one that waits is the one the contract says waits.
    expect(interruptsWorkInProgress('note')).toBe(false);
    expect(LEVELS.indexOf('note')).toBe(0);
  });

  it('cannot draw steer as available while the runner cannot deliver one', () => {
    // BOARD, M16 scope change: M16 ships TWO interrupt levels and a REFUSAL, not
    // three. `interrupt_not_deliverable` (409) comes back whether or not a run is in
    // flight, because the Agent SDK's streaming-input mode has never been exercised
    // here and the first thing that would exercise it is a paid run.
    //
    // So the register is a monotone ramp with one rung UNAVAILABLE, and this is the
    // line that stops it being drawn otherwise. The failure it closes is concrete: a
    // composer reads thread-model §4.2 — "refused when no run is in flight" — wires
    // `deliverable={runIsInFlight}`, and renders an available-looking steer that 409s
    // on submit. §4.2 describes the LEVEL; `STEER_DELIVERY` describes this BUILD.
    expect(STEER_DELIVERY.supported).toBe(false);

    // @ts-expect-error — while the runner cannot deliver a steer, `true` is not a
    // value this prop can take, and neither is a `boolean` read off the run state.
    // WHEN THIS LINE STOPS ERRORING the expect-error becomes unused and `typecheck`
    // fails — so lifting the capability cannot be done quietly, in either app.
    const _claimed = <InterruptBadge level="steer" deliverable />;
    expect([_claimed].length).toBe(1);

    // And the rendering agrees with the type rather than merely being permitted by it.
    const { container } = show('steer');
    expect(rootClass(container), 'an unavailable rung must not be dressed as available')
      .toContain('border-dashed');
    expect(rootClass(container)).not.toMatch(/text-ivory(?!-2)/);
  });

  it('agrees with the runner about whether a steer can be delivered', () => {
    // `MID_RUN_STEER` is `runner-engineer`'s and lives in an app the web bundle cannot
    // import from, so `STEER_DELIVERY` is a second copy of somebody else's fact — and
    // a second copy is only safe when something fails when the two disagree. This is
    // that something. It closes the failure in the direction a type cannot: the runner
    // lifts the refusal, this register keeps drawing it forever, and nothing is red.
    // That is BOARD's "a producer without a consumer" running backwards.
    // Resolved from this file, not from `process.cwd()`: the cwd is `apps/web` under
    // `npm run test:web` and the repo root under a root-level `vitest run`, and a
    // checker that reads the wrong path is a checker that has gone blind. And NOT via
    // `new URL(rel, import.meta.url)` — Vite rewrites that form into an asset URL, so
    // it resolves to `http://localhost:3000/...` under the test transform. Measured,
    // not assumed: it is how the first draft of this test failed.
    const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..', STEER_DELIVERY.mirrorOf);
    expect(
      existsSync(path),
      `${STEER_DELIVERY.mirrorOf} is not at ${path}. This mirror can no longer see the thing ` +
        `it mirrors — fix the path rather than letting the assertion below pass on nothing.`,
    ).toBe(true);
    const src = readFileSync(path, 'utf8');

    const at = src.indexOf(`export const ${STEER_DELIVERY.mirrors.split('.')[0]}`);
    expect(
      at,
      `${STEER_DELIVERY.mirrorOf} no longer exports ${STEER_DELIVERY.mirrors.split('.')[0]}. ` +
        `This mirror has lost the thing it mirrors — re-point it or delete it, but do not ` +
        `leave the register asserting a capability nothing checks.`,
    ).toBeGreaterThan(-1);

    // Skip the type annotation (before the `=`) and read the assigned value.
    const assigned = /=\s*\{[\s\S]*?\bsupported:\s*(true|false)\b/.exec(src.slice(at))?.[1];
    expect(assigned, `could not read ${STEER_DELIVERY.mirrors} out of ${STEER_DELIVERY.mirrorOf}`)
      .toBeDefined();
    expect(
      assigned === 'true',
      `${STEER_DELIVERY.mirrors} is ${assigned} and STEER_DELIVERY.supported is ` +
        `${STEER_DELIVERY.supported}. The runner and the register disagree about whether a ` +
        `steer can be delivered, and the register is what a human reads before they commit.`,
    ).toBe(STEER_DELIVERY.supported);
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
