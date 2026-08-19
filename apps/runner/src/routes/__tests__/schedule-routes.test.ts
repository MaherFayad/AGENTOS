/**
 * The scheduling routes at the wire — M18 wave 2, `comms/contracts/scheduling.md` §13.
 *
 * ## What this file can prove today, and what it deliberately cannot
 *
 * Every assertion runs with **no Postgres**, which is this repo's actual state: `0011` has never
 * been applied, `DATABASE_URL` is unset on every machine this has ever run on, and no schedule
 * row has ever existed. So five of the six routes can only be proved *mounted and refusing
 * honestly*, and this file says so rather than letting a green number read as a working feature.
 *
 * **One route is different and it is the important one.** `POST …/schedules/preview` needs
 * nothing, and `POST …/schedules` performs its whole refusal ladder before it asks for a
 * database. That is what makes `Plan §14`'s *"never save an unpreviewed cron expression"* a
 * mechanism with a red-and-green test on this stack rather than a sentence in a contract waiting
 * for infrastructure. If that rule could only be exercised through a live Postgres, nobody in
 * this repo would ever have seen it work.
 *
 * ## What this instrument cannot see
 *
 * That a schedule round-trips. That `schedule_fire_idempotent` refuses a second row. That the
 * seventeen mandatory columns are satisfiable by a real INSERT — `writer-schema-agreement.test.ts`
 * answers the text half of that and `sql-executes.test.ts` skips on the rest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  API_ERROR_STATUS,
  PREVIEW_FIRE_TIME_COUNT,
  RUNNER_ROUTES,
  fireTimePreviewToken,
  type ApiErrorBody,
  type FireTimePreview,
} from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { buildRunner } from '../../server.ts';

/* -------------------------------------------------------------------------- *
 * 1. The contract half — assertable with nothing running
 * -------------------------------------------------------------------------- */

const SCHEDULE_ROUTE_KEYS = [
  'schedulePreview',
  'scheduleCreate',
  'schedules',
  'scheduleUpdate',
  'scheduleFires',
  'scheduleFireNow',
] as const;

test('every scheduling route resolves its project from the path before it touches a row', () => {
  for (const key of SCHEDULE_ROUTE_KEYS) {
    const route = RUNNER_ROUTES[key];
    assert.match(
      route.path,
      /^\/api\/p\/:project\//,
      `${key} must carry the project segment (ADR-015 Q1). A schedule id is opaque across ` +
        'projects, so a route that looks one up in order to learn whose it is has let a ' +
        'caller-supplied id choose its own scope.',
    );
    assert.equal(route.scope, 'project');
  }
});

/**
 * The collision §13 did not see, pinned so the correction cannot be quietly undone.
 *
 * §13 spelled the create route `POST /api/p/:project/schedule`, which is a **live route** that
 * writes an agent's frontmatter and commits it. Those are the two authorities of ADR-024's *one
 * table, two authorities*: frontmatter is the `library` side and `ops.schedule` is this one.
 * Serving both from one path would make a request ambiguous about which authority it addresses,
 * which is the ambiguity `source` exists to remove.
 */
test('the frontmatter route and the ops-row route are different paths, on purpose', () => {
  assert.equal(RUNNER_ROUTES.schedule.path, '/api/p/:project/schedule');
  assert.equal(RUNNER_ROUTES.scheduleCreate.path, '/api/p/:project/schedules');
  assert.notEqual(
    RUNNER_ROUTES.schedule.path,
    RUNNER_ROUTES.scheduleCreate.path,
    'one path writing both a frontmatter cron and an ops.schedule row would make `source` ' +
      'undecidable from the request that created it',
  );
});

test('the eight codes contracts/scheduling.md §8 proposed exist, with the statuses it argued', () => {
  // Proposed by `scheduler-engineer` in §8, landed in `packages/contracts/src/api.ts`, which is
  // `runner-engineer`'s file — §11.2 and §11.7 ask them to accept or rename. A rename is a
  // rename: this table is what a rename has to update.
  const proposed: Record<string, number> = {
    schedule_address_not_schedulable: 422,
    schedule_policy_missing: 400,
    schedule_not_found: 404,
    schedule_preview_stale: 409,
    schedule_tz_unknown: 422,
    schedule_zone_unresolved: 422,
    schedule_trigger_not_computable: 422,
    schedule_fire_transition_refused: 409,
  };
  for (const [code, status] of Object.entries(proposed)) {
    assert.equal(
      API_ERROR_STATUS[code as keyof typeof API_ERROR_STATUS],
      status,
      `${code} must be served with a real status — an undeclared code arrives at the client as ` +
        '500 internal, discarding both the code a UI branches on and a sentence written for a ' +
        'human',
    );
  }

  // 422 and not 503, and the difference is the whole argument in §8: `fanout_dispatch_refused`
  // says *you did nothing wrong and it lifts when the cap fires*; this one refuses a **stored**
  // intent that would fail every night with nobody there to read it.
  assert.notEqual(
    API_ERROR_STATUS.schedule_address_not_schedulable,
    API_ERROR_STATUS.fanout_dispatch_refused,
  );
});

