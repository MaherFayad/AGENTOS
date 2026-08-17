/**
 * The thread routes at the wire (M16, ADR-023, `Plan §12`).
 *
 * ## What this file is for, and the one thing it is not
 *
 * Every assertion below runs **with no Postgres**, which is the state this repo is actually
 * in: `DATABASE_URL` is unset, the three tests that would exercise a real write skip, and
 * `RUNNER_ANTHROPIC_API_KEY` has never been set, so **no thread has ever been created and no
 * message has ever been delivered** (`thread-model.md` §8). So this proves the *route surface*
 * — that the paths exist under a project segment, that a missing store refuses honestly
 * instead of pretending, and that the error contract is complete and reachable. It does not
 * prove a thread round-trips; that needs the human items on BOARD.
 *
 * Recording that distinction here rather than in a handoff is deliberate: the reason M15's
 * `176 / 179` was misleading is that the skipped three were exactly the ones that mattered,
 * and nothing next to the green number said so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  API_ERROR_STATUS,
  LEGACY_UNSCOPED_PATHS,
  RUNNER_ROUTES,
  type ApiErrorBody,
} from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { buildRunner } from '../../server.ts';

/* -------------------------------------------------------------------------- *
 * 1. The contract half — assertable with nothing running at all
 * -------------------------------------------------------------------------- */

test('every thread route carries a project segment, and none of them is the plan spelling', () => {
  for (const key of ['threadCreate', 'thread', 'threadMessage'] as const) {
    const route = RUNNER_ROUTES[key];
    assert.match(
      route.path,
      /^\/api\/p\/:project\//,
      `${key} must resolve its project from the path before it touches a row. A route that ` +
        'looks a thread up in order to learn whose it is has let a caller-supplied id choose ' +
        'its own scope (ADR-015 Q1).',
    );
    assert.equal(route.scope, 'project', `${key} is one project's data, not the coordinator's`);
  }

  assert.equal(
    RUNNER_ROUTES.threadMessage.path,
    '/api/p/:project/thread/:id/message',
    'the final spelling, confirmed by runner-engineer as api-contracts.md\'s owner',
  );

  /**
   * The correction is only meaningful if the plan's spelling is genuinely absent from the
   * mounted set — otherwise both exist and the "cannot be implemented" argument is prose.
   *
   * Widened to `{ path: string }` deliberately: on the literal union `tsc` proves the
   * comparison can never be true and refuses to compile it. That proof is the *stronger*
   * result and it is why this assertion is cheap — but a type-level guarantee disappears
   * from the record the moment `RUNNER_ROUTES` stops being `as const`, so the runtime check
   * stays as the thing a reader can see.
   */
  const mounted: readonly { path: string }[] = Object.values(RUNNER_ROUTES);
  assert.equal(
    mounted.some((r) => r.path === '/api/thread/:id/message'),
    false,
    'Plan §12\'s unscoped spelling must not be mounted alongside the scoped one',
  );
  assert.equal(
    LEGACY_UNSCOPED_PATHS.some((p) => p.path.includes('/thread')),
    false,
    'and it is not a legacy path either: legacy paths exist so a *stale client* gets a named ' +
      'refusal, and no client has ever called a thread route',
  );
});

test('every proposed error code was accepted with a real status, and none collides', () => {
  // `thread-model.md` §11 proposed nine codes and left them to this file's owner to accept or
  // rename. All nine are accepted unrenamed — a code a contract already names is a code its
  // consumers have already read — plus one addition the specifier could not have known about.
  const proposed: Record<string, number> = {
    thread_not_found: 404,
    thread_not_addressable: 409,
    thread_transition_refused: 409,
    address_malformed: 400,
    address_unresolved: 422,
    address_ambiguous: 422,
    interrupt_not_deliverable: 409,
    fanout_dispatch_refused: 503,
    question_unanswered: 409,
  };
  for (const [code, status] of Object.entries(proposed)) {
    assert.equal(
      (API_ERROR_STATUS as Record<string, number>)[code],
      status,
      `${code} must carry the status thread-model.md §11 proposed, or the contract and the ` +
        'code half disagree about what a client sees',
    );
  }
  assert.equal(
    API_ERROR_STATUS.thread_store_unavailable,
    503,
    'the one addition: no Postgres is a temporary, not-your-fault state, so 503 — not 500 ' +
      '(a bug in the runner) and not 404 (a route that was never built)',
  );
});

