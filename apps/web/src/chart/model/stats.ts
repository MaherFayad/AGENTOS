import type { ChartAgent, ChartStats } from '../types';

/**
 * The title-block stat line (§2.6.2):
 *
 *   **18 of 23 jobs** run autonomously · **5 assisted** · the rest stay human
 *
 * Every numeral is counted from frontmatter `tier`. This view is a credibility surface —
 * a hardcoded number here is a lie that outlives the person who typed it (Part VII.3).
 */

export function deriveStats(agents: readonly ChartAgent[]): ChartStats {
  return {
    total: agents.length,
    autonomous: agents.filter((a) => a.tier === 'autonomous').length,
    assisted: agents.filter((a) => a.tier === 'assisted').length,
    humanLed: agents.filter((a) => a.tier === 'human-led').length,
  };
}

export interface StatSegment {
  text: string;
  /** Bold run — the numerals and their noun, per §2.6.2's "**18 of 23 jobs**". */
  strong: boolean;
}

/**
 * The stat line as typed segments, so the component renders emphasis without owning
 * arithmetic and the test can assert the sentence without a DOM.
 *
 * Clauses that would be untrue are dropped rather than zero-filled: no assisted jobs
 * means no "0 assisted" clause, and no human-led jobs means nothing "stays human".
 */
export function statLineSegments(stats: ChartStats): StatSegment[] {
  const noun = stats.total === 1 ? 'job' : 'jobs';
  const verb = stats.autonomous === 1 ? 'runs' : 'run';
  const segments: StatSegment[] = [
    { text: `${stats.autonomous} of ${stats.total} ${noun}`, strong: true },
    { text: ` ${verb} autonomously`, strong: false },
  ];
  if (stats.assisted > 0) {
    segments.push({ text: ' · ', strong: false }, { text: `${stats.assisted} assisted`, strong: true });
  }
  if (stats.humanLed > 0) {
    segments.push({ text: ' · the rest stay human', strong: false });
  }
  return segments;
}

/** Flat text — the accessible name of the stat line and what the tests read. */
export const statLineText = (stats: ChartStats): string =>
  statLineSegments(stats)
    .map((s) => s.text)
    .join('');
