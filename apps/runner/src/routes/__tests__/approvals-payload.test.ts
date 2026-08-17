/**
 * **`GET /api/all/approvals` may span projects. It may not carry payload across them.**
 *
 * ## The finding this file closes
 *
 * `rtl-arabic-pdpl-specialist`'s mandatory cross-project isolation sign-off named it in
 * writing — *"yes, by design — and it carries payload … Recommend it return the label and
 * the count, not the inputs"* — and nothing changed, and it reached neither `BOARD.md` nor
 * the session log. `fidelity-qa-reviewer`'s M15 verdict picked it up as *the one thing the
 * mandatory artifact found that fell out of the record*.
 *
 * The scope is correct and stays: an approvals queue that shows one project's pending
 * approvals is not an approvals queue. What was wrong is that `scope: 'cross-project'` had
 * been argued and the **fields** had not. On a scoped route the scope does the arguing; on
 * this one, PDPL rule 4 — *client data does not cross clients* — has to be argued field by
 * field, and nobody had.
 *
 * ## Why the fix is two fields and not one
 *
 * The recommendation as literally written — drop `inputs`, keep the label — would have
 * changed nothing, and that is worth stating because it is the kind of fix that looks done.
 * `buildPlanSummary` (`lib/prompt.ts:85`) builds the plan summary **out of the inputs**:
 *
 *     lines.push(`Inputs: ${renderInputs(inputs).replace(/\n/g, ' · ')}`);
 *     if (record.deliver.slack) lines.push(`Delivers to Slack ${record.deliver.slack} …`);
 *     if (record.deliver.email) lines.push(`Emails ${record.deliver.email} …`);
 *
 * So `summary` is the same payload flattened into a string, plus the `deliver:` targets —
 * a Slack channel and an email address. Removing `inputs` and keeping `summary` moves the
 * data out of an object and into prose. **The label is `agentName`; `summary` is payload
 * wearing a label's name.**
 *
 * ## Why the assertions are shaped this way
 *
 * `cascade-ceiling.test.ts`'s precedent: assert on the artifact the boundary produces, never
 * on the boundary's opinion of itself. A type cannot do this job — TypeScript is structural,
 * so `PendingApproval[]` is assignable to `PendingApprovalRef[]` and a fat row would type
 * check on the way out. So the primary assertion is on **the raw response body as a string**:
 * a secret planted in the inputs must not appear anywhere in what crosses the wire, whatever
 * field someone later hides it in.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPath, RUNNER_ROUTES } from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { mountedProject } from '../../lib/project.ts';
import { startRun } from '../../lib/runService.ts';
import { buildRunner, type BuiltRunner } from '../../server.ts';

const PROJECT = 'agentos';
const SLUG = 'sales/invoice-chaser';

/**
 * Client data, and the shapes it actually takes in this product: a named human at a named
 * company, and a number that is somebody's commercial position. If either string reaches a
 * cross-project response, rule 4 is broken however tidy the JSON looks.
 */
const CLIENT_NAME = 'Layla Al-Otaibi at Acme Trading Co.';
const CLIENT_AMOUNT = '184500 SAR overdue since March';

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
  - {key: contact, label: "Contact", type: text, required: true}
  - {key: position, label: "Position", type: textarea, required: true}
approval: required
---