/* -------------------------------------------------------------------------- *
 * 2. The wire — a live server with no database, which is this repo's real state
 * -------------------------------------------------------------------------- */

async function library(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-schedules-'));
  const agent = join(root, 'agents', 'sales', 'probe');
  await mkdir(agent, { recursive: true });
  await mkdir(join(root, 'company'), { recursive: true });
  await writeFile(join(root, 'company', 'COMPANY.md'), '# Co\n');
  await writeFile(
    join(agent, 'SKILL.md'),
    ['---', 'name: Probe', 'description: A probe agent.', 'department: sales', 'wired_into: []', 'status: draft', '---', 'Body.', ''].join('\n'),
  );
  return root;
}

async function server() {
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = await library();
  const restore = (): void => {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  };
  try {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    return {
      app: runner.app,
      close: async () => {
        await runner.close();
        restore();
      },
    };
  } catch (err) {
    restore();
    throw err;
  }
}

const bodyOf = (payload: string): ApiErrorBody => JSON.parse(payload) as ApiErrorBody;
const P = '/api/p/agentos/schedules';

/* -------------------------------------------------------------------------- *
 * 3. The preview — the one route that works on this stack
 * -------------------------------------------------------------------------- */

test('the preview returns ten fire times, in the declared zone, with a receipt', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: {
        trigger: { kind: 'cron', spec: { expression: '0 7 * * 1-5' } },
        tz: 'Asia/Riyadh',
        followMe: false,
      },
    });
    assert.equal(res.statusCode, 200, res.payload);
    const preview = JSON.parse(res.payload) as FireTimePreview;

    assert.equal(preview.fireTimes.length, PREVIEW_FIRE_TIME_COUNT);
    assert.equal(preview.tz, 'Asia/Riyadh');

    // Every one of them is 07:00 **local**, which is the whole reason `scheduleClock` exists:
    // `nextRunAt` computes in UTC and would have shown 04:00Z as though it were the answer.
    for (const time of preview.fireTimes) assert.match(time.local, /T07:00$/);
    // …and the UTC instants are three hours earlier, so the two halves are not the same number
    // wearing two labels.
    for (const time of preview.fireTimes) assert.match(time.utc, /T04:00:00\.000Z$/);

    // The receipt is a pure function of what was displayed, so the save route can recompute it.
    assert.equal(
      preview.previewToken,
      fireTimePreviewToken({
        expression: preview.expression,
        tz: preview.tz,
        followMe: preview.followMe,
        fireTimes: preview.fireTimes,
      }),
    );
  } finally {
    await close();
  }
});

test('a preview of a trigger no clock can answer for is refused, not answered with an empty list', async () => {
  const { app, close } = await server();
  try {
    for (const kind of ['event', 'condition', 'chain', 'manual']) {
      const res = await app.inject({
        method: 'POST',
        url: `${P}/preview`,
        payload: { trigger: { kind, spec: { note: 'x' } }, tz: 'UTC', followMe: false },
      });
      assert.equal(res.statusCode, 422, `${kind}: ${res.payload}`);
      assert.equal(bodyOf(res.payload).error.code, 'schedule_trigger_not_computable');
    }
    // An empty `fireTimes` would read as *this schedule fires nothing*; the true statement is
    // *no clock can say when this fires*. Unknown is not zero.
  } finally {
    await close();
  }
});

test('a three-letter timezone is refused rather than silently resolved to a continent', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: { kind: 'cron', spec: { expression: '0 7 * * *' } }, tz: 'AST', followMe: false },
    });
    assert.equal(res.statusCode, 422, res.payload);
    const body = bodyOf(res.payload);
    assert.equal(body.error.code, 'schedule_tz_unknown');
    // §8: the hint must name the AST case, because a person who typed an abbreviation believes
    // it is a timezone. ICU resolves it to America/Anchorage with no error.
    assert.match(body.error.hint ?? '', /AST/);
  } finally {
    await close();
  }
});

