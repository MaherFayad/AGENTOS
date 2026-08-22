/**
 * Unit tests for `check-page-errors.mjs`'s two pure functions.
 *
 * The gate itself needs Chrome and a dev server; these do not. What they cover is the part
 * most likely to rot silently: the event shapes Chrome sends, and the **fatal / not-fatal
 * split**, which is the one seam where this gate could start reporting green while blind.
 *
 * The gate has a live falsification too (`node scripts/check-page-errors.mjs --falsify`
 * plants an uncaught throw and a console.error and asserts both were seen). These tests are
 * the cheap half that runs on every `npm test`.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { describeError, isBackendAbsence, isExpected404 } from '../check-page-errors.mjs';

const BASE = 'http://127.0.0.1:4401';

test('an uncaught exception is reported with its first line', () => {
  const line = describeError('Runtime.exceptionThrown', {
    exceptionDetails: {
      exception: { description: 'TypeError: isProjectSlug is not a function\n    at splitProject' },
      url: 'http://127.0.0.1:4401/_next/static/chunks/main.js',
      lineNumber: 87,
    },
  });
  assert.match(line, /uncaught exception/);
  assert.match(line, /isProjectSlug is not a function/);
  // The stack is dropped: one line per finding keeps a failing gate readable.
  assert.ok(!line.includes('at splitProject'));
  // lineNumber is 0-based over the wire and 1-based to a person.
  assert.match(line, /:88\)/);
});

test('console.error is a finding and console.log is not', () => {
  const err = describeError('Runtime.consoleAPICalled', {
    type: 'error',
    args: [{ value: 'Hydration failed because the server HTML did not match' }],
  });
  assert.match(err, /console\.error/);
  assert.match(err, /Hydration failed/);

  assert.equal(describeError('Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'hi' }] }), null);
  assert.equal(describeError('Runtime.consoleAPICalled', { type: 'warning', args: [{ value: 'hm' }] }), null);
});

test('React’s DevTools suggestion and Fast Refresh notices are ignored', () => {
  // These two are on the IGNORED list, and every entry there is something the gate cannot
  // see. If either stops being emitted verbatim this test is how we find out.
  assert.equal(
    describeError('Runtime.consoleAPICalled', {
      type: 'error',
      args: [{ value: 'Download the React DevTools for a better development experience' }],
    }),
    null,
  );
  assert.equal(
    describeError('Log.entryAdded', { entry: { level: 'error', text: '[Fast Refresh] rebuilding' } }),
    null,
  );
});

test('only error-level browser log entries count', () => {
  assert.equal(
    describeError('Log.entryAdded', { entry: { level: 'warning', source: 'network', text: 'slow' } }),
    null,
  );
  const line = describeError('Log.entryAdded', {
    entry: { level: 'error', source: 'network', text: 'Failed to load resource', url: `${BASE}/api/x` },
  });
  assert.match(line, /browser network error/);
});

test('unrelated CDP methods produce nothing', () => {
  assert.equal(describeError('Page.loadEventFired', {}), null);
  assert.equal(describeError('Network.requestWillBeSent', { request: { url: BASE } }), null);
});

/* ------------------------------------------------------------------ *
 * The fatal / not-fatal split
 * ------------------------------------------------------------------ */

const networkLine = (status, url) =>
  describeError('Log.entryAdded', {
    entry: {
      level: 'error',
      source: 'network',
      text: `Failed to load resource: the server responded with a status of ${status} (Service Unavailable)`,
      url,
    },
  });

test('our own /api/ answering 5xx is a backend absence, not a failure', () => {
  // The real one, verbatim from the first run of this gate: no DATABASE_URL, so the ledger
  // is absent and the metrics route 503s instead of inventing a zero.
  const line = networkLine(503, `${BASE}/api/p/agentos/metrics/runs?agent=sales%2Fx&limit=5`);
  assert.equal(isBackendAbsence(line, BASE), true);
  assert.equal(isBackendAbsence(networkLine(500, `${BASE}/api/status`), BASE), true);
});

test('a 404 stays fatal — that is a wrong URL, not an absent backend', () => {
  assert.equal(isBackendAbsence(networkLine(404, `${BASE}/api/p/agentos/threads`), BASE), false);
  assert.equal(isBackendAbsence(networkLine(403, `${BASE}/api/p/agentos/x`), BASE), false);
});

/* ------------------------------------------------------------------ *
 * isExpected404 — the per-route allowance, and the four ways it must refuse
 *
 * One route in this gate asks for a thread id that is deliberately absent, because the
 * only way to render a not-found state is to not find something. Before the ledger
 * existed that read came back 503 and `isBackendAbsence` excused it, so the route was
 * passing for a reason unrelated to what it tests. The allowance below replaces that
 * accident with a declaration — and the value of a declaration is entirely in what it
 * still refuses.
 * ------------------------------------------------------------------ */

const THREAD = '/api/p/agentos/thread/';

test('a declared 404 on the declared prefix is allowed', () => {
  const line = networkLine(404, `${BASE}${THREAD}3f9a0000-0000-0000-0000-000000000000`);
  assert.equal(isExpected404(line, BASE, THREAD), true);
});

