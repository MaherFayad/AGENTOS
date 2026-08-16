#!/usr/bin/env node
/**
 * stage-0.5.mjs — Phase 0 step 0.5: run each agent in the library once and see which ones
 * actually work.
 *
 * The point of step 0.5 is `status: draft → live`, and that promotion is only worth
 * anything if "it worked" means "it produced its deliverable". Before ADR-009 every one of
 * the twelve agents could finish with `done{status:"ok"}` and no artifact, because none of
 * them declared a connector that could write a file. So this script asserts the artifact,
 * not the status word.
 *
 * Two modes, and the difference between them is the whole safety story:
 *
 *   node scripts/stage-0.5.mjs           dry run. No model call, no cost, no API key
 *                                        needed. Auto-approves the approval-gated agents,
 *                                        which is safe *only* because a dry run spawns no
 *                                        session — nothing can happen for a human to regret.
 *   node scripts/stage-0.5.mjs --live    real runs. Refuses to auto-approve anything and
 *                                        refuses to touch company-interview at all.
 *
 * It never writes `status: live` into a SKILL.md. Invariant 6: `live` comes from
 * observability seeing real runs, and `agent-auditor` (§3.4) is the thing that writes it.
 * This script prints the promote list; it does not forge the evidence for it.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './validate-frontmatter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS = join(ROOT, 'agents');
const BASE = process.env.RUNNER_URL ?? 'http://127.0.0.1:8787';
const LIVE = process.argv.includes('--live');

/** Step 0.4's agent. Its inputs are twenty real answers a human writes, never a placeholder. */
const STEP_04_AGENT = 'intelligence/company-interview';

const TOOLS_THAT_WRITE = ['Write', 'Edit', 'Bash'];

async function findAgents(dir = AGENTS, depth = 0, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || (depth === 0 && e.name.startsWith('_'))) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await findAgents(full, depth + 1, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

/** A value the runner will accept for each declared input, so the probe is about wiring. */
function probeInputs(fields = []) {
  const inputs = {};
  for (const f of fields) {
    if (!f?.required) continue;
    inputs[f.key] =
      f.type === 'select' ? f.options?.[0]
      : f.type === 'url' ? 'https://example.com'
      : f.type === 'number' ? 1
      : f.type === 'date' ? new Date().toISOString().slice(0, 10)
      : 'step 0.5 staging probe';
  }
  return inputs;
}

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

/**
 * Read the SSE stream to `done`/`error`.
 *
 * The run id arrives in the `start` frame — there is no header to read it from — and an
 * `approval: required` agent then parks at `plan` and the stream stays open. So the
 * decision has to be made from inside this loop, not before it: waiting for the stream to
 * end and *then* approving is a deadlock, which is exactly what the first version did.
 */
async function readStream(res, { autoApprove }) {
  const seen = new Set();
  let done = null;
  let error = null;
  let runId = null;
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (!event) continue;
      seen.add(event);
      const payload = data ? JSON.parse(data) : {};
      if (event === 'start') runId = payload.runId ?? null;
      if (event === 'plan' && payload.awaitingApproval && autoApprove && runId) {
        await json(`/api/approvals/${runId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'approve', note: 'step 0.5 dry-run probe — no session is spawned' }),
        });
      }
      if (event === 'done') done = payload;
      if (event === 'error') error = payload;
    }
  }
  return { seen, done, error, runId };
}

async function main() {
  const status = await json('/api/status');
  if (status.status !== 200) {
    console.error(`runner is not answering at ${BASE} — start the stack first (infra/compose.yaml)`);
    process.exit(2);
  }
  const configured = status.body?.runnerConfigured === true;
  console.log(`\nstep 0.5 · ${LIVE ? 'LIVE' : 'dry run'} · runner ${BASE} · key ${configured ? 'present' : 'ABSENT'}`);
  if (LIVE && !configured) {
    console.error('RUNNER_ANTHROPIC_API_KEY is absent or still a placeholder. --live would 503 on every agent.');
    process.exit(2);
  }

  const files = (await findAgents()).sort();
  const rows = [];

  for (const file of files) {
    const { data } = parseFrontmatter(await readFile(file, 'utf8'));
    const slug = file.replace(/\\/g, '/').split('/agents/')[1].replace('/SKILL.md', '');
    const row = { slug, note: '' };
    rows.push(row);

    if (LIVE && slug === STEP_04_AGENT) {
      row.note = 'skipped — this is step 0.4. Run it by hand with the twenty real answers.';
      continue;
    }

    const meta = await json(`/api/agents/${slug}`);
    const tools = meta.body?.runnable?.tools ?? [];
    row.tools = tools.length;
    row.canWrite = tools.some((t) => TOOLS_THAT_WRITE.includes(t));
    if ((meta.body?.runnable?.missingConnectors ?? []).length) {
      row.note = `unknown connector: ${meta.body.runnable.missingConnectors.join(', ')}`;
      continue;
    }
    if (!row.canWrite && data.produces !== 'none') {
      row.note = 'no tool that can write output.md — ADR-009 invariant 7';
      continue;
    }

    const gatedByApproval = meta.body?.runnable?.approvalRequired === true;
    if (gatedByApproval && LIVE) {
      // Not a limitation — a refusal. Auto-approving a real run would make `approval:
      // required` mean "a script said yes", and the gate exists because a human reads the
      // plan. These four get run by hand: POST /api/run, then GET /api/approvals.
      row.note = 'approval gate — run by hand and read the plan; this script will not approve a real run';
      continue;
    }

    const res = await fetch(`${BASE}/api/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: slug, inputs: probeInputs(data.inputs), dryRun: !LIVE }),
    });
    if (!res.ok || !res.body) {
      row.note = `POST /api/run → ${res.status}`;
      continue;
    }

    const { seen, done, error } = await readStream(res, { autoApprove: gatedByApproval });
    row.status = done?.status ?? (error ? 'error' : 'no done event');
    row.artifact = seen.has('artifact');
    row.costUsd = done?.costUsd ?? null;
    if (error) row.note = error.message;
  }

  console.log('');
  for (const r of rows) {
    const mark = r.note ? '!' : r.status === 'ok' && (LIVE ? r.artifact : true) ? '.' : 'x';
    console.log(
      `  ${mark} ${r.slug.padEnd(38)} tools ${String(r.tools ?? '-').padStart(2)}` +
        ` write ${r.canWrite ? 'y' : 'n'} status ${String(r.status ?? '-').padEnd(9)}` +
        ` artifact ${r.artifact === undefined ? '-' : r.artifact ? 'y' : 'n'}` +
        (r.note ? `  ${r.note}` : ''),
    );
  }

  const promote = rows.filter((r) => r.status === 'ok' && r.artifact);
  console.log(
    LIVE
      ? `\n  ${promote.length} of ${rows.length} produced an artifact on a real run.` +
          '\n  Promotion to `status: live` is agent-auditor\'s (§3.4), from the ledger — not this script,' +
          '\n  and not by hand. `ok` with no artifact is a failure however cheerful the event looked.\n'
      : '\n  Dry run proves wiring, the allowlist and the approval gate. It proves nothing about output.' +
          '\n  Re-run with --live once RUNNER_ANTHROPIC_API_KEY is real.\n',
  );
  process.exit(rows.some((r) => r.note && !r.note.startsWith('skipped')) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
