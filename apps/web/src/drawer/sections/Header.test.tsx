/** @vitest-environment jsdom */

/**
 * REQ-DRW-PROV — provenance in the drawer header, on both sides. `Plan §23.6`.
 *
 * §2.3's drawer and §2.6.5's mirror are two projections of one frontmatter, and this slice
 * is the sharpest test of that claim: there is one header component, so there is exactly one
 * place provenance can differ between the two views, and it is this file's job to prove it
 * does not.
 *
 * Owner: drawer-engineer
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import { PROVENANCE_UNKNOWN, provenanceOfSourceRef, type DrawerProvenance } from '../data/provenance';
import { DrawerHeader } from './Header';

const DIGEST = 'b'.repeat(64);
const PROJECT = provenanceOfSourceRef(`project:agents/sales/database-mining/SKILL.md@sha256:${DIGEST}`);
const GLOBAL = provenanceOfSourceRef(`global:agents/sales/database-mining/SKILL.md@sha256:${DIGEST}`);

/** The map header (§2.3) and the chart mirror (§2.6.5) differ only in their eyebrow field. */
const header = (provenance: DrawerProvenance, eyebrow = 'FULLY AUTONOMOUS') =>
  render(
    <I18nProvider locale="en">
      <DrawerHeader
        eyebrow={eyebrow}
        title="Database Mining"
        breadcrumb="Sales · Enrichment"
        description="Mine the CRM for accounts nobody has touched."
        provenance={provenance}
        titleId="t"
        onClose={() => undefined}
      />
    </I18nProvider>,
  );

describe('provenance in the drawer header', () => {
  it('renders the badge for a resolved layer, in the map drawer and the chart mirror alike', () => {
    for (const eyebrow of ['FULLY AUTONOMOUS', 'COMPANIES']) {
      const { container, unmount } = header(PROJECT, eyebrow);
      expect(container.textContent).toContain(eyebrow);
      expect(container.textContent).toContain("Resolved from this project's library.");
      expect(container.querySelector('svg'), 'the badge draws its mark').not.toBeNull();
      unmount();
    }
  });

  it('tells global and project apart — which is the entire point of the badge', () => {
    // ADR-014 §2: a project override and its global parent share a slug and a name by
    // design. Delete this badge and the reader does not lose a decoration, they believe
    // they are looking at the global agent when they are looking at the project's own.
    const g = header(GLOBAL);
    const gText = g.container.textContent ?? '';
    g.unmount();
    const p = header(PROJECT);
    const pText = p.container.textContent ?? '';
    p.unmount();
    expect(gText).not.toBe(pText);
    expect(gText).toContain('Resolved from the global library.');
  });

  it('says UNKNOWN out loud rather than defaulting to global', () => {
    // BOARD rule 9 / Part VII.3, one plane over from the numbers: `unknown` is not `zero`
    // and it is not `global` either. An empty state that says so beats a badge that guesses.
    const { container } = header(PROVENANCE_UNKNOWN);
    expect(container.textContent).toContain('Source unknown');
    expect(container.textContent).toContain('is not known');
    expect(container.textContent).not.toContain('Resolved from');
  });

  it('draws no mark in the unknown state — a mark is a claim about a layer', () => {
    // The unknown branch must not drift into becoming a sixth badge. Every silhouette the
    // primitive owns asserts a layer; this asserts nothing, and it has to keep looking like
    // nothing. `design-system-guardian` owns the five states and there is no request in for
    // a sixth.
    const { container } = header(PROVENANCE_UNKNOWN);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps the unknown state out of the disabled colour', () => {
    // `--ink-3` is 3.57:1 dark / 3.00:1 light and is glossed "faint text / disabled".
    // An honest empty state is content, and `drawer-contrast.test.ts` enforces the same
    // rule for every other empty state in this drawer.
    const { container } = header(PROVENANCE_UNKNOWN);
    const el = container.querySelector('[class*="provenanceUnknown"]');
    expect(el, 'the unknown marker has its own class so the contrast test can see it').not.toBeNull();
  });

  it('takes its words from the catalogue, so an Arabic reader is not shown English chrome', () => {
    // `todo()` is an admitted gap, not a hardcoded string: the key exists in both
    // catalogues, `check-rtl.mjs` can see it, and `untranslatedKeys('ar')` counts it. What
    // this asserts is that the component does not hold the word itself — swap the locale and
    // the lookup still goes through the catalogue.
    const { container } = render(
      <I18nProvider locale="ar">
        <DrawerHeader
          eyebrow="FULLY AUTONOMOUS"
          title="Database Mining"
          provenance={GLOBAL}
          titleId="t"
          onClose={() => undefined}
        />
      </I18nProvider>,
    );
    expect(container.textContent).toContain('مأخوذ من المكتبة العامّة.');
  });

  it('keeps the close button reachable with the extra label in the row', () => {
    const { container } = header(PROVENANCE_UNKNOWN);
    const close = container.querySelector('button[aria-label]');
    expect(close).not.toBeNull();
    expect(close!.getAttribute('aria-label')).toBe('Close');
  });
});
