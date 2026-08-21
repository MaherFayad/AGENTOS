import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyCell } from './EmptyCell';
import { HATCH_ANGLE_DEG, HATCH_BACKGROUND } from '../model/hatch';
import { buildMatrix, isEmptyCell } from '../model/matrix';
import { posId } from '../model/keyboard';
import { phaseColumn, tierRow } from '../model/taxonomy';
import { emptyDepartmentAgents, designAgents } from '../model/__fixtures__/agents';

/**
 * REQ-CHT-31/32 — §2.6.6. Every empty tier × phase renders the diagonal-hatch block.
 * The test walks the real matrix, so a cell that stops being empty stops being checked
 * and a cell that becomes empty is checked automatically.
 */
describe('<EmptyCell> — the §2.6.6 hatch', () => {
  const matrix = buildMatrix(designAgents);
  const empties = matrix.cells.flat().filter(isEmptyCell);

  it('has empty cells to test in the first place', () => {
    expect(empties.length).toBeGreaterThan(0);
  });

  it('renders a 45° repeating-linear-gradient in --line for EVERY empty cell', () => {
    for (const cell of empties) {
      const markup = renderToStaticMarkup(
        <EmptyCell
          id={posId({ row: cell.row, col: cell.col, item: 0 })}
          tabIndex={-1}
          tierLabel={tierRow(cell.tier).full}
          phaseLabel={phaseColumn(cell.phase).full}
        />,
      );
      expect(markup).toContain('repeating-linear-gradient');
      expect(markup).toContain(`${HATCH_ANGLE_DEG}deg`);
      expect(markup).toContain('var(--line)');
      expect(markup).toContain(HATCH_BACKGROUND);
    }
  });

  it('hatches every one of the twelve cells when a department is unstaffed', () => {
    const cells = buildMatrix(emptyDepartmentAgents).cells.flat();
    expect(cells).toHaveLength(12);
    expect(cells.every(isEmptyCell)).toBe(true);
  });

  it('uses no literal colour — the stripe is the --line token', () => {
    const markup = renderToStaticMarkup(
      <EmptyCell id="x" tabIndex={-1} tierLabel="Human-led — a person drives it" phaseLabel="2 Capture — Classify, extract, score" />,
    );
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toMatch(/rgba?\(/);
  });

  it('announces itself instead of reading as an unlabelled gap', () => {
    const markup = renderToStaticMarkup(
      <EmptyCell
        id="x"
        tabIndex={0}
        tierLabel="Human-assisted — AI drafts, a human approves"
        phaseLabel="4 Orchestrate — Agents, monitoring, loops"
      />,
    );
    expect(markup).toContain(
      'aria-label="No jobs yet · Human-assisted — AI drafts, a human approves · 4 Orchestrate — Agents, monitoring, loops"',
    );
  });

  it('stays keyboard reachable — an empty cell is information, not a gap to skip', () => {
    const focused = renderToStaticMarkup(<EmptyCell id="x" tabIndex={0} tierLabel="t" phaseLabel="p" />);
    const resting = renderToStaticMarkup(<EmptyCell id="x" tabIndex={-1} tierLabel="t" phaseLabel="p" />);
    expect(focused).toContain('tabindex="0"');
    expect(resting).toContain('tabindex="-1"');
  });
});
