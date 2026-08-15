/* =============================================================================
 * push.test.mjs — notification shape, deep links, and copy drift (spec §3.6)
 *
 * The leak tests for push live in no-plaintext-boundary.test.mjs. This file is
 * about the other half: that a tap lands somewhere useful, and that the copy in
 * the service worker has not drifted from the copy in the app.
 * ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildPushPayload,
  parsePushPayload,
  deepLinkFor,
  notificationOptions,
  NOTIFICATION_COPY,
  PUSH_KINDS,
  DEFAULT_DETAIL,
} from '../push/payload.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

/* -------------------------------------------------------------- the types */

test('§3.6 names exactly three notification types and we ship exactly three', () => {
  assert.deepEqual([...PUSH_KINDS], ['permission', 'run-failed', 'approval']);
  assert.deepEqual(Object.keys(NOTIFICATION_COPY).sort(), [...PUSH_KINDS].sort());
});

test('an unknown kind is refused rather than delivered as a blank notification', () => {
  assert.throws(() => buildPushPayload({ kind: 'marketing', id: 'x' }), /unknown kind/);
});

test('a payload without an id is refused — a tap with nowhere to go is worse than silence', () => {
  assert.throws(() => buildPushPayload({ kind: 'permission', id: '' }), /an id is required/);
});

/* ---------------------------------------------------------------- the copy */

test('the default copy says a decision is waiting, never what it is about', () => {
  for (const kind of PUSH_KINDS) {
    const { title, body } = NOTIFICATION_COPY[kind];
    assert.ok(title.length > 0 && body.length > 0);
    // A lock screen is a public surface. No interpolation slots, no free text.
    assert.equal(/[{$%]/.test(title + body), false, `${kind} copy has a template slot`);
  }
});

test('detailed notifications are opt-in, so the first one is always minimal', () => {
  assert.equal(DEFAULT_DETAIL, 'minimal');
});

/* ---------------------------------------------------------- the deep link */

test('a tap deep-links to the exact session or approval, not to a list', () => {
  assert.equal(deepLinkFor({ k: 'permission', id: 'ses_1', at: 0 }), '/sessions/ses_1');
  assert.equal(deepLinkFor({ k: 'approval', id: 'run_2', at: 0 }), '/approvals/run_2');
  assert.equal(deepLinkFor({ k: 'run-failed', id: 'run_3', at: 0 }), '/runs/run_3');
});

test('ids are encoded, so a hostile id cannot escape the path', () => {
  assert.equal(deepLinkFor({ k: 'permission', id: '../../admin', at: 0 }), '/sessions/..%2F..%2Fadmin');
});

test('a permission notification stays on screen; the informational ones do not', () => {
  const blocking = notificationOptions({ k: 'permission', id: 'ses_1', at: 5 });
  assert.equal(blocking.requireInteraction, true);
  assert.equal(blocking.tag, 'permission:ses_1', 'repeats from one session collapse to one line');
  assert.equal(blocking.renotify, true, 'but the newest one still buzzes');
  assert.equal(notificationOptions({ k: 'approval', id: 'r', at: 5 }).requireInteraction, false);
});

/* --------------------------------------------------------- defensive parse */

test('a malformed push is dropped, not thrown — a throwing SW shows nothing at all', () => {
  assert.equal(parsePushPayload(null), null);
  assert.equal(parsePushPayload('garbage'), null);
  assert.equal(parsePushPayload({ k: 'nope', id: 'x' }), null);
  assert.equal(parsePushPayload({ k: 'permission' }), null);
  assert.deepEqual(parsePushPayload({ k: 'permission', id: 'a', at: 7 }), {
    k: 'permission',
    id: 'a',
    at: 7,
  });
});

/* ------------------------------------------------------------ copy drift */

test('sw-push.js copy has not drifted from push/payload.ts', async () => {
  const sw = await readFile(join(WEB, 'public', 'sw-push.js'), 'utf8');

  for (const kind of PUSH_KINDS) {
    const { title, body } = NOTIFICATION_COPY[kind];
    assert.ok(sw.includes(title), `sw-push.js is missing the "${kind}" title: ${title}`);
    assert.ok(sw.includes(body), `sw-push.js is missing the "${kind}" body: ${body}`);
  }
});

test('sw-push.js deep links agree with deepLinkFor', async () => {
  const sw = await readFile(join(WEB, 'public', 'sw-push.js'), 'utf8');
  assert.ok(sw.includes('/sessions/${safe}'));
  assert.ok(sw.includes('/approvals/${safe}'));
  assert.ok(sw.includes('/runs/${safe}'));
});

test('sw-push.js defaults to minimal — it must not decrypt without an opt-in', async () => {
  const sw = await readFile(join(WEB, 'public', 'sw-push.js'), 'utf8');
  assert.ok(
    sw.includes("detail === 'full'"),
    'the service worker must gate decryption on the explicit opt-in',
  );
});
