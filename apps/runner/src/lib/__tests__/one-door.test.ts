/**
 * `resolveForDispatch` is the **only** door to a runnable agent — asserted, not remembered.
 *
 * ## Why this file exists
 *
 * ADR-015 decision 5 states the property as three words: *resolution and enforcement are
 * one call.* The reason is in the same paragraph and it is a claim about the future, not
 * about today's code:
 *
 *   > If they were two calls, a future caller could resolve without asserting and get a
 *   > working run — the check would then be something a reviewer has to notice.
 *
 * That failure has already happened once in this repo, in exactly that shape.
 * `assertNarrowsDownward` was written, was correct, was exported — **and had zero callers.**
 * The capability ceiling was computed and never compared to anything. Nothing failed;
 * nothing warned; the enforcement point was simply unreachable, and it took a person
 * reading the file to find out. `cascade-ceiling.test.ts` proves the door is locked. This
 * file proves there is only one door, which is a different claim and needs a different
 * mechanism: a *behavioural* test cannot see a second entrance that nobody has walked
 * through yet.
 *
 * ## What it asserts, and why on the source text
 *
 * Reading source is the right instrument here for the same reason `project-id.test.ts`
 * reads the migration: the property is about **which code exists**, not about what a given
 * call returns. Adding a second producer of an `AgentRecord` on the dispatch path, or a
 * second caller of the session factory, breaks a named assertion in milliseconds — with no
 * database, no API key and no reviewer.
 *
 * The allowlists below are deliberately exhaustive rather than "contains". A test that
 * checked only for the presence of the right caller would pass just as happily the day a
 * second one is added, which is the entire event this file exists to catch.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import { loadAgent } from '../agents.ts';
import { resolveForDispatch } from '../cascade.ts';

/** `apps/runner/src`. */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface SourceFile {
  /** Repo-relative to `apps/runner/src`, forward-slashed, so an assertion reads as a path. */
  id: string;
  text: string;
}

/**
 * Every `.ts` file the runner ships, excluding its own tests.
 *
 * Tests are excluded on purpose: a test *may* call `loadAgent` directly — several do, and
 * that is how the behavioural half at the bottom of this file proves the two doors differ.
 * What must not exist is a second door in the code that runs.
 */