test('follow-me is refused rather than quietly falling back to home time', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: { kind: 'cron', spec: { expression: '0 7 * * *' } }, tz: 'Asia/Riyadh', followMe: true },
    });
    assert.equal(res.statusCode, 422, res.payload);
    assert.equal(bodyOf(res.payload).error.code, 'schedule_zone_unresolved');
    // Not 500: the request is well-formed and it is the build that is incomplete. Nothing here
    // reports which zone a person is standing in, and falling back to `tz` is the exact defect
    // detail 6 exists to prevent — a job set to follow you, firing on home time forever.
  } finally {
    await close();
  }
});

/* -------------------------------------------------------------------------- *
 * 4. The rule — nothing is saved on a timer that has not been previewed
 * -------------------------------------------------------------------------- */

const SAVE_BODY = {
  line: '@sales/probe morning brief',
  trigger: { kind: 'cron', spec: { expression: '0 7 * * 1-5' } },
  tz: 'Asia/Riyadh',
  followMe: false,
  jitterSeconds: 30,
  missedRunPolicy: 'catch_up_once',
  overlapPolicy: 'skip',
  enabled: true,
  autoDisableAfter: 3,
  reviewAt: '2026-11-19T00:00:00.000Z',
};

test('a save with no previewToken is refused before anything is written', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({ method: 'POST', url: P, payload: { ...SAVE_BODY, previewToken: null } });
    assert.equal(res.statusCode, 409, res.payload);
    assert.equal(bodyOf(res.payload).error.code, 'schedule_preview_stale');
    // 409 and not 503: the refusal happens before the database is asked for, which is what makes
    // `Plan §14`'s rule provable on a stack that has never had one.
  } finally {
    await close();
  }
});

test('a previewToken from a different expression is refused, which is the bug this exists to catch', async () => {
  const { app, close } = await server();
  try {
    // The dialog previewed Mondays; the field was edited to the 1st of the month before the
    // button. The token still says Mondays.
    const previewed = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: { kind: 'cron', spec: { expression: '0 6 * * 1' } }, tz: 'Asia/Riyadh', followMe: false },
    });
    const stale = (JSON.parse(previewed.payload) as FireTimePreview).previewToken;

    const res = await app.inject({
      method: 'POST',
      url: P,
      payload: {
        ...SAVE_BODY,
        trigger: { kind: 'cron', spec: { expression: '0 6 1 * *' } },
        previewToken: stale,
      },
    });
    assert.equal(res.statusCode, 409, res.payload);
    const body = bodyOf(res.payload);
    assert.equal(body.error.code, 'schedule_preview_stale');
    // The hint shows the times it *would* fire, because "your preview is stale" without the new
    // times sends a person back to a dialog with nothing new to look at.
    assert.match(body.error.hint ?? '', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  } finally {
    await close();
  }
});

test('a save whose token matches gets past the rule and stops at the missing database', async () => {
  const { app, close } = await server();
  try {
    const previewed = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: SAVE_BODY.trigger, tz: SAVE_BODY.tz, followMe: false },
    });
    const token = (JSON.parse(previewed.payload) as FireTimePreview).previewToken;

    const res = await app.inject({ method: 'POST', url: P, payload: { ...SAVE_BODY, previewToken: token } });

    // **503, not 409.** This is the assertion that proves the previous two were not passing for
    // the wrong reason: with a valid receipt the route gets all the way to the store and refuses
    // there. Without it, a route that refused everything would have satisfied both tests above.
    assert.equal(res.statusCode, 503, res.payload);
    assert.equal(bodyOf(res.payload).error.code, 'thread_store_unavailable');
  } finally {
    await close();
  }
});

/* -------------------------------------------------------------------------- *
 * 5. The mandatory policies, refused by name and with no value suggested
 * -------------------------------------------------------------------------- */

