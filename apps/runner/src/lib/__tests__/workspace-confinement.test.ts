/**
 * Is `workspace` actually confined to the per-run scratch directory?
 *
 * `agent-library-curator` widened **twelve of twelve** agents to
 * `wired_into: [workspace]` (ADR-009) on the strength of a sentence in `allowlist.ts`:
 * *"Scoped to the per-run scratch cwd by the session's working directory."* That sentence
 * was a comment, not a mechanism. cwd decides where a **relative** path resolves; the
 * Agent SDK's file tools take absolute paths, and `isToolAllowed` only ever saw the tool's
 * *name*.
 *
 * So this file does not read the code and conclude. It drives the **real** run pipeline
 * (`startRun` → the real `canUseTool` closure the runner hands the session) with a session
 * that attempts a write outside its scratch dir, and checks the filesystem afterwards.
 * A test that asserts on a permission decision could be fooled by a decision that is
 * correct and unwired; a test that asserts on a file cannot.
 *
 * Third time tonight a comment has been mistaken for a guarantee. A boundary that is only
 * a docstring is worse than no boundary at all, because it is quoted in an ADR.
 */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import { isPathInsideScratch, pathArgumentsOf, resolveAllowlist } from '../allowlist.ts';
import type { AgentSessionFactory } from '../agentSession.ts';