Body.
`;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-approvals-'));
  await mkdir(join(root, 'agents', 'sales', 'invoice-chaser'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'invoice-chaser', 'SKILL.md'), SKILL, 'utf8');
  return root;
}

/**
 * A runner with exactly one run parked at an approval gate, started through the real
 * dispatch path. `dryRun` so nothing is spawned and no cap is consulted; the gate opens
 * before the dry-run branch either way, which is the §3.2 order — a plan is shown *before*
 * any tokens are spent.
 */
async function runnerWithPendingApproval(): Promise<{ runner: BuiltRunner; runId: string; close: () => Promise<void> }> {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  const state = await startRun(runner.services, mountedProject(runner.services.config), {
    agent: SLUG,
    inputs: { contact: CLIENT_NAME, position: CLIENT_AMOUNT },
    dryRun: true,
  });
  // Poll for the gate rather than sleeping a number that is long enough on an idle box.
  // Three runners plus a parallel suite is exactly the load under which a fixed 25ms stops
  // being long enough, and a fixture that flakes teaches people to re-run instead of read.
  const deadline = Date.now() + 5_000;
  while (state.status !== 'awaiting-approval') {
    if (Date.now() > deadline) throw new Error(`run stuck at "${state.status}" — it never reached its gate`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  return {
    runner,
    runId: state.runId,
    close: async () => {
      // Release the gate so `execute` finishes rather than leaving a live promise behind.
      try {
        runner.services.store.decide(state.runId, 'deny', 'Fixture teardown.');
        await new Promise<void>((resolve) => state.stream.whenEnded(resolve));
      } catch {
        // Already decided by the test itself.
      }
      await runner.close();
      if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
      else process.env.AGNETOS_REPO_ROOT = previous;
    },
  };
}

test('GET /api/all/approvals carries no run inputs — asserted on what crosses the wire', async () => {
  const { runner, close } = await runnerWithPendingApproval();
  try {
    const res = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.allApprovals.path });
    assert.equal(res.statusCode, 200);

    // 1. The raw body. This is the assertion that survives a future field: it does not care
    //    which key someone hid the value under, only that the value did not leave.
    assert.equal(
      res.payload.includes(CLIENT_NAME),
      false,
      'a name a human typed must not appear in a cross-project response, in any field',
    );
    assert.equal(res.payload.includes(CLIENT_AMOUNT), false, 'nor a figure they typed');
    assert.equal(
      res.payload.includes('acme-trading.example'),
      false,
      'nor the `deliver:` email, which `buildPlanSummary` appends to the summary',
    );
    assert.equal(res.payload.includes('#acme-collections'), false, 'nor the `deliver:` Slack channel');

    // 2. The shape, key by key — so a reviewer can read the boundary rather than infer it
    //    from four absences.
    const [row, ...rest] = res.json().approvals as Record<string, unknown>[];
    assert.equal(rest.length, 0, 'one gate open, one row');
    assert.ok(row, 'the row is served — this is a narrowing, not a refusal');
    assert.deepEqual(
      Object.keys(row).sort(),
      ['agent', 'agentName', 'department', 'inputCount', 'project', 'requestedAt', 'runId'],
      'the cross-project row is exactly PendingApprovalRef: ids, frontmatter, a time, a count',
    );
    assert.equal(Object.hasOwn(row, 'inputs'), false);
    assert.equal(Object.hasOwn(row, 'summary'), false);

    // 3. And it is still a usable queue: whose, what agent, how long, how much was typed.
    assert.equal(row.project, PROJECT, 'a cross-project row always says which client it is');
    assert.equal(row.agent, SLUG);
    assert.equal(row.agentName, 'Invoice Chaser', 'the label is the agent name — library metadata');
    assert.equal(row.inputCount, 2, 'the count is served; the values are not');
    assert.equal(typeof row.requestedAt, 'string');
  } finally {
    await close();
  }
});

/**
 * The other half, and the reason this is a narrowing rather than a deletion: a legitimate
 * consumer that needs to show *what* is being approved fetches it project-scoped, where the
 * data is inside the client boundary that makes it safe to serve.
 *
 * This is not a hop that consumer would otherwise have avoided — deciding is
 * `POST /api/p/:project/approvals/:runId`, so acting on a row already means entering its
 * project. One click is the right price for crossing a client boundary.
 */
test('GET /api/p/:project/approvals still carries the summary and the inputs', async () => {
  const { runner, close } = await runnerWithPendingApproval();
  try {
    const url = projectPath(RUNNER_ROUTES.approvals.path, PROJECT);
    const res = await runner.app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 200);

    const [row] = res.json().approvals as {
      summary: string;
      inputs: Record<string, string>;
      inputCount: number;
    }[];
    assert.ok(row, 'the project-scoped queue has the row');
    assert.equal(row.inputs.contact, CLIENT_NAME, 'inside one project, the human sees what they typed');
    assert.equal(row.inputs.position, CLIENT_AMOUNT);
    assert.equal(row.inputCount, 2, 'the ref fields are present here too — a superset, not a second shape');

    // The evidence for the design decision, asserted rather than asserted-about: `summary`
    // is not a label, it is the inputs and the delivery targets rendered into prose. This is
    // why it is absent from the cross-project row, and this test fails if `buildPlanSummary`
    // ever stops embedding them — at which point the decision is worth revisiting on purpose.
    assert.match(row.summary, /Invoice Chaser/, 'it does begin with the label…');
    assert.ok(row.summary.includes(CLIENT_NAME), '…and then contains the inputs verbatim');
    assert.ok(row.summary.includes(CLIENT_AMOUNT));
    assert.ok(row.summary.includes('finance@acme-trading.example'), 'and the deliver: email');
  } finally {
    await close();
  }
});

/**
 * REQ-RUN-14's route half. `company-interview.test.ts` proves the gate pauses and a denial is
 * recorded, but drives it through `store.decide` — the store, not the wire. Approvals are the
 * one §3.2 surface where a human is the enforcement point, so the route is worth asserting.
 */
test('the pending row is listed and then decided through the project-scoped route', async () => {
  const { runner, runId, close } = await runnerWithPendingApproval();
  try {
    const queue = projectPath(RUNNER_ROUTES.approvals.path, PROJECT);
    const before = await runner.app.inject({ method: 'GET', url: queue });
    assert.equal(before.json().approvals.length, 1);

    const decision = await runner.app.inject({
      method: 'POST',
      url: `${projectPath(RUNNER_ROUTES.approvals.path, PROJECT)}/${runId}`,
      payload: { decision: 'deny', note: 'Not while the amount is disputed.' },
    });
    assert.equal(decision.statusCode, 200);
    assert.equal(decision.json().outcome, 'aborted', 'a denial aborts cleanly (§3.2)');

    const after = await runner.app.inject({ method: 'GET', url: queue });
    assert.deepEqual(after.json().approvals, [], 'a decided gate leaves the queue');

    const all = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.allApprovals.path });
    assert.deepEqual(all.json().approvals, [], 'and leaves the cross-project queue with it');
  } finally {
    await close();
  }
});

/**
 * The structural half. The behavioural tests above see today's fields; this one sees the
 * mechanism that stopped the old ones from leaking.
 *
 * `pendingApprovals(project)` used to take `'*'` for "every project", so one argument decided
 * both *which* rows came back and *whose boundary they crossed* — and the wide read returned
 * the same fat row as the narrow one. The sentinel is gone: `pendingApprovalRefs()` builds a
 * narrow row field by field, so a field added to `RunState` tomorrow cannot arrive on the
 * cross-project route by inheritance. A subtraction can be forgotten; a construction cannot.
 */
test('the cross-project read cannot be expressed as a wide call to the project-scoped one', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  const store = await readFile(join(src, 'lib', 'runStore.ts'), 'utf8');
  assert.equal(
    /pendingApprovals\(\s*['"]\*['"]/.test(store),
    false,
    "the `'*'` sentinel is what made the fat row expressible cross-project",
  );
  assert.match(store, /private \*pendingGates\(/, 'the shared iterator is private — RunState does not leave');

  const api = await readFile(join(src, 'routes', 'api.ts'), 'utf8');
  assert.match(api, /pendingApprovalRefs\(\)/, 'the cross-project route reads the narrow projection');
  assert.equal(
    /allApprovals[\s\S]{0,200}pendingApprovals\(/.test(api),
    false,
    '/api/all/approvals must never reach the project-scoped read',
  );
});
