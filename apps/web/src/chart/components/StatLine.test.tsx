import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatLine } from './StatLine';
import { deriveStats } from '../model/stats';
import { designAgents, specExampleAgents } from '../model/__fixtures__/agents';

const text = (markup: string) => markup.replace(/<[^>]+>/g, '');

/**
 * REQ-CHT-08 — the stat line is derived from the agent set. Feed fixtures, assert counts.
 * If this test can be made to pass with a hardcoded string, the requirement is broken.
 */
describe('<StatLine>', () => {
  it('renders the §2.6.2 sentence from the counted agent set', () => {
    const markup = renderToStaticMarkup(<StatLine stats={deriveStats(specExampleAgents)} />);
    expect(text(markup)).toBe('18 of 23 jobs run autonomously · 5 assisted');
  });

  it('changes when the agent set changes — nothing here is authored', () => {
    const markup = renderToStaticMarkup(<StatLine stats={deriveStats(designAgents)} />);
    expect(text(markup)).toBe('7 of 12 jobs run autonomously · 3 assisted · the rest stay human');

    const withOneMore = renderToStaticMarkup(
      <StatLine stats={deriveStats([...designAgents, designAgents[0]])} />,
    );
    expect(text(withOneMore)).toContain('8 of 13 jobs');
  });

  it('emphasises the numerals and sets them in tabular figures', () => {
    const markup = renderToStaticMarkup(<StatLine stats={deriveStats(designAgents)} />);
    expect(markup).toContain('<strong');
    expect(markup).toMatch(/<strong[^>]*>7 of 12 jobs<\/strong>/);
    expect(markup).toMatch(/<strong[^>]*class="[^"]*tabular-nums/);
  });

  it('carries no colour of its own — chrome is monochrome', () => {
    const markup = renderToStaticMarkup(<StatLine stats={deriveStats(designAgents)} />);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