const SKILL = `---
name: Workspace Agent
description: A fixture that tries to escape.
department: sales
cluster: enrichment
icon: building
tier: autonomous
phase: 1-foundation
status: draft
wired_into: [workspace]
replaces: "A test."
ladder:
  human-led: "A person does it."
  assisted: "A person checks it."
  autonomous: "It runs."
the_human: "The human reads the output."
approval: none
---

Body.
`;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-escape-'));
  await mkdir(join(root, 'agents', 'sales', 'workspace-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'workspace-agent', 'SKILL.md'), SKILL, 'utf8');
  await writeFile(join(root, 'company', 'COMPANY.md'), '## Identity\n\nA real company sentence.\n', 'utf8');
  // The thing worth stealing. Not a real secret — a stand-in for `.env` at the repo root.
  await writeFile(join(root, '.env'), 'POSTGRES_PASSWORD=hunter2\n', 'utf8');
  return root;
}

/**
 * The end-to-end escape attempt. Returns whether the runner's own gate permitted a write
 * to `target`, and whether the file actually appeared.
 */
async function attemptEscape(target: (root: string) => string): Promise<{
  permitted: boolean;
  written: boolean;
  root: string;
}> {
  const root = await fixtureRepo();
  const previousRoot = process.env.AGNETOS_REPO_ROOT;
  const previousScratch = process.env.RUNNER_SCRATCH_ROOT;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.AGNETOS_REPO_ROOT = root;
  process.env.RUNNER_SCRATCH_ROOT = join(root, '.runner', 'scratch');
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';

  let permitted = false;
  const victim = target(root);

  try {
    // The fake session stands in for the SDK, but it consults the **real** gate the runner
    // passes down — `options.isToolAllowed` — which is the production decision path.
    const session: AgentSessionFactory = async function* (options) {
      const input = { file_path: victim, content: 'owned' };
      permitted = options.isToolAllowed('Write', input);
      if (permitted) {
        // If the gate says yes, actually do it. The filesystem is the assertion.
        await writeFile(victim, 'owned', 'utf8');
        yield { type: 'tool' as const, name: 'Write', input, status: 'ok' as const };
      } else {
        yield {
          type: 'tool' as const,
          name: 'Write',
          input,
          status: 'error' as const,
          error: 'refused',
        };
      }
      // Produce a legitimate artifact so the run finishes normally either way.
      yield { type: 'result' as const, costUsd: 0 };
    };

    const services = createRunnerServices(loadConfig(), {
      info: () => {},
      warn: () => {},
      error: () => {},
    });
    services.session = session;

    const state = await startRun(services, { agent: 'sales/workspace-agent', inputs: {} });
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    let written = false;
    try {
      await stat(victim);
      written = true;
    } catch {
      written = false;
    }
    return { permitted, written, root };
  } finally {
    if (previousRoot === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previousRoot;
    if (previousScratch === undefined) delete process.env.RUNNER_SCRATCH_ROOT;
    else process.env.RUNNER_SCRATCH_ROOT = previousScratch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
}

test('a run cannot write to an ABSOLUTE path outside its scratch dir', async () => {
  const { permitted, written, root } = await attemptEscape((r) => join(r, 'stolen.txt'));
  assert.equal(permitted, false, 'the gate must refuse an absolute path outside the scratch dir');
  assert.equal(written, false, 'and nothing may appear on disk');
  await rm(root, { recursive: true, force: true });
});

test('a run cannot overwrite the repo-root .env', async () => {
  const { permitted, written, root } = await attemptEscape((r) => join(r, '.env'));
  assert.equal(permitted, false);
  // `.env` exists in the fixture, so `written` is true either way — read it instead.
  assert.equal(written, true, 'the fixture file exists');
  assert.equal(
    await readFile(join(root, '.env'), 'utf8'),
    'POSTGRES_PASSWORD=hunter2\n',
    'the file must be untouched — this is the one that matters',
  );
  await rm(root, { recursive: true, force: true });
});

test('a run cannot climb out with ..', async () => {
  const { permitted, root } = await attemptEscape(() => '../../../etc/passwd');
  assert.equal(permitted, false, 'relative traversal fails closed, not normalised into something plausible');
  await rm(root, { recursive: true, force: true });
});

test('a run CAN still write its own artifact — the gate confines, it does not block', async () => {
  const root = await fixtureRepo();
  const previousRoot = process.env.AGNETOS_REPO_ROOT;
  const previousScratch = process.env.RUNNER_SCRATCH_ROOT;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.AGNETOS_REPO_ROOT = root;
  process.env.RUNNER_SCRATCH_ROOT = join(root, '.runner', 'scratch');
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';

  try {
    let relativeOk = false;
    let absoluteInsideOk = false;
    const session: AgentSessionFactory = async function* (options) {
      relativeOk = options.isToolAllowed('Write', { file_path: 'output.md', content: '# hi' });
      absoluteInsideOk = options.isToolAllowed('Write', {
        file_path: join(options.cwd, 'notes', 'draft.md'),
      });
      await writeFile(join(options.cwd, 'output.md'), '# A real deliverable, long enough to keep.\n', 'utf8');
      yield { type: 'result' as const, costUsd: 0 };
    };

    const services = createRunnerServices(loadConfig(), { info: () => {}, warn: () => {}, error: () => {} });
    services.session = session;
    const state = await startRun(services, { agent: 'sales/workspace-agent', inputs: {} });
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    assert.equal(relativeOk, true, 'a relative path is inside the scratch dir');
    assert.equal(absoluteInsideOk, true, 'an absolute path inside the scratch dir is fine');
    assert.equal(state.status, 'ok');
    assert.ok(state.artifact, 'the artifact still reaches disk — otherwise the fix broke every agent');
  } finally {
    if (previousRoot === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previousRoot;
    if (previousScratch === undefined) delete process.env.RUNNER_SCRATCH_ROOT;
    else process.env.RUNNER_SCRATCH_ROOT = previousScratch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

// --- the pure gate, for the shapes the pipeline test cannot enumerate --------

test('path arguments are found wherever the SDK puts them', () => {
  assert.deepEqual(pathArgumentsOf({ file_path: '/a' }), ['/a']);
  assert.deepEqual(pathArgumentsOf({ path: '/b' }), ['/b']);
  assert.deepEqual(pathArgumentsOf({ notebook_path: '/c' }), ['/c']);
  assert.deepEqual(pathArgumentsOf({ pattern: '*.md' }), [], 'a glob pattern is not a path');
  assert.deepEqual(pathArgumentsOf(null), []);
});

test('a tool call with no path argument is not a filesystem access and passes through', () => {
  // MCP calls, WebSearch, and anything else that never touches the disk. Confining a
  // search string would be theatre; this gate exists to confine paths.
  assert.equal(isPathInsideScratch('/scratch/run-1', { query: 'acme' }), true);
  assert.equal(isPathInsideScratch('/scratch/run-1', undefined), true);
});

test('with no scratch dir, any path argument is refused', () => {
  assert.equal(isPathInsideScratch('', { file_path: '/anything' }), false);
});

test('the workspace connector is still exactly five tools — the fix widens nothing', () => {
  assert.deepEqual(resolveAllowlist(['workspace']).tools, ['Read', 'Write', 'Edit', 'Glob', 'Grep']);
});
