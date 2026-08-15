import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartView } from './ChartView';
import { DEPARTMENTS } from '../data/contracts';
import { marketingAgents } from '../model/__fixtures__/agents';

/**
 * REQ-CHT-01/02/03 — the department tab bar.
 *
 * This test imports the real `DEPARTMENTS` table on purpose: the tab bar's contents and
 * ORDER are ADR-001's, and the only way to prove CHART did not quietly hardcode its own
 * seven is to compare against the contract at runtime.
 */
describe('<ChartView> department tabs', () => {
  const markup = renderToStaticMarkup(<ChartView agents={marketingAgents} department="marketing" />);

  it('renders all seven departments', () => {
    expect(DEPARTMENTS).toHaveLength(7);
    expect(markup.match(/role="tab"/g) ?? []).toHaveLength(7);
  });

  it('renders them in the ADR-001 order, left to right', () => {
    const positions = DEPARTMENTS.map((d) => markup.indexOf(`>${d.label}`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('marks the active department with an ivory underline', () => {
    expect(markup).toContain('aria-selected="true"');
    expect(markup.match(/aria-selected="true"/g) ?? []).toHaveLength(1);
    expect(markup).toContain('data-testid="chart-tab-underline"');
    expect(markup).toMatch(/data-testid="chart-tab-underline"[^>]*class="[^"]*bg-ivory/);
  });
});

describe('<ChartView> composition', () => {
  it('shows the title block, the derived stat line and the board for a staffed department', () => {
    const markup = renderToStaticMarkup(
      <ChartView agents={marketingAgents} department="marketing" />,
    );
    expect(markup).toContain('Marketing');
    expect(markup).toContain('the AI ');
    expect(markup).toContain('rollout');
    expect(markup).toContain('7 of 12 jobs');
    expect(markup).toContain('data-testid="chart-matrix"');
    expect(markup).toContain('data-testid="chart-tier-legend"');
  });

  it('shows an honest empty state — not a fabricated grid — for an unstaffed department', () => {
    const markup = renderToStaticMarkup(
      <ChartView agents={marketingAgents} department="back-office" />,
    );
    expect(markup).toContain('data-testid="chart-empty-state"');
    expect(markup).not.toContain('data-testid="chart-matrix"');
    expect(markup).not.toContain('data-testid="chart-stat-line"');
    expect(markup).toContain('No jobs mapped in Back Office yet.');
  });

  it('says so plainly when the library could not be read', () => {
    const markup = renderToStaticMarkup(
      <ChartView agents={[]} department="marketing" error="agent library unreachable" />,
    );
    expect(markup).toContain('The agent library could not be read.');
    expect(markup).toContain('agent library unreachable');
  });

  it('shows one department at a time — a tab is a filter, not a section', () => {
    const mixed = [
      ...marketingAgents,
      { ...marketingAgents[0], slug: 'sales/other', department: 'sales' as const, name: 'Other Job' },
    ];
    const markup = renderToStaticMarkup(<ChartView agents={mixed} department="marketing" />);
    expect(markup).not.toContain('Other Job');
    expect(markup).toContain('7 of 12 jobs');
  });
});
