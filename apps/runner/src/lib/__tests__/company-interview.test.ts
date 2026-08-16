/**
 * Phase 0 step 0.3, walked end to end against the **real** agent file, short of spending
 * a token.
 *
 * `agents/intelligence/company-interview/SKILL.md` is the first agent that will ever run
 * on this system, and it is the one that rewrites the file every other agent obeys. Three
 * things about it are asserted here rather than read:
 *
 *   1. its tool allowlist is **exactly** `wired_into`, which is `[workspace]` — no `Bash`,
 *      no MCP families, no base set (BOARD rule 4 / §3.2);
 *   2. `approval: required` genuinely stops the run at the plan, and a denial ends it as
 *      `denied` with the note, having spawned nothing;
 *   3. `company/COMPANY.md` is injected into the invocation (§3.3), and the `answers`
 *      textarea reaches the prompt — that is the mechanism by which the twenty answers of
 *      step 0.4 will land.
 *
 * Everything here runs with `dryRun: true`, which skips the billing gate and never spawns
 * a session, so it passes with no API key and costs nothing.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { loadAgent } from '../agents.ts';
import { resolveAllowlist } from '../allowlist.ts';
import { buildPrompt } from '../prompt.ts';
import { readCompanyBrain, INTERVIEW_AGENT_SLUG } from '../brain.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { AgentSessionFactory } from '../agentSession.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

function silent() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

async function withRealRepo<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = REPO;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
}

test('company-interview: the resolved allowlist is exactly wired_into, never a superset', async () => {
  await withRealRepo(async () => {
    const record = await loadAgent(loadConfig(), INTERVIEW_AGENT_SLUG);

    // The declaration, read from the file rather than restated here — otherwise the test
    // would only prove that two copies of my assumption agree with each other.
    //
    // AMENDED 2026-08-16 by agent-library-curator, per ADR-009. The declaration was
    // `[company-brain, git]`; both were dropped and `workspace` added. `company-brain` is
    // the connector form of the design ADR-007 rejected (the agent writing `company/`
    // itself) and `git` is the runner's dependency, not the agent's — the runner commits
    // through `commitCompanyFile`, gated on INTERVIEW_AGENT_SLUG, which does not read
    // `wired_into`. Without `workspace` the agent had no tool that could create the
    // `output.md` this file's own prompt demands, so the run reported `ok` and wrote
    // nothing. The test's intent — exactly `wired_into`, never a superset — is unchanged
    // and is now stronger, because the forbidden list below contains the MCP families this
    // agent used to be granted. runner-engineer: keep or revert, it is your file.
    assert.deepEqual(record.data.wired_into, ['workspace']);
    assert.deepEqual(record.allowlist.connectors, ['workspace']);
    assert.deepEqual(record.allowlist.unknown, []);

    // Exactly the union of that connector's tools, and nothing else.
    assert.deepEqual(record.allowlist.tools, ['Read', 'Write', 'Edit', 'Glob', 'Grep']);
    assert.deepEqual(record.allowlist.tools, resolveAllowlist(['workspace']).tools);

    // It can write its artifact (ADR-009 invariant 7) — the whole point of the change.
    assert.ok(record.allowlist.tools.includes('Write'), 'no Write means no output.md means a silent no-op run');

    // The absences are the assertion. A base set of "harmless" tools would make the
    // drawer's WIRED INTO line a lie, which is the failure this rule exists to prevent.
    // `shell` stays deliberately separate from `workspace`, so `Bash` is still absent.
    for (const forbidden of ['Bash', 'WebSearch', 'WebFetch', 'mcp__company__*', 'mcp__git__*']) {
      assert.equal(
        record.allowlist.tools.includes(forbidden),
        false,
        `${forbidden} is not in wired_into and must not be granted`,
      );
    }
  });
});

test('company-interview: COMPANY.md is injected and the answers textarea reaches the prompt', async () => {
  await withRealRepo(async () => {
    const config = loadConfig();
    const record = await loadAgent(config, INTERVIEW_AGENT_SLUG);
    const company = await readCompanyBrain(config);
    assert.ok(company, 'company/COMPANY.md must exist — every invocation injects it (§3.3)');

    const answers = 'Q1: We build and run agent systems for Gulf SMEs.';
    const prompt = buildPrompt(record, { mode: 'first-run', answers }, company);

    assert.equal(prompt.brainInjected, true);
    assert.ok(prompt.system.includes('# COMPANY CONTEXT'));
    assert.ok(
      prompt.system.includes(company.slice(0, 120)),
      'the brain is injected verbatim, not summarised',
    );

    // `answers` is a plain `textarea` input: it is rendered into the user turn by
    // `renderInputs`, not into the system prompt. That is the whole mechanism by which
    // step 0.4's twenty answers arrive — there is no separate upload path.
    assert.ok(prompt.user.includes('- mode: first-run'));
    assert.ok(prompt.user.includes(`- answers: ${answers}`));

    // And the prompt tells the model the truth about its permissions — the same list, so
    // the "write your deliverable to output.md" instruction and the tool list no longer
    // contradict each other (ADR-009).
    assert.ok(prompt.system.includes('Read, Write, Edit, Glob, Grep'));
    assert.ok(prompt.system.includes('output.md'));
    assert.equal(prompt.system.includes('Bash'), false);
  });
});

test('company-interview: approval: required stops the run at the plan and a denial is recorded', async () => {
  await withRealRepo(async () => {
    let sessionCalled = false;
    const session: AgentSessionFactory = async function* () {
      sessionCalled = true;
      yield { type: 'token' as const, text: 'should never run' };
    };

    const services = createRunnerServices(loadConfig(), silent());
    services.session = session;

    let notified: string | null = null;
    services.notifyApproval = (_state, summary) => {
      notified = summary;
    };

    const state = await startRun(services, {
      agent: INTERVIEW_AGENT_SLUG,
      inputs: { mode: 'first-run', answers: 'not yet' },
      dryRun: true,
    });

    // Let the pipeline reach its gate.
    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(state.status, 'awaiting-approval', 'the run parks at the gate, it does not proceed');
    assert.ok(notified, 'a human is told there is something to decide (§3.2 push)');
    assert.equal(services.store.pendingApprovals().length, 1, 'GET /api/approvals has a row');
    assert.equal(sessionCalled, false, 'nothing is spawned before a human answers');

    services.store.decide(state.runId, 'deny', 'Not until the twenty questions are answered.');
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    const chunks: string[] = [];
    state.stream.attach((chunk) => chunks.push(chunk));
    const stream = chunks.join('');

    assert.ok(stream.includes('event: plan'), 'the plan is emitted before the pause');
    assert.ok(stream.includes('"awaitingApproval":true'));
    assert.ok(stream.includes('"tools":["Read","Write","Edit","Glob","Grep"]'), 'start echoes the allowlist');
    assert.equal(state.status, 'denied');
    assert.ok(stream.includes('"status":"denied"'), 'a denied run is data, not a discard');
    assert.ok(stream.includes('Not until the twenty questions are answered.'));
    assert.equal(sessionCalled, false);
    assert.equal(state.costUsd, null, 'a denied run spent nothing');
  });
});

test('company-interview: an approval resumes the run, and the frontmatter on disk is the source of truth', async () => {
  await withRealRepo(async () => {
    const services = createRunnerServices(loadConfig(), silent());
    let sessionCalled = false;
    services.session = async function* () {
      sessionCalled = true;
      yield { type: 'token' as const, text: 'x' };
    };

    const state = await startRun(services, {
      agent: INTERVIEW_AGENT_SLUG,
      inputs: { mode: 'review-gaps' },
      dryRun: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    services.store.decide(state.runId, 'approve');
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    assert.equal(state.status, 'ok');
    assert.equal(sessionCalled, false, 'a dry run still spawns nothing after approval');

    // The gate is a fact in the file, not a runtime setting — assert against the bytes.
    const skill = await readFile(join(REPO, 'agents', 'intelligence', 'company-interview', 'SKILL.md'), 'utf8');
    assert.match(skill, /^approval: required$/m);
    assert.match(skill, /^wired_into: \[workspace\]$/m);
  });
});
