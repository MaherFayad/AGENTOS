/* =============================================================================
 * no-plaintext-boundary.test.mjs — THE test for spec §3.1 / ADR-005
 *
 * "The E2E encryption stays intact — decryption is client-side with the user's
 *  key, always."
 *
 * That sentence is only true if it is mechanically true, so this file asserts
 * it at all four places plaintext could escape:
 *
 *   1. relay → client   the proxy rebuilds rows from an allowlist, so a
 *                       plaintext field appearing upstream cannot reach us
 *   2. client → relay   the input body carries a sealed box and has no slot
 *                       for prose
 *   3. server → OS      a push payload carries no content
 *   4. the key itself   non-extractable; `exportKey` rejects, so no code path
 *                       can serialise it into a request or a log
 *
 * Every fixture below is deliberately poisoned with realistic plaintext. If any
 * of it survives a boundary, this test fails and the tab does not ship.
 *
 * Run: node --test apps/web/src/sessions/__tests__/
 * ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeSessionRow,
  sanitizeTranscriptRow,
  sanitizeSessionList,
  inputBody,
  permissionBody,
  logSafe,
  SESSION_ENVELOPE_KEYS,
  TRANSCRIPT_ENVELOPE_KEYS,
} from '../relay/envelope.ts';
import { buildPushPayload } from '../push/payload.ts';
import {
  deriveSessionKey,
  seal,
  open,
  openJson,
  sealJson,
  parseSealed,
  encodeSealed,
  assertNonExtractable,
} from '../../lib/e2e.ts';

/** Strings that must never survive a boundary, in any nesting. */
const POISON = [
  'Refactor the auth middleware',
  '/Users/admin/Documents/GitHub/agnetos',
  'rm -rf /var/lib/postgres',
  'sk-ant-api03-REDACTED-LOOKING-SECRET',
  'The customer list is in company/sources/clients.csv',
];

const containsPoison = (value) => {
  const json = JSON.stringify(value ?? null);
  return POISON.filter((p) => json.includes(p));
};

/* -------------------------------------------------- 1. relay → client */

test('boundary 1: a poisoned upstream session row loses every plaintext field', () => {
  const upstream = {
    id: 'ses_01H',
    seq: 42,
    updatedAt: 1755000000000,
    active: true,
    encryptedMetadata: 'eyJ2IjoxfQ==',
    // Everything below is what a future upstream release might start sending.
    title: POISON[0],
    path: POISON[1],
    lastCommand: POISON[2],
    model: 'claude-opus-4',
    summary: { text: POISON[4] },
  };

  const clean = sanitizeSessionRow(upstream);

  assert.deepEqual(Object.keys(clean).sort(), [...SESSION_ENVELOPE_KEYS].sort());
  assert.deepEqual(containsPoison(clean), [], 'plaintext crossed the server boundary');
  assert.equal(clean.encryptedMetadata, 'eyJ2IjoxfQ==', 'ciphertext must pass through intact');
  assert.equal('model' in clean, false, 'model is encrypted metadata, not an envelope field');
});

test('boundary 1: a poisoned upstream transcript row keeps only its cursor and ciphertext', () => {
  const clean = sanitizeTranscriptRow({
    id: 'msg_9',
    seq: 9,
    at: 1755000000001,
    ciphertext: 'c2VhbGVk',
    role: 'assistant',
    text: POISON[2],
    toolInput: { command: POISON[2] },
  });

  assert.deepEqual(Object.keys(clean).sort(), [...TRANSCRIPT_ENVELOPE_KEYS].sort());
  assert.deepEqual(containsPoison(clean), []);
});

