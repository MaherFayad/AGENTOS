/**
 * REQ-DRW — the composing drawer projects frontmatter; the chart host consumes
 * `src/chart/events.ts` instead of forking it.
 *
 * REQ-DRW-PROV lives here too, and deliberately: `Header.test.tsx` proves the *component*
 * by handing it a `DrawerProvenance` it built itself, which is a test of the renderer and
 * not of the wiring. The wiring is the seam this file owns — a fetched `AgentDetail`, the
 * drawer's own state, the one expression that decides what the header is handed — and it
 * is where the bug the M15 verdict found actually lived.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { OPEN_DRAWER_EVENT, openDrawer } from '../chart/events';
import { planInputs } from './data/inputs';
import { projectAgent } from './data/project';
import type { AgentDoc } from './data/types';
import { JobDrawer } from './JobDrawer';
import { InputsForm } from './sections/InputsForm';
import { AutonomyToggleRow } from './sections/ChartSections';
import { Ladder } from './sections/Ladder';

/**
 * The drawer reads the project from the address bar. The factory imports nothing, which is
 * the rule `components/shell/test-mocks.tsx` records: a `vi.mock` factory's import graph
 * must be acyclic or the worker hangs at import time rather than failing.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/p/agentos/map',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const ENRICHMENT: AgentDoc = {
  slug: 'sales/account-enrichment',
  // Only the frontmatter of this fixture is used below; the provenance suite builds its own
  // wire response. `null` because the projection must not grow an opinion about provenance.
  sourceRef: null,
  frontmatter: {
    name: 'Account Enrichment',
    department: 'sales',
    cluster: 'enrichment',
    tier: 'autonomous',
    description: 'Layer firmographics onto target accounts.',
    replaces: 'The research step everyone skips.',
    the_human: 'A human audits outputs on a cadence.',
    wired_into: ['exa', 'firecrawl'],
    breaks_into: ['firmographic-appender'],
    builds_on: ['database-mining'],
    ladder: {
      'human-led': 'A glance at the website.',
      assisted: 'Signals appended on demand.',
      autonomous: 'Accounts re-enrich on a schedule.',
    },
    inputs: [{ key: 'account_url', label: 'Account website', type: 'url', required: true }],
  },
};

describe('composed anatomy (projection + sections)', () => {
  const model = projectAgent(ENRICHMENT);

  it('derives the INPUTS form from frontmatter, not from the agent name', () => {
    const plan = planInputs(ENRICHMENT.frontmatter.inputs);
    const markup = renderToStaticMarkup(
      <InputsForm fields={plan.fields} unsupported={plan.unsupported} values={{ account_url: '' }} errors={{}} onChange={() => undefined} />,
    );
    expect(markup).toContain('Account website');
    expect(markup).toContain('type="url"');
    expect(markup).toContain('required');
    expect(markup).not.toContain('Account Enrichment');
    expect(plan.fields[0]?.key).toBe('account_url');
  });

  it('marks the active ladder row and only the chart flavour adds NOW', () => {
    const map = renderToStaticMarkup(<Ladder rows={model.ladder} />);
    const chart = renderToStaticMarkup(<Ladder rows={model.ladder} nowBadge />);
    expect(map).toContain('data-active="true"');
    // The badge is `.nowBadge` in the chart flavour and `.srOnly` in the map flavour — same
    // word, different visibility. Uppercase is `text-transform`, so assert the class.
    expect(map).not.toContain('nowBadge');
    expect(chart).toContain('nowBadge');
  });

  /**
   * §2.3.9 marks the active rung by colour. Colour may not be the only carrier (WCAG 1.4.1),
   * and unlike the chart flavour the map flavour has no `NOW` text to fall back on — so the
   * map flavour must say it in words, and both flavours must say it in the a11y tree.
   */
  it('does not mark the active ladder rung by colour alone, in either flavour', () => {
    const map = renderToStaticMarkup(<Ladder rows={model.ladder} />);
    const chart = renderToStaticMarkup(<Ladder rows={model.ladder} nowBadge />);

    expect(map).toContain('aria-current="true"');
    expect(chart).toContain('aria-current="true"');
    // exactly one rung is current
    expect(map.match(/aria-current="true"/g)).toHaveLength(1);

    // The map flavour has no visible badge, so the word must still be in the a11y tree.
    expect(map).toContain('srOnly');
    expect(map).toContain('Now');
    // Both flavours announce the same word; the chart's is simply visible.
    expect(chart).toContain('Now');
  });

  it('renders the chart autonomy toggle as a readout, not a control', () => {
    const markup = renderToStaticMarkup(<AutonomyToggleRow tier={model.tier} />);
    expect(markup).toContain('disabled');
    expect(markup).toContain('FULLY AUTONOMOUS');
    expect(markup).toContain('aria-pressed="true"');
  });
});

