/**
 * Capability narrows downward — asserted on **the allowlist the session actually received**.
 *
 * ## Why this file exists, and why it is shaped the way it is
 *
 * `commandcenter-orchestrator` made this test a condition of M15's PASS, adopting
 * `agent-library-curator`'s sentence: **"CI is not a boundary."** The reasoning is
 * `agent-cascade.md` §3, and it is worth restating because the shape of this file follows
 * from it exactly:
 *
 *   If a project layer could add to `wired_into`, then a `git push` to a project library
 *   would be a capability grant — on a node that keeps the global agent's name, its icon
 *   and the copper halo the global agent earned. That is BOARD rule 4 defeated with no
 *   code bug at all. The validator catches it in seconds and is the right feedback loop,
 *   but it runs on a *repo*; the thing that runs is a *resolved agent on a host*.
 *
 * So this suite does not ask `assertNarrowsDownward` whether it would refuse. It drives the
 * real dispatch path — `startRun`, the real cascade, the real config — with a session
 * factory that records `options.allowedTools`, and asserts on **what the session was
 * handed**. The distinction is the whole point and it was earned the expensive way: the
 * `workspace` bug was a permission decision that was correct and unwired, and only a test
 * that asserted on the filesystem could tell the difference. This is the same test, one
 * plane up — assert on the artifact the boundary produces, never on the boundary's opinion
 * of itself.
 *
 * ## What it does not prove
 *
 * That the cascade picks the agent a human *meant*. That has no error message and only a
 * real run reveals it (`project-scoping.md` §6, Plan §21.9), and it waits on
 * `RUNNER_ANTHROPIC_API_KEY`. What is proved here is structural: **whatever the cascade
 * picks, its tool list cannot exceed the introducing layer's.**
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { AgentSessionFactory } from '../agentSession.ts';

const SLUG = 'sales/code-reviewer';

function skill(options: { wiredInto: string; approval?: string; marker?: string }): string {
  return `---
name: Code Reviewer
description: A fixture for the cascade ceiling.
department: sales
cluster: enrichment
icon: building
tier: autonomous
phase: 1-foundation
status: draft
wired_into: ${options.wiredInto}
replaces: "A test."
ladder:
  human-led: "A person does it."
  assisted: "A person checks it."
  autonomous: "It runs."
the_human: "The human reads the output."
approval: ${options.approval ?? 'none'}
---

${options.marker ?? 'Body.'}
`;
}

interface Fixture {
  repoRoot: string;
  globalRoot: string;
  cleanup: () => Promise<void>;
}

/**
 * A repo with a project library, plus a *separate* directory standing in for the global
 * library. Separate on purpose: L0 is a different git repo on a real host, and a fixture
 * that nested it inside the project would quietly test a case that cannot occur.
 */