test('boundary 1: the list sanitizer rebuilds every row, not just the first', () => {
  const rows = sanitizeSessionList([
    { id: 'a', seq: 1, updatedAt: 1, active: true, encryptedMetadata: 'x', title: POISON[0] },
    { id: 'b', seq: 2, updatedAt: 2, active: false, encryptedMetadata: 'y', notes: POISON[3] },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(containsPoison(rows), []);
});

test('boundary 1: a row missing its ciphertext is rejected, not silently emptied', () => {
  assert.throws(
    () => sanitizeSessionRow({ id: 'a', seq: 1, updatedAt: 1, active: true }),
    /encryptedMetadata/,
  );
});

/* -------------------------------------------------- 2. client → relay */

test('boundary 2: the input body has no slot for prose', () => {
  const body = inputBody('c2VhbGVkLWlucHV0');
  assert.deepEqual(Object.keys(body), ['ciphertext']);
  assert.deepEqual(containsPoison(body), []);
  // There is no overload that accepts what the user typed, so "just send the
  // text for now" is not something a caller can do by accident.
  assert.throws(() => inputBody(''), /empty input box/);
});

test('boundary 2: the permission body reveals a decision, never its subject', () => {
  const body = permissionBody('req_7', true);
  assert.deepEqual(body, { requestId: 'req_7', allow: true });
  assert.deepEqual(containsPoison(body), []);
});

test('boundary 2: server logs get an id and a byte count, never a payload', () => {
  const line = logSafe({ id: 'ses_1', seq: 4, ciphertext: 'AAAABBBBCCCC' });
  assert.deepEqual(line, { id: 'ses_1', seq: 4, bytes: 12 });
  // Not even the ciphertext: an encrypted transcript in a logfile is a
  // ciphertext the day someone loses a key, and it never helps debug a proxy.
  assert.equal('ciphertext' in line, false);
});

/* -------------------------------------------------- 3. server → OS */

test('boundary 3: a push payload drops everything except kind, id and time', () => {
  const payload = buildPushPayload({
    kind: 'permission',
    id: 'ses_01H',
    at: 1755000000000,
    // A caller — including the runner's approval hook — may pass anything.
    sessionName: POISON[0],
    repo: POISON[1],
    command: POISON[2],
    agent: 'sales/account-enrichment',
  });

  assert.deepEqual(Object.keys(payload).sort(), ['at', 'id', 'k']);
  assert.deepEqual(containsPoison(payload), []);
});

test('boundary 3: an opt-in detail payload carries a sealed box, never plaintext', () => {
  const payload = buildPushPayload({
    kind: 'permission',
    id: 'ses_01H',
    sealed: 'eyJ2IjoxLCJhbGciOiJBRVMtR0NNIn0=',
    summary: POISON[2],
  });
  assert.equal(payload.c, 'eyJ2IjoxLCJhbGciOiJBRVMtR0NNIn0=');
  assert.deepEqual(containsPoison(payload), []);
});

/* -------------------------------------------------- 4. the key itself */

test('boundary 4: the derived key is non-extractable and exportKey rejects', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // Low iteration count here only — the shipped default is PBKDF2_ITERATIONS.
  const key = await deriveSessionKey('correct horse battery staple', salt, 1000);

  assert.equal(key.extractable, false, 'an extractable key can be serialised into a fetch body');
  assert.doesNotThrow(() => assertNonExtractable(key));

  await assert.rejects(
    () => crypto.subtle.exportKey('raw', key),
    'exportKey must reject — this is what makes "the key never leaves the browser" a property, not a promise',
  );
  await assert.rejects(() => crypto.subtle.exportKey('jwk', key));

  // And it cannot be smuggled out through JSON either.
  assert.deepEqual(containsPoison(key), []);
  assert.equal(JSON.stringify(key), '{}');
});

test('boundary 4: assertNonExtractable refuses a key that could be exported', async () => {
  const exportable = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  assert.throws(() => assertNonExtractable(exportable), /refusing an extractable key/);
});

/* ----------------------------------------- the round trip, end to end */

test('seal → wire → open recovers the plaintext, and the wire form reveals nothing', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveSessionKey('a recovery secret', salt, 1000);

  const secret = POISON.join(' · ');
  const encoded = encodeSealed(await seal(key, secret));

  // What the relay stores. This is the string that sits in Postgres.
  assert.deepEqual(containsPoison(encoded), [], 'the sealed wire form leaked plaintext');
  assert.equal(await open(key, parseSealed(encoded)), secret);
});

test('a different key cannot open the box — the relay operator is a different key', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const mine = await deriveSessionKey('mine', salt, 1000);
  const theirs = await deriveSessionKey('theirs', salt, 1000);

  const box = await seal(mine, 'the transcript');
  await assert.rejects(() => open(theirs, box));
});

test('a tampered ciphertext fails to open rather than decoding to garbage', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveSessionKey('mine', salt, 1000);
  const box = await seal(key, 'the transcript');

  const flipped = { ...box, ct: `${box.ct.slice(0, -2)}${box.ct.slice(-2) === 'AA' ? 'BB' : 'AA'}` };
  await assert.rejects(() => open(key, flipped), 'AES-GCM must authenticate, not just decrypt');
});

test('session metadata round-trips as JSON through the same boundary', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveSessionKey('mine', salt, 1000);

  const meta = { name: POISON[0], repo: POISON[1], model: 'claude-opus-4', state: 'working' };
  const encoded = encodeSealed(await sealJson(key, meta));

  assert.deepEqual(containsPoison(encoded), []);
  assert.deepEqual(await openJson(key, parseSealed(encoded)), meta);
});

test('a malformed envelope is rejected before it reaches the cipher', () => {
  assert.throws(() => parseSealed(btoa('{"v":2}')), /malformed sealed envelope/);
});
