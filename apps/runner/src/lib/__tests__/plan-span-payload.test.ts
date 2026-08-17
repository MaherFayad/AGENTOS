/**
 * **The plan span carries input *keys*. The prose stays inside the client boundary.**
 *
 * ## The finding, and why it needed its own test rather than a comment
 *
 * `buildPlanSummary` is `renderInputs(inputs)` newline-joined and then flattened with ` · `,
 * plus the `deliver:` Slack channel and email address. That is the same string that had to
 * leave `GET /api/all/approvals` — *"`summary` is payload wearing a label's name"* — and it
 * was being handed to two trace events.
 *
 * The reason it is worse on this plane, found by `observability-engineer` (2026-08-17) with a
 * worked example: **flattening defeats the redactor's key pass.** `redact` walks object keys,
 * so a denylisted `client_name` loses its whole value whatever it holds. A *string* has no
 * keys, so only the value regexes run — and four of five PII fields survived, everything
 * except an address that happened to look like an email. `.join('\n')` was a way of getting a
 * payload past the redactor.
 *
 * They closed it at their boundary by applying the same key denylist inside strings. That is
 * defence in depth, and defence in depth is not the fix: the span does not need the sentence.
 * It needs the agent, the tools and the input keys — which is also strictly more useful,
 * because a key list is filterable and a paragraph is not.
 *
 * The assertion is therefore on **what the span was handed**, as a serialized string, not on
 * a named field: a redactor being right about delimiters is exactly the thing this stops
 * depending on, so a test that trusted one would be circular.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { Observability } from '../../observability/index.ts';
import type { RunTrace } from '../../observability/types.ts';

/** Client data in the shapes this product actually collects. */
const CLIENT_NAME = 'Fatima Al-Harbi';
const CLIENT_POSITION = '45000 SAR overdue since March';

const SKILL = `---
name: Invoice Chaser
description: A fixture with real-shaped inputs.
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
deliver: {slack: "#acme-collections", email: "finance@acme-trading.example"}
inputs:
  - {key: client_name, label: "Client", type: text, required: true}
  - {key: position, label: "Position", type: textarea, required: true}
approval: none
---

Body.
`;

test('the plan span is handed input keys, never the flattened summary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-plan-span-'));
  await mkdir(join(root, 'agents', 'sales', 'invoice-chaser'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'invoice-chaser', 'SKILL.md'), SKILL, 'utf8');
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;

  const events: Array<{ name: string; detail: unknown }> = [];

  try {
    const services = createRunnerServices(loadConfig(), { info: () => {}, warn: () => {}, error: () => {} });
    const trace: RunTrace = {
      runId: 'run_plan_probe',
      traceId: 'trace_plan_probe',
      traceUrl: null,
      tool: () => ({ ok: () => {}, error: () => {} }) as never,
      usage: () => {},
      event: (name, detail) => events.push({ name, detail }),
      finish: async () => ({}) as never,
    };
    services.obs = { startRun: () => trace } as unknown as Observability;

    const state = await startRun(services, mountedProject(services.config), {
      agent: 'sales/invoice-chaser',
      inputs: { client_name: CLIENT_NAME, position: CLIENT_POSITION },
      // A dry run reaches the plan stage and stops — §3.2's order is that the plan is
      // emitted before anything is spent, which is exactly the event under test.
      dryRun: true,
    });
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    const plan = events.find((e) => e.name === 'plan');
    assert.ok(plan, 'the plan milestone is still traced — this is a narrowing, not a deletion');

    const serialized = JSON.stringify(plan.detail);
    assert.equal(serialized.includes(CLIENT_NAME), false, 'a name a human typed must not reach a span');
    assert.equal(serialized.includes(CLIENT_POSITION), false, 'nor a figure they typed');
    assert.equal(
      serialized.includes('acme-trading.example'),
      false,
      'nor the `deliver:` email, which buildPlanSummary appends to the summary',
    );
    assert.equal(serialized.includes('#acme-collections'), false, 'nor the Slack channel');

    // …and it is still worth having: the keys are there, which is the filterable half.
    assert.deepEqual((plan.detail as { inputKeys: string[] }).inputKeys.sort(), ['client_name', 'position']);
    assert.equal((plan.detail as { agent: string }).agent, 'sales/invoice-chaser');

    // The human-readable summary still exists — it goes to the SSE frame, inside the project.
    // Replayed off the stream's own buffer, which is what a reconnecting drawer would get.
    let replayed = '';
    state.stream.attach((chunk) => {
      replayed += chunk;
    }, 0)();
    assert.ok(
      replayed.includes(CLIENT_NAME),
      'the plan frame the drawer renders keeps the prose: the boundary is the trace, not the human',
    );
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});