/* -------------------------------------------------------------------------- *
 * 2. The wire half — a live server with no database, which is this repo's real state
 * -------------------------------------------------------------------------- */

async function library(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-threads-'));
  const agent = join(root, 'agents', 'sales', 'probe');
  await mkdir(agent, { recursive: true });
  await mkdir(join(root, 'company'), { recursive: true });
  await writeFile(join(root, 'company', 'COMPANY.md'), '# Co\n');
  await writeFile(
    join(agent, 'SKILL.md'),
    [
      '---',
      'name: Probe',
      'description: A probe agent.',
      'department: sales',
      'wired_into: []',
      'status: draft',
      '---',
      'Body.',
      '',
    ].join('\n'),
  );
  return root;
}

/**
 * A live runner with **no thread store**, which is this repo's actual configuration:
 * `observe: false` is the `--profile dev` shape, and `DATABASE_URL` is unset on every
 * machine this has ever run on.
 */
async function server() {
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = await library();
  try {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    return {
      app: runner.app,
      close: async () => {
        await runner.close();
        if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
        else process.env.AGNETOS_REPO_ROOT = previous;
      },
    };
  } catch (err) {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
    throw err;
  }
}

const bodyOf = (payload: string): ApiErrorBody => JSON.parse(payload) as ApiErrorBody;

test('all three thread routes are mounted and refuse honestly with no thread store', async () => {
  const { app, close } = await server();
  try {
    const cases = [
      { method: 'POST' as const, url: '/api/p/agentos/thread', payload: { line: '@sales/probe hello' } },
      { method: 'POST' as const, url: '/api/p/agentos/thread/t1/message', payload: { body: 'hi', interrupt: 'note' } },
      { method: 'GET' as const, url: '/api/p/agentos/thread/t1', payload: undefined },
    ];

    for (const { method, url, payload } of cases) {
      const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });
      assert.notEqual(res.statusCode, 404, `${method} ${url} is not mounted at all`);
      assert.equal(
        res.statusCode,
        503,
        `${method} ${url} must refuse rather than degrade. An in-memory thread would be a ` +
          'conversation that vanishes on the next deploy while looking exactly like one that ' +
          'persisted — a broken state wearing the working state\'s clothes.',
      );
      const body = bodyOf(res.payload);
      assert.equal(body.error.code, 'thread_store_unavailable');
      assert.match(
        body.error.hint ?? '',
        /profile/i,
        'the hint is read verbatim by a human on a phone, so it names the thing to change',
      );
      assert.doesNotMatch(
        JSON.stringify(body),
        /postgres:\/\/|password|DATABASE_URL=/i,
        'a refusal about a database must not describe the database',
      );
    }
  } finally {
    await close();
  }
});

test('the pre-project spelling of a thread route is simply not there', async () => {
  const { app, close } = await server();
  try {
    // Not a `project_scope_missing` refusal, because there is no stale client to inform:
    // these routes were born scoped. A 404 here is the honest answer.
    const res = await app.inject({ method: 'POST', url: '/api/thread/t1/message', payload: { body: 'x', interrupt: 'note' } });
    assert.equal(res.statusCode, 404);
  } finally {
    await close();
  }
});

test('a thread route without a project segment cannot be reached by dropping the slug', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({ method: 'GET', url: '/api/p//thread/t1' });
    assert.notEqual(res.statusCode, 200, 'an empty project segment must never resolve to the mounted one');
  } finally {
    await close();
  }
});

test('an unknown project is refused before the thread store is even consulted', async () => {
  const { app, close } = await server();
  try {
    const res = await app.inject({ method: 'GET', url: '/api/p/not-a-project/thread/t1' });
    const body = bodyOf(res.payload);
    assert.equal(
      body.error.code,
      'project_not_mounted',
      'the project is resolved first, from the path. If the store were checked first, the ' +
        'refusal order would depend on this runner\'s configuration rather than on the request.',
    );
    assert.equal(res.statusCode, API_ERROR_STATUS.project_not_mounted);
  } finally {
    await close();
  }
});
