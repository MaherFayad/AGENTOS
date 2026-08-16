/**
 * frontmatter-artifact-capability.test.mjs — ADR-009, invariant 7.
 *
 * The bug this file exists for: `agents/intelligence/company-interview/SKILL.md` declared
 * `wired_into: [company-brain, git]`. The runner's system prompt tells every agent to write
 * its deliverable to `output.md` and `extractArtifact` reads that file back — but neither
 * of those two connectors grants a tool that can write a file. So the first real run of the
 * first agent on this system would have spent money, produced a trace, written nothing, and
 * reported `ok`. `writeBackBrain` requires an `md` artifact, so `company/COMPANY.md` would
 * never have been updated and nothing would have said so.
 *
 * Checking the other eleven found the same shape in all twelve.
 *
 * Two tests, deliberately different in kind:
 *   1. the pure rule, pinned against the exact historical declaration;
 *   2. the whole library, so the next import from gtm-agents/wshobson cannot reintroduce it.
 *
 * Run: node --test scripts/__tests__/*.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter,
  parseConnectorRegistry,
  connectorCanWriteArtifact,
  validateAll,
} from '../validate-frontmatter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AGENTS = join(ROOT, 'agents');

async function loadRegistry() {
  const raw = JSON.parse(await readFile(join(AGENTS, '_registry', 'connectors.json'), 'utf8'));
  const { defs, errors } = parseConnectorRegistry(raw);
  assert.deepEqual(errors, [], 'the connector registry itself must be valid');
  return defs;
}

async function findSkillFiles(dir, depth = 0, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || (depth === 0 && e.name.startsWith('_'))) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await findSkillFiles(full, depth + 1, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

test('the exact declaration that could not write its own artifact is still rejected', async () => {
  const defs = await loadRegistry();

  // The historical bug, pinned by name. Both connectors are real, both are in the
  // registry, both resolve — and neither can create a file.
  const wasDeclared = ['company-brain', 'git'];
  assert.equal(
    wasDeclared.some((c) => connectorCanWriteArtifact(defs.get(c))),
    false,
    'company-brain + git grant only mcp__* families — no run of that agent could produce output.md',
  );

  // The fix, and the only other connector that qualifies.
  assert.equal(connectorCanWriteArtifact(defs.get('workspace')), true);
  assert.equal(connectorCanWriteArtifact(defs.get('shell')), true, 'Bash can write a file too');

  // Not a name list: the rule reads the registry's `tools`, so it stays true when a new
  // connector grants file tools and false when a plausible-sounding one does not.
  for (const nonWriter of ['exa', 'firecrawl', 'slack', 'gmail', 'hubspot', 'postgres', 'langfuse', 'web-search']) {
    assert.equal(connectorCanWriteArtifact(defs.get(nonWriter)), false, `${nonWriter} cannot write output.md`);
  }
  assert.equal(connectorCanWriteArtifact(undefined), false, 'an unwired name grants nothing');
});

test('every agent in the library can produce the deliverable its own body describes', async () => {
  const defs = await loadRegistry();
  const files = await findSkillFiles(AGENTS);
  assert.ok(files.length >= 12, 'the library did not load');

  const cannot = [];
  for (const file of files) {
    const { data } = parseFrontmatter(await readFile(file, 'utf8'));
    // `produces` defaults to `md` — the runner asks for output.md whether or not the file
    // says so, so the default is the honest one.
    if (data.produces === 'none') continue;
    const wired = Array.isArray(data.wired_into) ? data.wired_into : [];
    if (!wired.some((c) => connectorCanWriteArtifact(defs.get(c)))) {
      cannot.push(`${relative(ROOT, file).replace(/\\/g, '/')} — wired_into: [${wired.join(', ') || 'nothing'}]`);
    }
  }

  assert.deepEqual(
    cannot,
    [],
    `these agents would run, cost money and report ok while producing nothing:\n  ${cannot.join('\n  ')}`,
  );
});

test('the validator enforces it — the whole library passes and none is excluded', async () => {
  const report = await validateAll();
  assert.deepEqual(report.excluded, [], 'an excluded agent is not on the map at all');
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
  assert.equal(report.agents.length, report.checked);
});
