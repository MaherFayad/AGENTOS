import { describe, expect, it } from 'vitest';
import { deriveStats, statLineSegments, statLineText } from './stats';
import { emptyDepartmentAgents, marketingAgents, specExampleAgents } from './__fixtures__/agents';

/**
 * REQ-CHT-08/09/10 — the stat line is DERIVED. These tests feed fixtures in and assert
 * the counts, which is the only way to prove a number on a credibility surface is real.
 */
describe('deriveStats', () => {
  it('counts each tier from the agent set, never from a literal', () => {
    expect(deriveStats(marketingAgents)).toEqual({
      total: 12,
      autonomous: 7,
      assisted: 3,
      humanLed: 2,
    });
  });

  it('reproduces the §2.6.2 example numbers when fed that agent set', () => {
    const stats = deriveStats(specExampleAgents);
    expect(stats.autonomous).toBe(18);
    expect(stats.total).toBe(23);
    expect(stats.assisted).toBe(5);
    expect(statLineText(stats)).toBe('18 of 23 jobs run autonomously · 5 assisted');
  });

  it('moves with the data — adding one autonomous agent moves both numerals', () => {
    const before = deriveStats(marketingAgents);
    const after = deriveStats([...marketingAgents, marketingAgents[0]]);
    expect(after.autonomous).toBe(before.autonomous + 1);
    expect(after.total).toBe(before.total + 1);
  });

  it('reports zeroes for an unstaffed department rather than inventing a rollout', () => {
    expect(deriveStats(emptyDepartmentAgents)).toEqual({
      total: 0,
      autonomous: 0,
      assisted: 0,
      humanLed: 0,
    });
  });
});

describe('statLineSegments', () => {
  it('renders the §2.6.2 sentence with the numerals emphasised', () => {
    const stats = deriveStats(marketingAgents);
    expect(statLineText(stats)).toBe('7 of 12 jobs run autonomously · 3 assisted · the rest stay human');
    expect(statLineSegments(stats).filter((s) => s.strong).map((s) => s.text)).toEqual([
      '7 of 12 jobs',
      '3 assisted',
    ]);
  });

  it('drops the "assisted" clause when no job is assisted', () => {
    const text = statLineText({ total: 4, autonomous: 3, assisted: 0, humanLed: 1 });
    expect(text).toBe('3 of 4 jobs run autonomously · the rest stay human');
  });

  it('drops "the rest stay human" when nothing stays human', () => {
    const text = statLineText({ total: 4, autonomous: 3, assisted: 1, humanLed: 0 });
    expect(text).toBe('3 of 4 jobs run autonomously · 1 assisted');
  });

  it('agrees in number when the department holds exactly one job', () => {
    expect(statLineText({ total: 1, autonomous: 1, assisted: 0, humanLed: 0 })).toBe(
      '1 of 1 job runs autonomously',
    );
  });
});
