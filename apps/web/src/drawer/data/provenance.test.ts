/**
 * REQ-DRW-PROV — the drawer header answers "whose agent is this?" from the cascade's own
 * `source_ref`, or admits it does not know. `Plan §23.6`, ADR-014 §2.
 *
 * The property under test is not "the badge renders". It is that **there is no third
 * outcome**: every input either produces a state derived from a layer the cascade named, or
 * produces `unknown`. Nothing in between, and nothing defaulted — a provenance badge that
 * guesses is worse than no badge, because a reader who sees `global` on a project fork does
 * not lose information, they acquire a false belief (tokens contract §10.6).
 *
 * Owner: drawer-engineer
 */

import { describe, expect, it } from 'vitest';
import { sourceRef } from '@agnetos/contracts';
import {
  PROVENANCE_UNKNOWN,
  parseSourceRef,
  provenanceOfAgent,
  provenanceOfSourceRef,
} from './provenance';

const DIGEST = 'a'.repeat(64);
/** Built with the contract's own function, so a grammar change breaks this file first. */
const REF = {
  global: sourceRef('global', 'agents/sales/database-mining/SKILL.md', DIGEST),
  project: sourceRef('project', 'agents/sales/database-mining/SKILL.md', DIGEST),
  override: sourceRef('override', 'agents/_overrides/sales/database-mining/SKILL.md', DIGEST),
};

describe('parsing the cascade’s source_ref', () => {
  it('reads the three parts of {layer}:{path}@{digest}', () => {
    const parsed = parseSourceRef(REF.override);
    expect(parsed).toEqual({
      layer: 'override',
      path: 'agents/_overrides/sales/database-mining/SKILL.md',
      digest: `sha256:${DIGEST}`,
    });
  });

  it('does not let a path containing : or @ eat the layer or the digest', () => {
    // `cascade.ts` falls back to the ABSOLUTE path when it cannot shorten one against the
    // repo root, which on this platform means `C:/…`. A greedy split on either character is
    // how a Windows drive letter silently becomes the layer name.
    const windows = sourceRef('project', 'C:/repos/AgnetOS/agents/sales/x/SKILL.md', DIGEST);
    expect(parseSourceRef(windows)).toEqual({
      layer: 'project',
      path: 'C:/repos/AgnetOS/agents/sales/x/SKILL.md',
      digest: `sha256:${DIGEST}`,
    });

    const scoped = sourceRef('global', 'vendor/@acme/agents/sales/x/SKILL.md', DIGEST);
    expect(parseSourceRef(scoped)?.path).toBe('vendor/@acme/agents/sales/x/SKILL.md');
  });

  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['no layer', ':agents/x/SKILL.md@sha256:abc'],
    ['a layer nobody defined', `library:agents/x/SKILL.md@sha256:${DIGEST}`],
    ['no digest', 'project:agents/x/SKILL.md'],
    ['no path', `project:@sha256:${DIGEST}`],
    ['an algorithm we do not read', 'project:agents/x/SKILL.md@md5:abc'],
    ['a digest that is not hex', 'project:agents/x/SKILL.md@sha256:zzzz'],
  ])('refuses %s rather than half-reading it', (_name, value) => {
    expect(parseSourceRef(value)).toBeNull();
    expect(provenanceOfSourceRef(value)).toEqual(PROVENANCE_UNKNOWN);
  });
});

describe('layer → badge state', () => {
  it('maps global to the global mark', () => {
    expect(provenanceOfSourceRef(REF.global)).toMatchObject({ kind: 'known', state: 'global' });
  });

  it('maps BOTH project layers to `project` — ADR-014 §4.1 calls an override a project badge', () => {
    // L1 (the project library) and L2 (`agents/_overrides/**`) are one answer to the
    // reader's question: this project's own. The badge has no sixth silhouette for the
    // difference, and inventing one would be a distinction nobody can see at 12px.
    expect(provenanceOfSourceRef(REF.project)).toMatchObject({ kind: 'known', state: 'project' });
    expect(provenanceOfSourceRef(REF.override)).toMatchObject({ kind: 'known', state: 'project' });
  });

  it('keeps the path that won, because that is the reason behind the badge', () => {
    const resolved = provenanceOfSourceRef(REF.override);
    expect(resolved.kind === 'known' && resolved.source.path).toContain('_overrides');
  });

  it('never produces a fork state, because nothing can compute one yet', () => {
    // `forked_from` IS in the schema now that ADR-014 is accepted — and it still is not
    // enough. All three fork states are states of a comparison against the parent's current
    // digest (§4.3), and `agent-cascade.md` §11 records that nothing computes one:
    // "ProvenanceBadge exists and the drawer has the header slot; nothing computes a digest
    // comparison — not built." Producing `fork` here would announce "and it still matches
    // its parent" on the strength of a fetch nobody made. When the resolver lands, this
    // assertion is the one that should fail and be rewritten — deliberately.
    for (const ref of Object.values(REF)) {
      const resolved = provenanceOfSourceRef(ref);
      expect(resolved.kind === 'known' && resolved.state).not.toMatch(/fork|drifted|orphaned/);
    }
  });
});

describe('unknown is not global', () => {
  it('opens unknown: the agent detail the drawer reads carries no source_ref', () => {
    // `AgentDetail` is {slug, path, frontmatter, body, runnable}. There is no field to read
    // and none is invented — the same rule as `unpriced` two sections down the drawer,
    // where a missing cost is not $0.00.
    expect(provenanceOfAgent('sales/database-mining', {})).toEqual(PROVENANCE_UNKNOWN);
    expect(provenanceOfAgent(null, {})).toEqual(PROVENANCE_UNKNOWN);
  });

  it('refuses to attribute one agent’s run to another agent’s header', () => {
    // The failure this guard exists for: one `useRunStream` serves the drawer for its whole
    // life and a finished run outlives the drawer that started it, so closing
    // `database-mining` and opening `account-enrichment` would otherwise show
    // database-mining's layer under account-enrichment's title — confidently, and wrongly.
    const finished = { agent: 'sales/database-mining', sourceRef: REF.override };
    expect(provenanceOfAgent('sales/database-mining', finished)).toMatchObject({ state: 'project' });
    expect(provenanceOfAgent('sales/account-enrichment', finished)).toEqual(PROVENANCE_UNKNOWN);
  });

  it('stays unknown when a run started but the runner sent no source_ref', () => {
    // An older runner than the contract. Silence is not a layer.
    expect(provenanceOfAgent('sales/x', { agent: 'sales/x' })).toEqual(PROVENANCE_UNKNOWN);
  });
});
