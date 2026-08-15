import type { Phase, Tier } from '../../data/contracts';
import type { ChartAgent } from '../../types';

/**
 * Fixtures stand in for parsed frontmatter. They exist ONLY under `__fixtures__/` and are
 * never imported by shipping code — CHART reads the real library at runtime (§2.6 closing
 * line). If you find yourself importing these outside a test, the projection has leaked.
 */

let n = 0;

export function agentFixture(
  name: string,
  tier: Tier,
  phase: Phase,
  extra: Partial<ChartAgent> = {},
): ChartAgent {
  n += 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    slug: `marketing/${slug}`,
    name,
    description: `What ${name} does, in one honest sentence (#${n}).`,
    department: 'marketing' as ChartAgent['department'],
    icon: 'sparkles',
    tier,
    phase,
    skills: [`${slug}-step-one`, `${slug}-step-two`],
    ...extra,
  };
}

/**
 * A marketing department with a deliberately uneven distribution:
 * 7 autonomous · 3 assisted · 2 human-led = 12 jobs, leaving 4 empty tier × phase cells
 * and two cells holding more than one card (so keyboard traversal is exercised).
 */
export const marketingAgents: readonly ChartAgent[] = [
  agentFixture('Company Deep-Dive', 'autonomous', '1-foundation'),
  agentFixture('Content Archive Index', 'autonomous', '1-foundation'),
  agentFixture('Brand Voice Codex', 'human-led', '1-foundation'),

  agentFixture('Lead Intent Scoring', 'autonomous', '2-capture'),
  agentFixture('Creative Fatigue Detector', 'autonomous', '2-capture'),
  agentFixture('Comment Triage', 'assisted', '2-capture'),

  agentFixture('Ad Copy Generator', 'autonomous', '3-generate'),
  agentFixture('Blog Draft Writer', 'assisted', '3-generate'),
  agentFixture('Newsletter Composer', 'assisted', '3-generate'),
  agentFixture('Campaign Brief', 'human-led', '3-generate'),

  agentFixture('Channel Orchestrator', 'autonomous', '4-orchestrate'),
  agentFixture('Performance Monitor', 'autonomous', '4-orchestrate'),
];

/** The exact shape of §2.6.2's example line: 18 autonomous + 5 assisted = 23 jobs. */
export const specExampleAgents: readonly ChartAgent[] = [
  ...Array.from({ length: 18 }, (_, i) => agentFixture(`Auto ${i + 1}`, 'autonomous', '3-generate')),
  ...Array.from({ length: 5 }, (_, i) => agentFixture(`Assisted ${i + 1}`, 'assisted', '2-capture')),
];

/** A department nobody has staffed yet — the honest empty state, not a fabricated grid. */
export const emptyDepartmentAgents: readonly ChartAgent[] = [];
