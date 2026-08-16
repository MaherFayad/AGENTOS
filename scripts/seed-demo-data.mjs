#!/usr/bin/env node
/**
 * seed-demo-data.mjs — FAKE run history, for looking at the UI with data in it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  READ THIS FIRST
 *
 *  CLAUDE.md rule 9: "Numbers must be real. `status: live` and the LIVE counter
 *  come from actual runs — an honest empty state beats a plausible fake one."
 *
 *  This script breaks that rule ON PURPOSE, because a human asked to see the
 *  dashboards populated before wiring a real API key. Everything it writes is
 *  therefore built to be *obvious* and *reversible*:
 *
 *   1. Every run_id starts with `demo_`. Nothing else in the system produces
 *      that prefix, so `WHERE run_id LIKE 'demo_%'` is an exact fence.
 *   2. `--clear` removes every trace of it and re-rolls the daily aggregate.
 *      No leftovers, no "why is yesterday's cost $4.12" a week from now.
 *   3. It refuses to touch a database that already holds real runs, unless you
 *      pass --force. You cannot quietly poison a real ledger with it.
 *
 *  When the runner starts executing for real, run `--clear` and never think
 *  about this file again. It is a lamp, not a fixture.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   node scripts/seed-demo-data.mjs           # seed 14 days of history
 *   node scripts/seed-demo-data.mjs --clear   # remove it all
 *   node scripts/seed-demo-data.mjs --days 30 # a longer window
 *
 * Requires DATABASE_URL, or reads POSTGRES_PASSWORD out of .env like the runner does.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'demo_';

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const CLEAR = argv.includes('--clear');
const FORCE = argv.includes('--force');
const DAYS = Number(argv[argv.indexOf('--days') + 1]) || 14;

// ── deterministic PRNG, so re-seeding gives the same picture ────────────────
// Same reason `scripts/lib/layout.mjs` seeds its solver (ADR-006): a demo that
// reshuffles every run makes "did my change do that?" unanswerable.
let _s = 0x9e3779b9;
const rnd = () => (((_s = (_s * 1664525 + 1013904223) >>> 0) >>> 8) / 0x1000000);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + rnd() * (hi - lo);
const int = (lo, hi) => Math.floor(between(lo, hi + 1));

// ── the cast: real agents only, read from the graph the map already renders ──
// Inventing agent slugs here would put rows in the ledger that no node on the
// MAP can claim, and the drawer's LAST RUNS would silently show nothing.
const AGENTS = [
  { slug: 'sales/account-enrichment',        name: 'Account Enrichment',    dept: 'sales',         weight: 9, errRate: 0.04 },
  { slug: 'sales/database-mining',           name: 'Database Mining',       dept: 'sales',         weight: 6, errRate: 0.05 },
  { slug: 'deals/deal-reactivation',         name: 'Deal Reactivation',     dept: 'deals',         weight: 5, errRate: 0.03 },
  { slug: 'deals/proposal-drafter',          name: 'Proposal Drafter',      dept: 'deals',         weight: 4, errRate: 0.02 },
  { slug: 'marketing/content-repurposer',    name: 'Content Repurposer',    dept: 'marketing',     weight: 8, errRate: 0.06 },
  { slug: 'marketing/brand-voice-guard',     name: 'Brand Voice Guard',     dept: 'marketing',     weight: 7, errRate: 0.01 },
  { slug: 'operations/follow-up-coordinator',name: 'Follow-Up Coordinator', dept: 'operations',    weight: 6, errRate: 0.03 },
  { slug: 'operations/agent-auditor',        name: 'Agent Auditor',         dept: 'operations',    weight: 2, errRate: 0.00 },
  { slug: 'intelligence/company-deep-dive',  name: 'Company Deep-Dive',     dept: 'intelligence',  weight: 4, errRate: 0.08 },
  { slug: 'intelligence/company-interview',  name: 'Company Interview',     dept: 'intelligence',  weight: 1, errRate: 0.00 },
  { slug: 'customer/support-triage',         name: 'Support Triage',        dept: 'customer',      weight: 9, errRate: 0.07 },
  { slug: 'back-office/invoice-chaser',      name: 'Invoice Chaser',        dept: 'back-office',   weight: 5, errRate: 0.02 },
];

const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'];
const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];

/** Activity-feed copy, per §2.5: bold event + agent-role attribution. */
const ACTIVITY = {
  'sales/account-enrichment':        ['Account enriched', '3 firmographic fields appended, tech stack detected'],
  'sales/database-mining':           ['Target list refreshed', '41 accounts scored, 12 promoted to outreach'],
  'deals/deal-reactivation':         ['Stalled deal flagged', 'reactivation draft prepared for review'],
  'deals/proposal-drafter':          ['Proposal drafted', 'scoped from the call transcript, awaiting approval'],
  'marketing/content-repurposer':    ['Long-form post split', '6 short assets generated across 2 channels'],
  'marketing/brand-voice-guard':     ['Voice check passed', '2 phrasings softened to match the register'],
  'operations/follow-up-coordinator':['Meeting transcript processed', '4 action items assigned, recap drafted'],
  'operations/agent-auditor':        ['Repo audited', 'frontmatter gaps and stale agents written to audit/report.md'],
  'intelligence/company-deep-dive':  ['Company researched', 'positioning, funding and hiring signals summarised'],
  'intelligence/company-interview':  ['Brain updated', 'COMPANY.md revised from 6 new answers'],
  'customer/support-triage':         ['Ticket triaged', 'severity set, routed to the owning queue'],
  'back-office/invoice-chaser':      ['Invoice chased', 'reminder sent, payment promise logged'],
};