async function fixture(layers: {
  global?: string;
  project?: string;
  override?: string;
}): Promise<Fixture> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'agnetos-cascade-'));
  const globalRoot = await mkdtemp(join(tmpdir(), 'agnetos-global-'));

  await mkdir(join(repoRoot, 'company', 'sources'), { recursive: true });
  await mkdir(join(repoRoot, 'panels'), { recursive: true });
  await writeFile(join(repoRoot, 'company', 'COMPANY.md'), '## Identity\n\nA real sentence.\n', 'utf8');

  const write = async (root: string, prefix: string[], body: string): Promise<void> => {
    const dir = join(root, 'agents', ...prefix, ...SLUG.split('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), body, 'utf8');
  };

  if (layers.global) await write(globalRoot, [], layers.global);
  if (layers.project) await write(repoRoot, [], layers.project);
  else await mkdir(join(repoRoot, 'agents'), { recursive: true });
  if (layers.override) await write(repoRoot, ['_overrides'], layers.override);

  return {
    repoRoot,
    globalRoot,
    cleanup: async () => {
      await rm(repoRoot, { recursive: true, force: true });
      await rm(globalRoot, { recursive: true, force: true });
    },
  };
}

interface DispatchResult {
  /** Exactly what the session was constructed with. `null` ⇒ no session was ever created. */
  allowedTools: string[] | null;
  systemPrompt: string | null;
  /** The `start` frame's `sourceRef` — which file the runner says it ran. */
  sourceRef: string | null;
  /** True when the run paused at an approval gate — i.e. `approval: required` was honoured. */
  gated: boolean;
  error: { code?: string; message?: string; hint?: string } | null;
}

/**
 * Run the real pipeline against a fixture and report what the session received.
 *
 * `withGlobal: false` is its own case, not an omission: no global library configured is
 * the state this repo ships in today (BOARD, M15 scope — the cascade has two real levels
 * until a global library repo exists) and it must **not** be an error.
 */
async function dispatch(fx: Fixture, options: { withGlobal: boolean }): Promise<DispatchResult> {
  const saved = {
    root: process.env.AGNETOS_REPO_ROOT,
    global: process.env.AGNETOS_GLOBAL_LIBRARY,
    scratch: process.env.RUNNER_SCRATCH_ROOT,
    key: process.env.ANTHROPIC_API_KEY,
  };
  process.env.AGNETOS_REPO_ROOT = fx.repoRoot;
  process.env.RUNNER_SCRATCH_ROOT = join(fx.repoRoot, '.runner', 'scratch');
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';
  if (options.withGlobal) process.env.AGNETOS_GLOBAL_LIBRARY = fx.globalRoot;
  else delete process.env.AGNETOS_GLOBAL_LIBRARY;

  const result: DispatchResult = {
    allowedTools: null,
    systemPrompt: null,
    sourceRef: null,
    gated: false,
    error: null,
  };

  try {
    const session: AgentSessionFactory = async function* (sessionOptions) {
      // The single most important line in this file: what the session was *handed*.
      result.allowedTools = [...sessionOptions.allowedTools];
      result.systemPrompt = sessionOptions.systemPrompt;
      yield { type: 'result' as const, costUsd: 0 };
    };

    const services = createRunnerServices(loadConfig(), {
      info: () => {},
      warn: () => {},
      error: () => {},
    });
    services.session = session;

    try {
      const state = await startRun(services, mountedProject(services.config), {
        agent: SLUG,
        inputs: {},
      });

      // A run with `approval: required` parks at its gate and waits for a human, which in a
      // test is a hang. Answering it is not a workaround: a tightened approval that did NOT
      // pause would be the failure this case is looking for, so the gate opening is
      // recorded as an observation and then denied so the run can finish cleanly.
      const gateWatch = setInterval(() => {
        if (state.gate && !state.gate.decided) {
          result.gated = true;
          services.store.decide(state.runId, 'deny', 'test harness — the gate is the assertion');
        }
      }, 5);

      try {
        await new Promise<void>((resolve) => state.stream.whenEnded(resolve));
      } finally {
        clearInterval(gateWatch);
      }
      result.sourceRef = state.sourceRef;
    } catch (err) {
      result.error = err as DispatchResult['error'];
    }

    return result;
  } finally {
    const restore = (name: string, value: string | undefined): void => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('AGNETOS_REPO_ROOT', saved.root);
    restore('AGNETOS_GLOBAL_LIBRARY', saved.global);
    restore('RUNNER_SCRATCH_ROOT', saved.scratch);
    restore('ANTHROPIC_API_KEY', saved.key);
  }
}

/**
 * THE TEST THE MILESTONE TURNS ON.
 *
 * `agent-library-curator` specified it exactly: *"a fixture project whose project-layer
 * file declares `[shell]` over a global ceiling of `[workspace]`, dispatched for real,
 * asserting that the session never receives `Bash`."*
 */
test('a project layer cannot add a connector the global layer did not grant', async () => {
  const fx = await fixture({
    global: skill({ wiredInto: '[workspace]' }),
    project: skill({ wiredInto: '[workspace, shell]' }),
  });
  try {
    const run = await dispatch(fx, { withGlobal: true });

    assert.equal(run.error?.code, 'capability_widened', 'the run is refused, not silently narrowed');
    assert.equal(
      run.allowedTools,
      null,
      'NO session was ever constructed — the assertion is on what was handed over, not on a decision',
    );

    // Refused, and refused in a way a human on a phone can act on: what was added, what
    // set the ceiling, and the one legal way to get the tool.
    assert.match(run.error?.message ?? '', /shell/);
    assert.match(run.error?.hint ?? '', /new slug/i, 'the hint names the escape hatch: fork under a new slug');
    assert.match(run.error?.hint ?? '', /Nothing was run/);
  } finally {
    await fx.cleanup();
  }
});

/**
 * The other half, and the one that would go unnoticed if it broke: narrowing **works**,
 * and the narrowed list is what the session gets.
 *
 * A refusal-only test would pass just as happily against an implementation that refused
 * everything. This is the case that proves the ceiling is a ceiling and not a wall.
 */
test('a project layer may subtract, and the session receives exactly the narrowed list', async () => {
  const fx = await fixture({
    global: skill({ wiredInto: '[workspace, shell]' }),
    project: skill({ wiredInto: '[workspace]', marker: 'The project copy.' }),
  });
  try {
    const run = await dispatch(fx, { withGlobal: true });

    assert.equal(run.error, null, 'narrowing is legal');
    assert.notEqual(run.allowedTools, null, 'a session was constructed');
    assert.deepEqual(
      run.allowedTools,
      ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
      'exactly `workspace`, resolved — never a superset (BOARD rule 4)',
    );
    assert.equal(
      run.allowedTools?.includes('Bash'),
      false,
      'the global layer granted shell; the project layer took it away; the session never saw Bash',
    );

    // The file that won is the project copy, and the runner says so on the record rather
    // than leaving "which code-reviewer did I run?" to be reconstructed later.
    assert.match(run.systemPrompt ?? '', /The project copy\./);
    assert.match(run.sourceRef ?? '', /^project:/);
    assert.match(run.sourceRef ?? '', /@sha256:[0-9a-f]{64}$/);
  } finally {
    await fx.cleanup();
  }
});

test('approval may be tightened downward and never loosened', async () => {
  const tighten = await fixture({
    global: skill({ wiredInto: '[workspace]', approval: 'none' }),
    project: skill({ wiredInto: '[workspace]', approval: 'required' }),
  });
  try {
    const run = await dispatch(tighten, { withGlobal: true });
    assert.equal(run.error, null, 'none → required is a narrowing, so the run is legal');
    assert.equal(run.gated, true, 'and it is honoured — the run paused for a human');
    assert.equal(
      run.allowedTools,
      null,
      'nothing was spawned while a human had not answered; a gate that let the session start would be decorative',
    );
  } finally {
    await tighten.cleanup();
  }

  const loosen = await fixture({
    global: skill({ wiredInto: '[workspace]', approval: 'required' }),
    project: skill({ wiredInto: '[workspace]', approval: 'none' }),
  });
  try {
    const run = await dispatch(loosen, { withGlobal: true });
    assert.equal(run.error?.code, 'capability_widened');
    assert.equal(run.allowedTools, null, 'nothing was spawned');
    assert.match(run.error?.message ?? '', /approval/);
  } finally {
    await loosen.cleanup();
  }
});

/**
 * Fail closed when the ceiling cannot be derived.
 *
 * The failure mode this prevents is subtle and would never look like a security bug: if an
 * unreadable global layer were treated as "the global library does not define this agent",
 * the *project* file would silently become the introducing layer and would hand itself its
 * own ceiling. Every widening would then pass, on a machine whose global mount happened to
 * be down.
 *
 * A directory where a file is expected reproduces that as EISDIR on every platform, which
 * a `chmod` test could not do on Windows.
 */
test('an unreadable introducing layer refuses the run rather than trusting the copy it can read', async () => {
  const fx = await fixture({
    project: skill({ wiredInto: '[workspace, shell]' }),
  });
  try {
    // A SKILL.md that is a directory: it exists, so this is not ENOENT, and it cannot be
    // read, so the ceiling is unknown.
    await mkdir(join(fx.globalRoot, 'agents', ...SLUG.split('/'), 'SKILL.md'), { recursive: true });

    const run = await dispatch(fx, { withGlobal: true });

    assert.equal(run.error?.code, 'cascade_unresolved');
    assert.equal(run.allowedTools, null, 'nothing was spawned on an unknown ceiling');
    assert.match(run.error?.hint ?? '', /Nothing was run/);
    assert.match(run.error?.hint ?? '', /narrow/i);
  } finally {
    await fx.cleanup();
  }
});

/**
 * …and the case that must NOT be an error, because it is the state this repo ships in.
 *
 * No global library configured is a *configuration*, not a fault. Conflating it with the
 * previous test would break every dev machine; conflating it the other way would silently
 * trust a local file's tool list. Same disease as `unknown` vs `zero`, one plane up.
 */
test('no global library configured is not an error — the project layer is then the ceiling', async () => {
  const fx = await fixture({
    project: skill({ wiredInto: '[workspace, shell]', marker: 'Two-level cascade.' }),
  });
  try {
    const run = await dispatch(fx, { withGlobal: false });

    assert.equal(run.error, null, 'an unconfigured global library is a configuration, not a fault');
    assert.deepEqual(
      run.allowedTools,
      ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      'the project file introduces the agent, so its own list is the ceiling',
    );
    assert.match(run.sourceRef ?? '', /^project:/);
  } finally {
    await fx.cleanup();
  }
});

/**
 * The most-specific layer wins, whole-file (ADR-014 §1.1), and the override is bound by the
 * layer that introduced the agent — not by the layer directly above it.
 */
test('an override wins the cascade and is still held to the introducing layer’s ceiling', async () => {
  const narrowing = await fixture({
    global: skill({ wiredInto: '[workspace, shell]' }),
    project: skill({ wiredInto: '[workspace, shell]' }),
    override: skill({ wiredInto: '[workspace]', marker: 'The override.' }),
  });
  try {
    const run = await dispatch(narrowing, { withGlobal: true });
    assert.equal(run.error, null);
    assert.match(run.systemPrompt ?? '', /The override\./, 'the most-specific file is what runs');
    assert.match(run.sourceRef ?? '', /^override:/);
    assert.equal(run.allowedTools?.includes('Bash'), false);
  } finally {
    await narrowing.cleanup();
  }

  const widening = await fixture({
    global: skill({ wiredInto: '[workspace]' }),
    project: skill({ wiredInto: '[workspace]' }),
    override: skill({ wiredInto: '[workspace, shell]' }),
  });
  try {
    const run = await dispatch(widening, { withGlobal: true });
    assert.equal(run.error?.code, 'capability_widened');
    assert.equal(run.allowedTools, null);
    // The ceiling cited is L0's file, not L1's — the *introducing* layer, which is the
    // part of ADR-014 §3 an implementation is most likely to get subtly wrong by
    // comparing against whichever layer happens to be one step up.
    assert.match(run.error?.hint ?? '', /agents[\\/]sales[\\/]code-reviewer[\\/]SKILL\.md/);
  } finally {
    await widening.cleanup();
  }
});