test('each policy with no DEFAULT is refused by name, and the hint never suggests a value', async () => {
  const { app, close } = await server();
  try {
    const previewed = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: SAVE_BODY.trigger, tz: SAVE_BODY.tz, followMe: false },
    });
    const previewToken = (JSON.parse(previewed.payload) as FireTimePreview).previewToken;

    for (const field of ['tz', 'followMe', 'jitterSeconds', 'missedRunPolicy', 'overlapPolicy', 'enabled', 'autoDisableAfter', 'reviewAt'] as const) {
      const payload: Record<string, unknown> = { ...SAVE_BODY, previewToken };
      delete payload[field];
      const res = await app.inject({ method: 'POST', url: P, payload });

      // `tz` and `followMe` are read before the preview check because the preview is computed in
      // them, so those two surface as a policy refusal too — which is the right answer either way.
      assert.equal(res.statusCode, 400, `${field}: ${res.payload}`);
      const body = bodyOf(res.payload);
      assert.equal(body.error.code, 'schedule_policy_missing', field);
      assert.match(body.error.message, new RegExp(field), `the refusal must name ${field}`);
    }
  } finally {
    await close();
  }
});

/**
 * The hint may enumerate the vocabulary and must not recommend from it.
 *
 * This is the difference between *here are your four options* and *try `skip`*, and it is the
 * whole reason those columns have no `DEFAULT`: `skip` silently loses a briefing and
 * `catch_up_all` silently spends four figures catching up after a laptop slept a week. A hint
 * that picks is a default wearing a sentence, and it would let a caller who never considered the
 * question look exactly like one who did.
 */
test('the policy hint lists the options and recommends none of them', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({
      method: 'POST',
      url: P,
      payload: { ...SAVE_BODY, missedRunPolicy: 'whatever-is-fine', previewToken: 'pv1_00000000' },
    });
    const hint = bodyOf(res.payload).error.hint ?? '';
    for (const option of ['skip', 'catch_up_once', 'catch_up_all', 'ask']) {
      assert.ok(hint.includes(option), `the hint should name ${option} as available`);
    }
    assert.doesNotMatch(
      hint,
      /\b(recommend|suggest|usually|typically|most people|default is|we use|try )\b/i,
      'a hint that picks one of two policies pointing in opposite directions is a default ' +
        'wearing a sentence',
    );
  } finally {
    await close();
  }
});

/* -------------------------------------------------------------------------- *
 * 6. The other five routes: mounted, and refusing rather than degrading
 * -------------------------------------------------------------------------- */

test('the five routes that need a database refuse honestly instead of inventing one', async () => {
  const { app, close } = await server();
  try {
    const cases = [
      { method: 'GET' as const, url: P, payload: undefined },
      { method: 'PATCH' as const, url: `${P}/s1`, payload: { enabled: false, disabledReason: 'x' } },
      { method: 'GET' as const, url: `${P}/s1/fires`, payload: undefined },
      { method: 'POST' as const, url: `${P}/s1/fire`, payload: {} },
    ];
    for (const { method, url, payload } of cases) {
      const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });
      assert.notEqual(res.statusCode, 404, `${method} ${url} is not mounted at all`);
      assert.equal(res.statusCode, 503, `${method} ${url}: ${res.payload}`);
      assert.equal(bodyOf(res.payload).error.code, 'thread_store_unavailable');
      assert.doesNotMatch(
        res.payload,
        /postgres:\/\/|password|DATABASE_URL=/i,
        'a refusal about a database must not describe the database',
      );
    }
  } finally {
    await close();
  }
});

test('an unknown project is refused before any schedule is looked for', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({ method: 'GET', url: '/api/p/not-a-project/schedules' });
    assert.equal(bodyOf(res.payload).error.code, 'project_not_mounted');
  } finally {
    await close();
  }
});

test('a fan-out schedule is refused with its own code, not with the interactive one', async () => {
  const { app, close } = await server();
  try {
    const previewed = await app.inject({
      method: 'POST',
      url: `${P}/preview`,
      payload: { trigger: SAVE_BODY.trigger, tz: SAVE_BODY.tz, followMe: false },
    });
    const previewToken = (JSON.parse(previewed.payload) as FireTimePreview).previewToken;

    const res = await app.inject({
      method: 'POST',
      url: P,
      payload: { ...SAVE_BODY, line: '@@sales morning brief', previewToken },
    });
    assert.equal(res.statusCode, 422, res.payload);
    const body = bodyOf(res.payload);
    assert.equal(body.error.code, 'schedule_address_not_schedulable');
    // Deliberately not `fanout_dispatch_refused` (503). That one says *you did nothing wrong and
    // it lifts when the cap fires*. This refuses a **stored** intent, because a schedule fires at
    // 03:00 with nobody there to read an interactive refusal — and a schedule that fails every
    // night is the most likely route by which fan-out gets switched back on by accident.
    assert.match(body.error.hint ?? '', /#sales/, 'the hint names the address form that does work');
  } finally {
    await close();
  }
});