/**
 * REQ-DRW-PROV — the seam, not the component.
 *
 * The observable this asserts, in one sentence: **open an agent, run nothing, and the
 * header names a real layer.** It failed for the whole of M15 and no test was red, because
 * every provenance test either built a `DrawerProvenance` by hand and passed it in
 * (`Header.test.tsx`) or tested the parser in isolation (`provenance.test.ts`). The one
 * untested line — which of the two sources the drawer hands the header — was the one that
 * was wrong: it read the run stream only, and zero runs have ever executed.
 *
 * So this drives from the wire shape `GET /api/p/:project/agents/:slug` actually answers,
 * with **no run started and no run stream to fall back on**. Nothing here may be an
 * injected prop; the point is the wiring between them.
 */
describe('provenance reaches the header from the agent read, with no run', () => {
  const DIGEST = 'c'.repeat(64);

  /** `AgentDetail` as the runner sends it — `toAgentDetail(record, sourceRef)`. */
  const detail = (sourceRef?: string) => ({
    slug: 'sales/account-enrichment',
    path: 'agents/sales/account-enrichment/SKILL.md',
    ...(sourceRef === undefined ? {} : { sourceRef }),
    frontmatter: ENRICHMENT.frontmatter,
    body: '',
    runnable: { tools: [], missingConnectors: [], approvalRequired: false, scheduled: false },
  });

  /**
   * Answers the three reads the drawer makes on open, by URL. LAST RUNS is empty and the
   * runner is unconfigured on purpose: this is the tree exactly as it stands — no run has
   * ever executed — and the header must still be able to say where the agent came from.
   */
  function serve(agent: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/metrics/runs')
          ? { runs: [] }
          : url === '/api/status'
            ? { runnerConfigured: false }
            : agent;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  }

  const openDrawerAt = (side: 'left' | 'right' = 'left') =>
    render(
      <I18nProvider locale="en">
        <JobDrawer slug="sales/account-enrichment" side={side} open onClose={() => undefined} />
      </I18nProvider>,
    );

  afterEach(() => vi.unstubAllGlobals());

  it('names the layer the cascade resolved, without a run having executed', async () => {
    serve(detail(`project:agents/sales/account-enrichment/SKILL.md@sha256:${DIGEST}`));
    const { container } = openDrawerAt();
    await screen.findByText('Account Enrichment');

    expect(container.textContent).toContain("Resolved from this project's library.");
    expect(container.textContent).not.toContain('Source unknown');
  });

  it('tells global from project on the agent read alone', async () => {
    // If the drawer ever went back to reading only the run stream, both of these would be
    // `Source unknown` and this pair would be the assertion that says so.
    serve(detail(`global:agents/sales/account-enrichment/SKILL.md@sha256:${DIGEST}`));
    const { container } = openDrawerAt();
    await screen.findByText('Account Enrichment');
    expect(container.textContent).toContain('Resolved from the global library.');
  });

  it('carries it into the chart mirror too — §2.6.5 is the same header', async () => {
    serve(detail(`project:agents/sales/account-enrichment/SKILL.md@sha256:${DIGEST}`));
    const { container } = openDrawerAt('right');
    await screen.findByText('Account Enrichment');
    expect(container.textContent).toContain("Resolved from this project's library.");
  });

  it('stays unknown when the runner sends no sourceRef, rather than inventing one', async () => {
    // An older runner than the contract. `sourceRef` is required on `AgentDetail`, so this
    // is a build mismatch and not a state the current runner can produce — and silence is
    // still not a layer. The badge draws no mark here (`Header.test.tsx` holds that line).
    serve(detail(undefined));
    const { container } = openDrawerAt();
    await screen.findByText('Account Enrichment');
    expect(container.textContent).toContain('Source unknown');
    expect(container.textContent).not.toContain('Resolved from');
  });

  it('refuses a sourceRef it cannot read rather than half-reading it', async () => {
    serve(detail('library:agents/sales/account-enrichment/SKILL.md@md5:beef'));
    const { container } = openDrawerAt();
    await screen.findByText('Account Enrichment');
    expect(container.textContent).toContain('Source unknown');
  });
});

describe('chart openDrawer is consumed, not forked', () => {
  it('keeps the chart event name as the cross-agent contract', () => {
    expect(OPEN_DRAWER_EVENT).toBe('commandcenter:open-drawer');
  });

  it('asks for the right side when CHART emits a selection', () => {
    const handler = vi.fn();
    const detail = openDrawer('sales/account-enrichment', { handler });
    expect(detail.side).toBe('right');
    expect(detail.source).toBe('chart');
    expect(handler).toHaveBeenCalledWith(detail);
  });
});