async function shippedSources(dir = SRC): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await shippedSources(full)));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    out.push({
      id: relative(SRC, full).split('\\').join('/'),
      text: await readFile(full, 'utf8'),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"]/g;

/** Which shipped modules import `name` as a named binding. */
function importersOf(files: readonly SourceFile[], name: string): string[] {
  return files
    .filter((file) =>
      [...file.text.matchAll(IMPORT)].some((match) =>
        match[1]!
          .split(',')
          .map((part) => part.replace(/^\s*type\s+/, '').split(/\s+as\s+/)[0]!.trim())
          .includes(name),
      ),
    )
    .map((file) => file.id);
}

/** Which shipped modules contain a call site matching `pattern`. */
function callSitesIn(files: readonly SourceFile[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(file.text)).map((file) => file.id);
}

test('the dispatch path has exactly one producer of a runnable agent', async () => {
  const files = await shippedSources();

  // `recordFromSource` builds an `AgentRecord` from bytes the caller chose. It is the one
  // function that can manufacture a runnable agent without reading the cascade, so its
  // importer list is the tightest statement of the property.
  assert.deepEqual(
    importersOf(files, 'recordFromSource'),
    ['lib/cascade.ts'],
    'only the cascade may build a record from chosen bytes — a second importer is a second door',
  );

  assert.deepEqual(
    importersOf(files, 'resolveForDispatch'),
    ['lib/runService.ts'],
    'and only the run pipeline calls it',
  );

  const runService = files.find((file) => file.id === 'lib/runService.ts');
  assert.ok(runService, 'lib/runService.ts exists');
  assert.equal(
    importersOf([runService], 'loadAgent').length,
    0,
    'the pipeline must not be able to reach the single-layer loader at all (it did, until M15)',
  );
});

/**
 * `loadAgent` still exists and still has callers. That is not a leak, and enumerating them
 * is how it stays not-a-leak: each one is named here with the reason it is not a dispatch.
 */
test('every remaining caller of the single-layer loader is enumerated, and none of them runs anything', async () => {
  const files = await shippedSources();

  assert.deepEqual(
    importersOf(files, 'loadAgent'),
    [
      // Writes `schedule:` into the mounted library's frontmatter and commits it. It needs
      // the project layer's *file path*, not the cascade's winner — and that is a known
      // limitation recorded in the M15 handoff, not an accident: the day an `_overrides/`
      // file wins, this would write the cron into the file that did not run.
      'lib/schedule.ts',
      // `GET /api/agents/:slug` — the drawer's read-only detail view. It renders
      // `wired_into`; it cannot spend anything.
      'routes/api.ts',
    ],
    'a new name in this list is a new place an agent can be loaded outside the cascade',
  );
});

test('the session factory is invoked in exactly one module', async () => {
  const files = await shippedSources();

  assert.deepEqual(
    callSitesIn(files, /\bservices\.session\s*\(/),
    ['lib/runService.ts'],
    'one place constructs a session, so there is one place the allowlist can be assembled',
  );

  // The type is the other half: a module that imports the factory type is a module that is
  // preparing to call one. `agentSession.ts` declares it and is therefore not an importer.
  assert.deepEqual(importersOf(files, 'AgentSessionFactory'), ['lib/runService.ts']);
});

/**
 * The enforcement point must have a caller — the exact regression that shipped once.
 *
 * And it must run *before* the record exists, because an `AgentRecord` that is built first
 * and checked second is an `AgentRecord` a later edit can return early with.
 */
test('assertNarrowsDownward is reachable, and returns before any record is built', async () => {
  const files = await shippedSources();
  const cascade = files.find((file) => file.id === 'lib/cascade.ts');
  assert.ok(cascade, 'lib/cascade.ts exists');

  const declaration = cascade.text.indexOf('export function assertNarrowsDownward');
  assert.notEqual(declaration, -1, 'the enforcement point is still declared here');

  const calls = [...cascade.text.matchAll(/assertNarrowsDownward\s*\(/g)].filter(
    (match) => (match.index ?? 0) !== declaration + 'export function '.length,
  );
  assert.ok(
    calls.length >= 1,
    'the enforcement point has at least one call site — it was exported with zero, and nothing failed',
  );

  const door = cascade.text.indexOf('export async function resolveForDispatch');
  assert.notEqual(door, -1);
  const body = cascade.text.slice(door);
  const asserted = body.indexOf('assertNarrowsDownward(');
  const built = body.indexOf('recordFromSource(');
  assert.notEqual(asserted, -1, 'resolveForDispatch calls the enforcement point');
  assert.notEqual(built, -1, 'and builds the record');
  assert.ok(asserted < built, 'the check returns before the runnable record exists');
});

/**
 * The behavioural half: what a second door would actually buy.
 *
 * The same fixture, through the two loaders. `loadAgent` hands back an agent holding `Bash`
 * that the global layer never granted — which is correct for what it is (a single-layer
 * read of one file, used by a read-only route) and is precisely why it must not be on the
 * dispatch path. The static assertions above are what keep it off.
 */
test('the two loaders genuinely differ — this is what a second door would grant', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'agnetos-one-door-'));
  const globalRoot = await mkdtemp(join(tmpdir(), 'agnetos-one-door-global-'));
  const saved = {
    root: process.env.AGNETOS_REPO_ROOT,
    global: process.env.AGNETOS_GLOBAL_LIBRARY,
    key: process.env.ANTHROPIC_API_KEY,
  };

  const skill = (wiredInto: string): string => `---
name: Code Reviewer
description: A fixture for the one-door test.
department: sales
cluster: enrichment
icon: building
tier: autonomous
phase: 1-foundation
status: draft
wired_into: ${wiredInto}
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

  try {
    for (const [root, wired] of [
      [repoRoot, '[workspace, shell]'],
      [globalRoot, '[workspace]'],
    ] as const) {
      const dir = join(root, 'agents', 'sales', 'code-reviewer');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'SKILL.md'), skill(wired), 'utf8');
    }

    process.env.AGNETOS_REPO_ROOT = repoRoot;
    process.env.AGNETOS_GLOBAL_LIBRARY = globalRoot;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';

    const config = loadConfig();
    const project = mountedProject(config);

    const unchecked = await loadAgent(config, 'sales/code-reviewer');
    assert.equal(
      unchecked.allowlist.tools.includes('Bash'),
      true,
      'the single-layer loader returns the widened list — it has no ceiling to compare against',
    );

    await assert.rejects(
      () => resolveForDispatch(config, project, 'sales/code-reviewer'),
      (err: { code?: string }) => err.code === 'capability_widened',
      'the door refuses the same file',
    );
  } finally {
    const restore = (name: string, value: string | undefined): void => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('AGNETOS_REPO_ROOT', saved.root);
    restore('AGNETOS_GLOBAL_LIBRARY', saved.global);
    restore('ANTHROPIC_API_KEY', saved.key);
    await rm(repoRoot, { recursive: true, force: true });
    await rm(globalRoot, { recursive: true, force: true });
  }
});
