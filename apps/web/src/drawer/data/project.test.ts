/**
 * The projection is frontmatter → view model. Nothing here is an agent-specific string.
 */

import { describe, expect, it } from 'vitest';
import { projectAgent } from './project';
import type { AgentDoc } from './types';

function doc(overrides: Partial<AgentDoc['frontmatter']> = {}): AgentDoc {
  return {
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
      breaks_into: ['firmographic-appender', 'tech-stack-detector'],
      builds_on: ['database-mining'],
      ladder: {
        'human-led': 'A glance at the website.',
        assisted: 'Signals appended on demand.',
        autonomous: 'Accounts re-enrich on a schedule.',
      },
      inputs: [{ key: 'account_url', label: 'Account website', type: 'url', required: true }],
      ...overrides,
    },
  };
}

describe('projectAgent', () => {
  it('projects the Account Enrichment frontmatter into the §2.3 anatomy', () => {
    const model = projectAgent(doc());
    expect(model.eyebrow).toBe('FULLY AUTONOMOUS');
    expect(model.clusterEyebrow).toBe('ENRICHMENT');
    expect(model.title).toBe('Account Enrichment');
    expect(model.breadcrumb).toBe('Sales · Enrichment');
    expect(model.wiredInto).toEqual(['Exa', 'Firecrawl']);
    expect(model.breaksInto.map((c) => c.label)).toEqual(['Firmographic Appender', 'Tech Stack Detector']);
    expect(model.buildsOn[0]?.agentSlug).toBe('sales/database-mining');
    expect(model.inputs.fields.map((f) => f.key)).toEqual(['account_url']);
    expect(model.ladder.filter((r) => r.active).map((r) => r.tier)).toEqual(['autonomous']);
  });

  it('collapses optional sections when the frontmatter has nothing to say', () => {
    const model = projectAgent(
      doc({
        description: undefined,
        replaces: undefined,
        the_human: undefined,
        wired_into: [],
        breaks_into: [],
        builds_on: [],
        inputs: [],
        ladder: { 'human-led': '', assisted: '', autonomous: '' },
      }),
    );
    expect(model.description).toBeNull();
    expect(model.replaces).toBeNull();
    expect(model.theHuman).toBeNull();
    expect(model.wiredInto).toEqual([]);
    expect(model.breaksInto).toEqual([]);
    expect(model.buildsOn).toEqual([]);
    expect(model.inputs.fields).toEqual([]);
    expect(model.howToRun).toBeNull();
  });

  it('does not invent missingConnectors when the runner did not send runnable', () => {
    expect(projectAgent(doc()).missingConnectors).toBeUndefined();
    expect(
      projectAgent({
        ...doc(),
        runnable: { tools: ['exa'], missingConnectors: ['firecrawl'], approvalRequired: false, scheduled: false },
      }).missingConnectors,
    ).toEqual(['firecrawl']);
  });
});
