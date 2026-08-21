import { describe, expect, it } from 'vitest';
import { parseSkillMarkdown } from './parseSkill';
import { toChartAgent } from './agents';

const SAMPLE = `---
name: Account Enrichment
description: Layer firmographics onto target accounts.
department: product          # branch
icon: building
tier: autonomous
phase: 2-capture
breaks_into: [firmographic-appender, tech-stack-detector]
---

Body is ignored.
`;

describe('parseSkillMarkdown', () => {
  it('projects the chart fields from a SKILL.md and ignores the body', () => {
    const record = parseSkillMarkdown(SAMPLE, 'product/ux-researcher');
    expect(record).not.toBeNull();
    const agent = toChartAgent(record!);
    expect(agent).toMatchObject({
      slug: 'product/ux-researcher',
      name: 'Account Enrichment',
      department: 'product',
      icon: 'building',
      tier: 'autonomous',
      phase: '2-capture',
      skills: ['firmographic-appender', 'tech-stack-detector'],
    });
  });

  it('drops a file whose path department disagrees with the field (invariant 1)', () => {
    expect(parseSkillMarkdown(SAMPLE, 'design/ux-researcher')).toBeNull();
  });

  it('drops a file with a tier or phase outside the frontmatter unions', () => {
    const bad = SAMPLE.replace('tier: autonomous', 'tier: magic');
    expect(parseSkillMarkdown(bad, 'product/ux-researcher')).toBeNull();
  });

  it('returns null when there is no frontmatter block', () => {
    expect(parseSkillMarkdown('# just a readme', 'product/x')).toBeNull();
  });
});