const ERRORS = [
  'Tool `WebFetch` timed out after 30s',
  'Rate limited by upstream connector (429) — retry budget exhausted',
  'Required input `account_url` was missing from the payload',
  'Model returned malformed JSON for the structured output schema',
];

// ── connection ──────────────────────────────────────────────────────────────
async function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  let env = '';
  try {
    env = await readFile(join(ROOT, '.env'), 'utf8');
  } catch {
    throw new Error('No DATABASE_URL and no .env at the repo root. Start the data plane first.');
  }
  const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
  const pw = get('POSTGRES_PASSWORD');
  if (!pw) throw new Error('.env has no POSTGRES_PASSWORD.');
  const user = get('POSTGRES_USER') || 'agnetos';
  const db = get('APP_DB') || 'agnetos';
  const port = get('POSTGRES_HOST_PORT') || '5433';
  return `postgresql://${user}:${pw}@127.0.0.1:${port}/${db}`;
}

// ── weighted pick, so the "runs by department" bar list isn't flat ──────────
const TOTAL_WEIGHT = AGENTS.reduce((n, a) => n + a.weight, 0);
function weightedAgent() {
  let r = rnd() * TOTAL_WEIGHT;
  for (const a of AGENTS) if ((r -= a.weight) <= 0) return a;
  return AGENTS[AGENTS.length - 1];
}

function buildRuns(days) {
  const runs = [];
  const tools = [];
  const now = Date.now();
  let n = 0;

  for (let d = days - 1; d >= 0; d--) {
    // Weekends quieter than weekdays — a flat histogram reads as fake at a glance.
    const dayStart = new Date(now - d * 86_400_000);
    const dow = dayStart.getDay();
    const volume = dow === 5 || dow === 6 ? int(3, 9) : int(11, 26);

    for (let i = 0; i < volume; i++) {
      const a = weightedAgent();
      const isError = rnd() < a.errRate;
      // Cluster inside the working day so the activity feed reads plausibly.
      const startedAt = new Date(dayStart);
      startedAt.setHours(int(7, 19), int(0, 59), int(0, 59), 0);

      const durationMs = int(4_000, 95_000);
      const endedAt = new Date(startedAt.getTime() + durationMs);
      const model = pick(MODELS);
      const inTok = int(1_800, 42_000);
      const outTok = int(300, 6_500);
      const cacheRead = int(0, 30_000);
      const cacheWrite = int(0, 4_000);

      // A few runs land unpriced on purpose — the `cost_provenance` constraint
      // requires cost_usd IS NULL exactly then, and the KPI tile has a distinct
      // "unpriced" branch that never gets exercised otherwise.
      const unpriced = rnd() < 0.06;
      const costUsd = unpriced ? null : Number(between(0.004, 0.72).toFixed(6));
      const costSource = unpriced ? 'unpriced' : rnd() < 0.8 ? 'sdk' : 'derived';

      const runId = `${PREFIX}${String(++n).padStart(5, '0')}`;
      const traceId = `${PREFIX}trace_${String(n).padStart(5, '0')}`;
      const toolCount = int(0, 9);
      const [event, detail] = ACTIVITY[a.slug];

      runs.push({
        run_id: runId,
        trace_id: traceId,
        trace_url: `http://127.0.0.1:3001/project/demo/traces/${traceId}`,
        agent: a.slug,
        agent_name: a.name,
        department: a.dept,
        model,
        trigger: rnd() < 0.55 ? 'schedule' : rnd() < 0.85 ? 'manual' : 'api',
        session_id: null,
        dry_run: false,
        status: isError ? 'error' : 'ok',
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_ms: durationMs,
        input_tokens: inTok,
        output_tokens: outTok,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
        cost_usd: costUsd,
        cost_source: costSource,
        tool_call_count: toolCount,
        error_count: isError ? 1 : 0,
        redaction_count: int(0, 3),
        activity_event: event,
        activity_detail: `${detail} — ${a.name}`,
        error: isError ? pick(ERRORS) : null,
      });

      for (let t = 0; t < toolCount; t++) {
        const tStart = new Date(startedAt.getTime() + t * Math.floor(durationMs / (toolCount + 1)));
        const tFailed = isError && t === toolCount - 1;
        tools.push({
          run_id: runId,
          span_id: `${traceId}_span_${t}`,
          seq: t,
          name: pick(TOOLS),
          status: tFailed ? 'error' : 'ok',
          started_at: tStart.toISOString(),
          duration_ms: int(120, 9_000),
          error: tFailed ? 'tool call failed' : null,
        });
      }
    }
  }
  return { runs, tools };
}

