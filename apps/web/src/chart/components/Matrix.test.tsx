import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Matrix } from './Matrix';
import { JobCard } from './JobCard';
import { buildMatrix, isEmptyCell } from '../model/matrix';
import { PHASE_COLUMNS, TIER_ROWS } from '../model/taxonomy';
import { marketingAgents } from '../model/__fixtures__/agents';

/**
 * The assembled board. These tests need the shared primitives and `lucide-react`, so they
 * are kept apart from the model and hatch tests, which must stay runnable on their own.
 */
const matrix = buildMatrix(marketingAgents);
const markup = renderToStaticMarkup(<Matrix matrix={matrix} departmentLabel="Marketing" />);
const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('<Matrix>', () => {
  it('is a real grid with three tier rows and four phase columns', () => {
    expect(markup).toContain('role="grid"');
    expect(occurrences(markup, 'role="row"')).toBe(4); // header row + 3 tier rows
    expect(occurrences(markup, 'role="gridcell"')).toBe(12);
    expect(occurrences(markup, 'role="rowheader"')).toBe(3);
    expect(occurrences(markup, 'role="columnheader"')).toBe(5); // corner + 4 phases
  });

  it('prints the three tier labels from §2.6.3 in full', () => {
    for (const row of TIER_ROWS) {
      expect(markup).toContain(row.label);
      expect(markup).toContain(row.gloss);
      expect(markup).toContain(`aria-label="${row.full}`);
    }
  });

  it('prints the four phase labels from §2.6.3 in full', () => {
    for (const column of PHASE_COLUMNS) {
      expect(markup).toContain(column.label);
      expect(markup).toContain(column.gloss);
      expect(markup).toContain(`${column.full}:`); // inside the dashes' accessible label
    }
  });

  it('renders one hatch block per empty cell and not one more', () => {
    const empties = matrix.cells.flat().filter(isEmptyCell).length;
    expect(empties).toBe(4);
    expect(occurrences(markup, 'data-empty="true"')).toBe(empties);
    expect(occurrences(markup, 'repeating-linear-gradient')).toBe(empties);
  });

  it('renders one job card per agent', () => {
    expect(occurrences(markup, 'data-testid="chart-job-card"')).toBe(marketingAgents.length);
  });

  it('shows a derived jobs-count pill on every tier row header', () => {
    expect(matrix.tierCounts).toEqual([2, 3, 7]);
    for (const [i, row] of TIER_ROWS.entries()) {
      expect(markup).toContain(`aria-label="${row.full} — ${matrix.tierCounts[i]} jobs"`);
    }
  });

  it('shows derived 4-segment progress dashes on every phase column header', () => {
    expect(occurrences(markup, 'data-testid="chart-progress-dashes"')).toBe(4);
    for (const [i, column] of PHASE_COLUMNS.entries()) {
      expect(markup).toContain(
        `aria-label="${column.full}: ${matrix.phaseProgress[i].filled} of 4 segments rolled out"`,
      );
    }
  });

  it('gives exactly one item the tabbable slot (roving tabindex)', () => {
    expect(occurrences(markup, 'tabindex="0"')).toBe(1);
  });

  it('carries no literal colour anywhere in the board', () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('<JobCard>', () => {
  const agent = marketingAgents[0];
  const collapsed = renderToStaticMarkup(
    <JobCard agent={agent} id="c" tabIndex={0} expanded={false} onToggle={() => {}} onMoreDetail={() => {}} />,
  );
  const expanded = renderToStaticMarkup(
    <JobCard agent={agent} id="c" tabIndex={0} expanded onToggle={() => {}} onMoreDetail={() => {}} />,
  );

  it('shows the name, the phase tag and the tier dots (§2.6.4)', () => {
    expect(collapsed).toContain(agent.name);
    expect(collapsed).toContain('1 · Foundation');
    expect(collapsed).toContain('data-testid="chart-phase-dots"');
    expect(collapsed).toContain('data-filled="1"');
  });

  it('sets the name at 13px/600', () => {
    // `text-small` IS the 13px rung of the §1.4 scale and `font-semibold` is the 600.
    // Asserted as tokens, not as `text-[13px]`: check-tokens.mjs rejects the arbitrary
    // value, so a test demanding one would pin the component to a build failure.
    expect(collapsed).toMatch(/class="[^"]*text-small[^"]*font-semibold/);
  });

  it('raises to --card-2 on hover', () => {
    expect(collapsed).toContain('hover:bg-card-2');
  });

  it('has a real expand control, not a div with a handler', () => {
    expect(collapsed).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(expanded).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(collapsed).toContain('data-testid="chart-chevron"');
  });

  it('reveals description, SKILLS chips and More detail only when expanded', () => {
    expect(collapsed).not.toContain(agent.description);
    expect(collapsed).not.toContain('More detail');
    expect(expanded).toContain(agent.description);
    expect(expanded).toContain('Skills');
    for (const skill of agent.skills) expect(expanded).toContain(skill);
    expect(expanded).toMatch(/<button[^>]*>More detail →<\/button>/);
  });
});
