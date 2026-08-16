/**
 * REQ-DRW — the composing drawer projects frontmatter; the chart host consumes
 * `src/chart/events.ts` instead of forking it.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OPEN_DRAWER_EVENT, openDrawer } from '../chart/events';
import { planInputs } from './data/inputs';
import { projectAgent } from './data/project';
import type { AgentDoc } from './data/types';
import { InputsForm } from './sections/InputsForm';
import { AutonomyToggleRow } from './sections/ChartSections';
import { Ladder } from './sections/Ladder';

const ENRICHMENT: AgentDoc = {
  slug: 'sales/account-enrichment',
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
