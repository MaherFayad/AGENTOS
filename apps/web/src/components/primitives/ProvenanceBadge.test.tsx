/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import { ProvenanceBadge, type ProvenanceState } from './ProvenanceBadge';

/**
 * The badge's whole job is to be the difference between two rows that are
 * otherwise identical (ADR-014 §2 — a project override and its global parent
 * share a slug and a name by design). So these tests assert on *distinguishability*
 * and on the monochrome constraint, not on the specific path data: the marks may
 * be redrawn, and should be, without touching a single assertion here.
 */

const ALL: ProvenanceState[] = ['global', 'project', 'fork', 'drifted', 'orphaned'];

const show = (state: ProvenanceState) =>
  render(
    <I18nProvider locale="en">
      <ProvenanceBadge state={state} commit="a1b2c3" parent="global/sales/database-mining" />
    </I18nProvider>,
  );

/** The set of strokes a state draws, normalised — shape only, no styling. */
const drawn = (root: HTMLElement) =>
  new Set(
    [...root.querySelectorAll('svg *')].map(
      (n) =>
        `${n.tagName}:${n.getAttribute('d') ?? ''}${n.getAttribute('cx') ?? ''}${n.getAttribute('width') ?? ''}`,
    ),
  );

const marksOf = (state: ProvenanceState) => {
  const { container, unmount } = show(state);
  const set = drawn(container);
  unmount();
  return set;
};

const isSubsetOf = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

