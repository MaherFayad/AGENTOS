/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  addressCost,
  parseThreadAddress,
  type AddressForm,
  type ResolvedThreadAddress,
  type ThreadAddress,
  type TurnCost,
} from '@agnetos/contracts';
import { I18nProvider } from '@/i18n/provider';
import { en } from '@/i18n/strings.en';
import { ar } from '@/i18n/strings.ar';
import { AddressBadge, OPEN_ENDED_FORMS } from './AddressBadge';

/**
 * REQ-DS-104…108, REQ-DS-112.
 *
 * `Plan §12` makes this a spend control, not a decoration: *"a UI that makes
 * broadcast easy to trigger accidentally will cost real money on the first day."*
 * So these tests assert on **distinguishability** and on **what cannot be
 * rendered**, never on path data — the marks may be redrawn, and should be, without
 * touching a single assertion here.
 */

const ADDRESSES: Record<AddressForm, ThreadAddress> = {
  direct: { form: 'direct', department: 'sales', slug: 'account-enrichment' },
  dispatch: { form: 'dispatch', department: 'sales' },
  'fan-out': { form: 'fan-out', department: 'sales' },
  default: { form: 'default' },
};

const FORMS = Object.keys(ADDRESSES) as AddressForm[];

const show = (form: AddressForm, cost?: TurnCost | 'unresolved', locale: 'en' | 'ar' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <AddressBadge address={ADDRESSES[form]} cost={cost} />
    </I18nProvider>,
  );

/** The strokes a form draws, normalised — shape only, no styling. */
const drawn = (root: HTMLElement) =>
  new Set([...root.querySelectorAll('svg path')].map((n) => n.getAttribute('d') ?? ''));

const isSubsetOf = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

/** Everything the badge paints, so a colour assertion cannot miss a nested node. */
const classesOf = (root: HTMLElement) =>
  [...root.querySelectorAll('*')].map((n) => n.getAttribute('class') ?? '').join(' ');