// ── main ────────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: await connectionString() });
await client.connect();

try {
  if (CLEAR) {
    const { rowCount } = await client.query(`DELETE FROM ops.agent_runs WHERE run_id LIKE $1`, [`${PREFIX}%`]);
    // agent_run_tools cascades on run_id; the daily rollup is derived, so rebuild it.
    await client.query(`DELETE FROM ops.agent_run_daily`);
    const { rows: days } = await client.query(
      `SELECT DISTINCT started_at::date AS d FROM ops.agent_runs ORDER BY d`,
    );
    for (const { d } of days) await client.query(`SELECT ops.rollup_runs($1::date)`, [d]);
    console.log(`\n  cleared ${rowCount} demo runs. Daily rollup rebuilt from ${days.length} real day(s).\n`);
    process.exit(0);
  }

  // Refuse to contaminate a real ledger.
  const { rows: [{ real }] } = await client.query(
    `SELECT count(*)::int AS real FROM ops.agent_runs WHERE run_id NOT LIKE $1`,
    [`${PREFIX}%`],
  );
  if (real > 0 && !FORCE) {
    console.error(
      `\n  REFUSING: ops.agent_runs already holds ${real} real run(s).\n` +
      `  Seeding fake history next to real history makes every number on the\n` +
      `  dashboards untrustworthy, and there is no way to tell them apart later\n` +
      `  except this prefix. Pass --force if you genuinely want both.\n`,
    );
    process.exit(1);
  }

  await client.query(`DELETE FROM ops.agent_runs WHERE run_id LIKE $1`, [`${PREFIX}%`]);

  const { runs, tools } = buildRuns(DAYS);

  const runCols = Object.keys(runs[0]);
  for (const r of runs) {
    await client.query(
      `INSERT INTO ops.agent_runs (${runCols.join(',')})
       VALUES (${runCols.map((_, i) => `$${i + 1}`).join(',')})`,
      runCols.map((c) => r[c]),
    );
  }

  if (tools.length) {
    const toolCols = Object.keys(tools[0]);
    for (const t of tools) {
      await client.query(
        `INSERT INTO ops.agent_run_tools (${toolCols.join(',')})
         VALUES (${toolCols.map((_, i) => `$${i + 1}`).join(',')})`,
        toolCols.map((c) => t[c]),
      );
    }
  }

  await client.query(`DELETE FROM ops.agent_run_daily`);
  const { rows: days } = await client.query(
    `SELECT DISTINCT started_at::date AS d FROM ops.agent_runs ORDER BY d`,
  );
  for (const { d } of days) await client.query(`SELECT ops.rollup_runs($1::date)`, [d]);

  const { rows: [s] } = await client.query(`
    SELECT count(*)::int AS runs,
           count(*) FILTER (WHERE status='error')::int AS errors,
           count(*) FILTER (WHERE cost_source='unpriced')::int AS unpriced,
           round(sum(cost_usd)::numeric, 2) AS cost
    FROM ops.agent_runs WHERE run_id LIKE $1`, [`${PREFIX}%`]);

  console.log(`
  DEMO DATA seeded — all fake, all prefixed "${PREFIX}"

    runs            ${s.runs}   across ${DAYS} days and ${AGENTS.length} agents
    errors          ${s.errors}
    unpriced        ${s.unpriced}
    total cost      $${s.cost}
    tool spans      ${tools.length}
    daily rollup    ${days.length} days

  Remove it all:  node scripts/seed-demo-data.mjs --clear
`);
} finally {
  await client.end();
}