describe('ProvenanceBadge (Plan §10, ADR-014, tokens contract §10)', () => {
  it('draws a mark no other state contains — the signal survives greyscale', () => {
    // Five states, five silhouettes. Distinctness alone is too weak an assertion,
    // and that is measured rather than assumed: an earlier version of this test
    // asserted only `new Set(marks).size === 5`, and a deliberate mutation that
    // made `orphaned` draw the intact parent arm *as well as* the severed one
    // passed it happily — the two strings differed, so the test was satisfied,
    // while the mark had become fork-plus-something and the pair was confusable
    // at 12px. Containment is the property that was actually meant: no state may
    // be another state with extra strokes on top.
    //
    // Redraw-tolerant on purpose. Change every path here and this test stays
    // green so long as the five remain mutually non-containing.
    const marks = new Map(ALL.map((state) => [state, marksOf(state)] as const));
    for (const [state, set] of marks) {
      expect(set.size, `${state} draws nothing`).toBeGreaterThan(0);
      for (const [other, otherSet] of marks) {
        if (other === state) continue;
        expect(
          isSubsetOf(set, otherSet),
          `${state}'s mark is contained in ${other}'s — at size="sm" the mark is the ` +
            `whole signal, and a mark that is another mark plus a stroke is not a ` +
            `different silhouette, it is the same one with a detail nobody sees.`,
        ).toBe(false);
      }
    }
  });

  it('spends no colour at all — chrome is monochrome (BOARD rule 1, §1.3)', () => {
    // The one rule that carries the look, asserted against the one component most
    // tempted to break it: `Plan §10` calls drift "the same honesty rule as
    // connector health", and connector health IS data ink. The honesty rule is
    // adopted; the register is not. See tokens contract §10.2.
    for (const state of ALL) {
      const { container, unmount } = show(state);
      const html = container.innerHTML;
      expect(html, `${state} must not reach for data ink`).not.toMatch(/ink-(copper|teal|coral|lavender|amber|blue)/);
      expect(html, `${state} must not carry a raw colour`).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
      unmount();
    }
  });

  it('never renders the fork drift as a filled dot — fill is Chip’s, and Chip is data ink', () => {
    const { container } = show('drifted');
    const ring = container.querySelector('circle');
    expect(ring, 'drift is a ring, not a dot').not.toBeNull();
    // `fill` is set to "none" on the svg root and never overridden on the circle.
    expect(ring!.getAttribute('fill')).toBeNull();
    expect(container.querySelector('svg')!.getAttribute('fill')).toBe('none');
  });

  it('puts the two warning states one rung brighter than the settled ones (§9.4b)', () => {
    // The monochrome substitute for severity colour, and it opens the gap from
    // above — never by pushing the quiet state down into --ink-3, which §9.2 forbids.
    const tone = (state: ProvenanceState) => {
      const { container, unmount } = show(state);
      const cls = container.firstElementChild!.className;
      unmount();
      return cls;
    };
    for (const settled of ['global', 'project', 'fork'] as const) {
      expect(tone(settled)).toContain('text-ivory-2');
    }
    for (const warning of ['drifted', 'orphaned'] as const) {
      expect(tone(warning)).toMatch(/text-ivory(?!-2)/);
    }
  });

  it('is never rendered at --ink-2 or below, because it sits in hoverable rows (§9.5)', () => {
    // Light --ink-2 on --card-2 — the standard hover fill for every interactive row
    // in this product — is 4.25:1, sub-AA at the moment the pointer is on it. Solved
    // by construction rather than by a prop the call site would get wrong.
    for (const state of ALL) {
      const { container, unmount } = show(state);
      expect(container.firstElementChild!.className).not.toMatch(/text-ink-[23]\b/);
      unmount();
    }
  });

  it('says which library it came from out loud, in every state', () => {
    // §9.2's delete-the-text test in its strongest form: without this sentence a
    // reader does not lose a decoration, they believe they are looking at the
    // global agent when they are looking at a fork of it.
    for (const state of ALL) {
      const { unmount } = show(state);
      expect(screen.getByText(/Resolved from|Forked from/)).toBeTruthy();
      unmount();
    }
    const { container } = show('orphaned');
    expect(container.textContent).toContain('global/sales/database-mining');
    expect(container.textContent).toContain('The parent no longer exists');
  });

  it('keeps the mark and the whole accessible sentence when the label is dropped', () => {
    // size="sm" is for a MAP node and a dense row. A reader who cannot see the
    // silhouette must lose nothing at all.
    const { container } = render(
      <I18nProvider locale="en">
        <ProvenanceBadge state="drifted" commit="a1b2c3" parent="global/sales/x" size="sm" />
      </I18nProvider>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('bdi')).toBeNull();
    expect(container.textContent).toContain('The parent has changed since');
  });

  it('takes its strings from the catalogue, so check-rtl can see them', () => {
    // A hardcoded English word here would be invisible to the RTL sweep and would
    // ship untranslated. Asserted by rendering under `ar`: if the component held
    // its own strings, English would come out regardless of locale.
    //
    // This assertion used to expect the ENGLISH sentence, because these five keys
    // were `todo()` — an admitted gap, which is the right way to file a string you
    // cannot translate yet. `rtl-arabic-pdpl-specialist` translated them on
    // 2026-08-17 (the register reasoning is in strings.ar.ts beside the keys), so
    // the test now pins the property it was always about: the badge speaks the
    // reader's language, and no English leaks into an Arabic render.
    const { container } = render(
      <I18nProvider locale="ar">
        <ProvenanceBadge state="global" />
      </I18nProvider>,
    );
    expect(container.textContent).toContain('مأخوذ من المكتبة العامّة.');
    expect(container.textContent).not.toMatch(/[A-Za-z]{3,}/);
  });

  it('isolates its own bidi run and mirrors nothing', () => {
    // The marks are symbols, not arrows: a mirrored house is still a house, and
    // mirroring the fork would claim the lineage runs the other way.
    const { container } = show('fork');
    expect(container.querySelector('bdi')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/scale\(-1|rtl:|rotate/);
  });

  it('has no default state — provenance may not be spent by silence (§9.6a)', () => {
    // The type system is the enforcement: `state` is required and there is no
    // fallback branch. This asserts the *shape* the primitive-defaults deriver
    // reads, so a future refactor that adds `state = 'global'` fails here first.
    const source = ProvenanceBadge.toString();
    expect(source).not.toMatch(/state\s*=\s*['"]/);
  });
});
