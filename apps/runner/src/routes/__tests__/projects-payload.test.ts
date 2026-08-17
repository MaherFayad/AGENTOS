/**
 * **`GET /api/projects` returns one row per client, and none of them may carry a commercial
 * figure.**
 *
 * ## Why a clean route has a test
 *
 * This route is clean today and was left alone in the `/api/all/approvals` sweep, with the
 * reason written next to the fields: `toProjectSummary` hardcodes `budgetMonthlyUsd`,
 * `defaultAccountId`, `hostAffinity` and `libraryRemote` to their empty values, and nothing
 * in the web app reads them. `fidelity-qa-reviewer`'s acceptance note is the sharper framing
 * and the reason this file exists: **it is clean for a reason that expires.** ADR-015 Q6 is
 * one answer away from making `budgetMonthlyUsd` real, and on the day it does, a
 * coordinator-scoped route hands every client's monthly budget to any caller — the same
 * defect `/api/all/approvals` had, arriving through a field that already exists rather than
 * a route someone adds.
 *
 * "Recorded beside the field" was the fix last night. A comment asking the next author to
 * remember is the weakest instrument in this repo, so it is now two mechanisms:
 *
 *   1. **The type.** `ProjectSummary` declares those fields as `null`, `readonly []` and
 *      `false` — the only values they may hold on this route. Returning a real budget stops
 *      compiling *on the line that leaks*.
 *   2. **This file.** A type is not enough on its own: `as never`, `JSON.parse`, and a
 *      widened type in a future diff all get past a compiler and none of them get past an
 *      assertion on the body. And the key-set assertion catches the *other* shape of the
 *      same mistake — a new client-shaped field added to the coordinator row.
 *
 * Deleting either is then a reviewable act, which is the whole difference between a decision
 * and a drift.
 */
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNNER_ROUTES } from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { buildRunner } from '../../server.ts';

async function runner() {
  const repo = await mkdtemp(join(tmpdir(), 'agnetos-projects-'));
  await mkdir(join(repo, 'agents'), { recursive: true });
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = repo;
  const built = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  return {
    built,
    close: async () => {
      await built.close();
      if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
      else process.env.AGNETOS_REPO_ROOT = previous;
    },
  };
}

test('the coordinator project row carries no budget, no account and no remote', async () => {
  const { built, close } = await runner();
  try {
    const res = await built.app.inject({ method: 'GET', url: RUNNER_ROUTES.projects.path });
    assert.equal(res.statusCode, 200);

    const [row, ...rest] = res.json().projects as Record<string, unknown>[];
    assert.ok(row, 'one library is mounted, so one row is served');
    assert.equal(rest.length, 0);

    // The exact shape. A field added here is a field every caller gets about every client,
    // so the assertion is the whole key set rather than four absences — the same reasoning
    // as `approvals-payload.test.ts`, where a subtraction could be forgotten.
    assert.deepEqual(
      Object.keys(row).sort(),
      [
        'budgetEnforced', 'budgetMonthlyUsd', 'defaultAccountId', 'hostAffinity',
        'hostAffinityEnforced', 'id', 'libraryPath', 'libraryRemote', 'name', 'slug', 'status',
      ],
      'adding a field to the coordinator row means adding it about every client — say so here first',
    );

    // The four that are one ADR answer away from being real.
    assert.equal(row.budgetMonthlyUsd, null, 'a monthly budget is a commercial fact about one client');
    assert.equal(row.defaultAccountId, null, 'so is which account pays for them');
    assert.deepEqual(row.hostAffinity, []);
    assert.equal(row.libraryRemote, null, 'a git remote is an egress fact (ADR-015 Q5)');

    // …and each one still says, in the payload, that nothing enforces it. A cap rendered
    // next to no enforcement is a UI telling a lie it was handed.
    assert.equal(row.budgetEnforced, false);
    assert.equal(row.hostAffinityEnforced, false);
  } finally {
    await close();
  }
});

/**
 * The honest half of the same route, asserted so the tripwire above cannot be "fixed" by
 * making the route useless. It still says which project this coordinator mounts and whether
 * the database's own isolation is in force — `null` when there is no ledger to ask, because
 * unknown is not `false` (BOARD rule 9, one plane up).
 */
test('it still answers the two questions a switcher actually needs', async () => {
  const { built, close } = await runner();
  try {
    const body = (await built.app.inject({ method: 'GET', url: RUNNER_ROUTES.projects.path })).json();
    assert.equal(typeof body.mounted, 'string');
    assert.equal(body.projects[0].slug, body.mounted, 'the mounted slug is a row that exists');
    assert.equal(
      body.scopeEnforced,
      null,
      'no ledger in this fixture — we have not learned that RLS is bypassed, we failed to ask',
    );
  } finally {
    await close();
  }
});