describe('AddressBadge — the addressing register (Plan §12, tokens contract §11)', () => {
  it('draws a mark no other form contains — the arity survives greyscale', () => {
    // Distinctness alone is too weak, and `ProvenanceBadge` measured why: a mutation
    // that made one state draw another state's strokes *plus* one more passed a
    // distinctness check and failed a containment one. A mark that is another mark
    // with a stroke on top is the same silhouette with a detail nobody sees at 12px.
    const marks = new Map(
      FORMS.map((form) => {
        const { container, unmount } = show(form);
        const set = drawn(container);
        unmount();
        return [form, set] as const;
      }),
    );
    for (const [form, set] of marks) {
      expect(set.size, `${form} draws nothing`).toBeGreaterThan(0);
      for (const [other, otherSet] of marks) {
        if (other === form) continue;
        expect(
          isSubsetOf(set, otherSet),
          `${form}'s mark is contained in ${other}'s. These four are the difference ` +
            `between one run and N, and a containment is not a different silhouette.`,
        ).toBe(false);
      }
    }
  });

  it('gives fan-out a silhouette nothing else in the product has', () => {
    // THE ONE THAT COSTS MONEY. `Plan §12`: "#sales and @@sales must be different
    // characters and must *look* different, because one costs one run and the other
    // costs six." Discontinuous, not one weight step: the fan-out badge is two
    // plates. Asserted as "the stacked lip exists on fan-out and on nothing else",
    // which survives any redraw of the lip itself.
    const lip = (form: AddressForm) => {
      const { container, unmount } = show(form);
      // The lip is the only decorative sibling of the frame — an aria-hidden span
      // with no text, drawn as a border.
      const found = [...container.querySelectorAll('span[aria-hidden]')].filter(
        (n) => n.textContent === '' && (n.getAttribute('class') ?? '').includes('border'),
      ).length;
      unmount();
      return found;
    };
    expect(lip('fan-out'), 'fan-out must be stacked').toBeGreaterThan(0);
    for (const form of ['direct', 'dispatch', 'default'] as const) {
      expect(lip(form), `${form} must be a single plate`).toBe(0);
    }
  });

  it('draws the open end exactly when the count is a lower bound', () => {
    // "The open end is the lower bound" is one drawing rule across four marks, and
    // this is the assertion that keeps it honest: the drawing and `addressCost()`
    // must agree, so a redraw that forgets the rule fails here rather than shipping
    // a flat "1 run" beside a mechanism that routinely costs two.
    //
    // Its limit, stated rather than implied: this binds the LABEL on a stroke to the
    // contract, not the pixels to the label. A redraw that moves `data-open-end`
    // onto the wrong stroke passes, and that is a review question.
    for (const form of FORMS) {
      const resolved = { ...ADDRESSES[form], department: 'sales' } as ResolvedThreadAddress;
      const exact = addressCost(resolved, 4).runsAreExact;
      const { container, unmount } = show(form);
      const hasOpenEnd = container.querySelector('[data-open-end]') !== null;
      expect(
        hasOpenEnd,
        `${form}: runsAreExact is ${exact}, so the mark ${exact ? 'must not' : 'must'} ` +
          `draw a free end.`,
      ).toBe(!exact);
      expect(OPEN_ENDED_FORMS.includes(form)).toBe(!exact);
      unmount();
    }
  });

  it('spends no colour at all — chrome is monochrome (BOARD rule 1, §1.3)', () => {
    // An address is not a status. Nothing is wrong, nothing is running, nothing needs
    // a human — and a price rendered in a status hue would put money in the same
    // visual drawer as "at risk".
    for (const form of FORMS) {
      const { container, unmount } = show(form, addressCost({ form: 'direct', department: 'sales', slug: 'x' }, 0));
      const html = container.innerHTML;
      expect(html, `${form} must not reach for data ink`).not.toMatch(
        /ink-(copper|teal|coral|lavender|amber|blue)/,
      );
      expect(html, `${form} must not carry a raw colour`).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
      unmount();
    }
  });

  it('puts the expensive form one rung brighter, and steps the frame with it (§9.4b)', () => {
    // The monochrome substitute for severity, opening the gap from ABOVE — never by
    // pushing the settled forms down into --ink-3, which §9.2 forbids outright. Same
    // instrument as ProvenanceBadge's two warning states, deliberately, so the two
    // badges are one dialect rather than two.
    const paint = (form: AddressForm) => {
      const { container, unmount } = show(form);
      const cls = classesOf(container);
      unmount();
      return cls;
    };
    for (const settled of ['direct', 'dispatch', 'default'] as const) {
      expect(paint(settled)).toContain('text-ivory-2');
    }
    expect(paint('fan-out')).toMatch(/text-ivory(?!-2)/);
    expect(paint('fan-out')).toContain('border-line-2');

    // EVERY line token on the expensive form steps, not just the frame's — including
    // the stacked lip, which is the element that carries channel 2. Found by
    // `fidelity-qa-reviewer` as source self-contradiction: the lip was `border-line`,
    // one rung BELOW the plate it sits on and identical to the three cheap forms,
    // while the frame stepped up. The channel a reader resolves without reading was
    // drawn at the weakest token in the component and the channel that merely confirms
    // was drawn at the strongest. Asserted as an absence so any new stroke added to
    // this form has to step too.
    expect(
      paint('fan-out'),
      'the expensive form may carry no unstepped line token — §9.4b opens the gap from above',
    ).not.toMatch(/border-line(?!-2)/);
  });

  it('cannot be made to print a money figure', () => {
    // `Plan §23.8` asks for "@@sales · 4 runs · ~$0.40". The 4 is the resolved member
    // count and is real. The $0.40 has no source: zero runs have ever completed, so
    // there is nothing to average, and a cost preview is exactly the surface where a
    // plausible number gets believed (BOARD rule 9).
    //
    // Swept across every form, both locales and both exactness values, because the
    // hole this closes is a currency symbol arriving through a translated string
    // rather than through a prop.
    const MONEY = /[$£€¥₹]|\bUSD\b|\bSAR\b|\d+[.,]\d{2}\b/;
    for (const form of FORMS) {
      for (const locale of ['en', 'ar'] as const) {
        for (const cost of [
          { runs: 4, runsAreExact: true, estimatedUsd: null, estimateBasis: 'no-completed-runs' },
          { runs: 1, runsAreExact: false, estimatedUsd: null, estimateBasis: 'no-completed-runs' },
          'unresolved' as const,
        ] satisfies (TurnCost | 'unresolved')[]) {
          const { container, unmount } = show(form, cost, locale);
          expect(container.textContent ?? '', `${form}/${locale} printed money`).not.toMatch(MONEY);
          unmount();
        }
      }
    }
  });

  it('has no prop that could carry a money figure', () => {
    // The type is the mechanism; the sweep above is the belt. `estimatedUsd` is typed
    // as the only value it may hold by its owner (thread-model §6), so the day real
    // runs exist, widening it is a reviewable diff that has to say where the figure
    // came from — and this line is what fails first.
    //
    // THE DIRECTIVE WAS ON THE WRONG LINE, and this is the second defect in the same
    // four lines. It sat above `const _priced: TurnCost = {`, which is where the
    // *declaration* is; the assignment that actually violates `estimatedUsd: null` is
    // below. `@ts-expect-error` suppresses the line it precedes, so even in a world
    // where this suite had always been typechecked, this test would have reported
    // TS2578 *unused directive* rather than guarding BOARD rule 9 — inert AND
    // misaimed, on the one surface where a plausible number gets believed. Found by
    // `commandcenter-orchestrator` the moment `tsconfig.test.json` made the suite
    // visible, which is the argument for the instrument in one sentence.
    const _priced: TurnCost = {
      runs: 4,
      runsAreExact: true,
      // @ts-expect-error — there is no slot for money in a TurnCost, by construction.
      estimatedUsd: 0.4,
      estimateBasis: 'no-completed-runs',
    };
    expect(_priced.runs).toBe(4);
  });

  it('tells a count that came back empty apart from a count nobody took', () => {
    // Two different facts. "This department has no members" is an answer; "the roster
    // has not resolved" is the absence of one, and collapsing them is BOARD rule 9 in
    // miniature. The unresolved state carries NO numeral at all — the absence of a
    // figure is the signal, which is why it does not borrow the chart's hatch.
    const measuredZero = show('fan-out', {
      runs: 0,
      runsAreExact: true,
      estimatedUsd: null,
      estimateBasis: 'no-completed-runs',
    });
    const zeroText = measuredZero.container.textContent ?? '';
    measuredZero.unmount();

    const unknown = show('fan-out', 'unresolved');
    const unknownText = unknown.container.textContent ?? '';
    unknown.unmount();

    expect(zeroText).not.toBe(unknownText);
    expect(zeroText).toContain('no runs');
    expect(unknownText).toContain('Runs not counted yet');
    expect(unknownText, 'an unresolved count may not show a number').not.toMatch(/\d/);
  });

  it('says the recipient out loud, without spelling the sigils at a screen reader', () => {
    // "@@sales" is announced as "at at sales". The typed form is the thing a person
    // reads and echoes back, so it stays visible and aria-hidden, and one complete
    // catalogue sentence carries the meaning — the same split ProvenanceBadge uses.
    const { container } = show('fan-out');
    expect(container.querySelector('bdi')?.textContent).toBe('@@sales');
    expect(container.querySelector('bdi')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).toContain('Goes to every member of sales');
  });

  it('isolates its own bidi run, because @ # and @@ are direction-neutral', () => {
    // The one RTL decision that needed making: an address sitting against Arabic text
    // takes its side from whatever runs beside it, so `@@sales` could render with the
    // sigils on the wrong end of the name with nothing in the component being wrong.
    // Declared in MIRRORS['threads.addressBadge']; enforced here.
    for (const form of ['direct', 'dispatch', 'fan-out'] as const) {
      const { container, unmount } = show(form, undefined, 'ar');
      expect(container.querySelector('bdi'), `${form} must isolate its sigil run`).not.toBeNull();
      unmount();
    }
    // And nothing mirrors itself by hand: the marks are block-axis, the spacing is
    // `gap`, the stack lip is inset symmetrically.
    const { container } = show('fan-out', undefined, 'ar');
    expect(container.innerHTML).not.toMatch(/scale\(-1|rtl:|\bml-|\bmr-|\bleft-|\bright-/);
  });

  it('renders the address a person actually typed, parser and badge agreeing', () => {
    // The badge is the composer's echo. If it disagreed with the parser about what
    // "@@sales" means, the preview would price a different message than the one the
    // send button sends.
    const parsed = parseThreadAddress('@@sales review the pipeline');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { container } = render(
      <I18nProvider locale="en">
        <AddressBadge address={parsed.address} cost={addressCost(parsed.address as ResolvedThreadAddress, 4)} />
      </I18nProvider>,
    );
    expect(container.querySelector('bdi')?.textContent).toBe('@@sales');
    expect(container.textContent).toContain('4 runs');
  });

  it('is legal inside the @@ confirm button — it takes no focus of its own', () => {
    // BOARD Hazard 1: "@@ requires an explicit confirm that names the count — not a
    // tooltip, not a hover — reachable AND dismissable from the keyboard." A composer
    // wraps this badge in that button, and a button containing a focusable node is
    // not reachable. So the badge contributes the count and no tab stop.
    const { container } = show('fan-out', {
      runs: 4,
      runsAreExact: true,
      estimatedUsd: null,
      estimateBasis: 'no-completed-runs',
    });
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(container.querySelector('button, a, input, select, textarea')).toBeNull();
  });

  it('never animates — alive is copper’s word, and this is chrome', () => {
    for (const form of FORMS) {
      const { container, unmount } = show(form);
      expect(classesOf(container)).not.toMatch(/\banimate-|\btransition\b|duration-/);
      unmount();
    }
  });

  it('leaves no thread copy anywhere in either catalogue that could carry money', () => {
    // Wider than the render sweep above, and deliberately so: it covers the keys this
    // badge does not render, the keys the interrupt register renders, and every future
    // `threads.` key nobody has written yet.
    //
    // Composed with a gate rather than claimed alone: `check-rtl` already fails an
    // uncatalogued user-visible string, so a composer cannot print money as a literal
    // either. What neither can see is an interpolated value, and that is stated in the
    // contract (§11.3) as a review question rather than papered over.
    const MONEY = /[$£€¥₹]|\bUSD\b|\bSAR\b|\d+[.,]\d{2}\b/;
    const walk = (entry: unknown): string[] =>
      typeof entry === 'string'
        ? [entry]
        : typeof entry === 'object' && entry !== null
          ? Object.values(entry as Record<string, unknown>).flatMap(walk)
          : [];

    for (const [name, catalogue] of [
      ['en', en],
      ['ar', ar],
    ] as const) {
      const threadKeys = Object.entries(catalogue).filter(([k]) => k.startsWith('threads.'));
      expect(threadKeys.length, `${name} must actually hold thread copy`).toBeGreaterThan(0);
      for (const [key, entry] of threadKeys) {
        for (const text of walk(entry)) {
          expect(text, `${name}/${key} holds a money figure and nothing can source one`).not.toMatch(
            MONEY,
          );
        }
      }
    }
  });

  it('has no default address — a recipient may not be spent by silence (§9.6a)', () => {
    // `address` is required and there is no fallback branch. This asserts the *shape*
    // the primitive-defaults deriver reads, so a refactor adding `address = …` fails
    // here first.
    expect(AddressBadge.toString()).not.toMatch(/address\s*=\s*[{'"]/);
  });
});