test('a route that declared nothing gets no allowance', () => {
  const line = networkLine(404, `${BASE}${THREAD}3f9a0000`);
  assert.equal(isExpected404(line, BASE, null), false);
  assert.equal(isExpected404(line, BASE, undefined), false);
});

test('the allowance is scoped to its prefix — another 404 on the same page still fails', () => {
  // The failure this prevents: one declared not-found turning the whole page into a
  // 404-free zone, which is how an include-list becomes a blindfold.
  assert.equal(isExpected404(networkLine(404, `${BASE}/api/p/agentos/agents`), BASE, THREAD), false);
  assert.equal(isExpected404(networkLine(404, `${BASE}/_next/static/chunks/main.js`), BASE, THREAD), false);
});

test('the allowance is scoped to 404 — a 5xx cannot wear it', () => {
  assert.equal(isExpected404(networkLine(503, `${BASE}${THREAD}abc`), BASE, THREAD), false);
  assert.equal(isExpected404(networkLine(500, `${BASE}${THREAD}abc`), BASE, THREAD), false);
});

test('the allowance is scoped to our origin — another host cannot borrow the prefix', () => {
  const line = networkLine(404, `https://cdn.example.com${THREAD}abc`);
  assert.equal(isExpected404(line, BASE, THREAD), false);
});

test('a 5xx outside /api/ stays fatal', () => {
  assert.equal(isBackendAbsence(networkLine(503, `${BASE}/_next/static/chunks/main.js`), BASE), false);
  assert.equal(isBackendAbsence(networkLine(503, `${BASE}/p/agentos/map`), BASE), false);
});

test('a 5xx on another origin stays fatal — not ours to excuse', () => {
  assert.equal(isBackendAbsence(networkLine(503, 'https://cdn.example.com/api/thing.js'), BASE), false);
  // The near-miss that a substring check would wave through: someone else's host whose path
  // happens to start the same way.
  assert.equal(isBackendAbsence(networkLine(502, 'http://evil.test/api/status'), BASE), false);
});

test('an uncaught exception is never a backend absence, whatever it mentions', () => {
  // The escape hatch has to be unreachable from the class it exists to protect. A throw that
  // quotes a 503 URL in its message must not launder itself into the tolerated bucket.
  const line = describeError('Runtime.exceptionThrown', {
    exceptionDetails: {
      exception: { description: `Error: fetch ${BASE}/api/status failed with status of 503` },
    },
  });
  assert.equal(isBackendAbsence(line, BASE), false);
});

/* ---- shape 2: the WebSocket to the same absent runner ---- */

const wsLine = (url) =>
  describeError('Log.entryAdded', {
    entry: {
      level: 'error',
      source: 'network',
      text:
        `WebSocket connection to '${url}' failed: Error during WebSocket handshake: ` +
        `net::ERR_INVALID_HTTP_RESPONSE`,
      url: 'webpack-internal:///(app-pages-browser)/./src/map/data/useGraph.ts',
    },
  });

test('the WebSocket to our own /ws/ is the same absent backend as the /api/ 5xx', () => {
  // Verbatim from the run that exposed the inconsistency: the gate excused
  // /api/p/agentos/graph returning 5xx and failed on ws://…/ws/p/agentos/graph, which is the
  // same runner being down, reported twice.
  assert.equal(isBackendAbsence(wsLine(`ws://127.0.0.1:4401/ws/p/agentos/graph`), BASE), true);
  assert.equal(isBackendAbsence(wsLine(`wss://127.0.0.1:4401/ws/p/agentos/graph`), BASE), true);
});

test('a WebSocket to another origin stays fatal', () => {
  assert.equal(isBackendAbsence(wsLine('ws://evil.test/ws/p/agentos/graph'), BASE), false);
  // The near-miss a substring check would wave through: our host appearing inside someone
  // else's URL.
  assert.equal(isBackendAbsence(wsLine('ws://cdn.example.com/proxy/127.0.0.1:4401/ws/x'), BASE), false);
});

test('a WebSocket to a path that is not /ws/ stays fatal', () => {
  // Only the runner bridge is excused. A socket to anything else failing is our defect.
  assert.equal(isBackendAbsence(wsLine('ws://127.0.0.1:4401/live/p/agentos/graph'), BASE), false);
  // The trailing slash is load-bearing and this line is why it is asserted separately: the
  // first falsification of this rule weakened `/ws/` to `/ws` and **every test still passed**,
  // because nothing here distinguished the segment from a path that merely starts with those
  // two letters. A neighbouring route named `/wsocket` or `/wsapi` would have been silently
  // excused. The plant survived, so the gap was in the tests, not the rule.
  assert.equal(isBackendAbsence(wsLine('ws://127.0.0.1:4401/wsocket/p/agentos/graph'), BASE), false);
  assert.equal(isBackendAbsence(wsLine('ws://127.0.0.1:4401/wsapi'), BASE), false);
});

test('console.error is never a backend absence', () => {
  const line = describeError('Runtime.consoleAPICalled', {
    type: 'error',
    args: [{ value: `GET ${BASE}/api/status responded with a status of 503` }],
  });
  assert.equal(isBackendAbsence(line, BASE), false);
});
