/**
 * The bind address — the safe case is the default, and the container still binds wide.
 *
 * Two halves, and the second is the one that makes the first safe to ship: changing a
 * default only helps if the deployment that *needs* the old value states it explicitly.
 * If someone deletes `RUNNER_HOST` from compose or from the Dockerfile, the container
 * silently becomes unreachable from Caddy — a different outage, arrived at from the same
 * edit. So both are asserted here, in the same file as the default they protect.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindHost, DEFAULT_RUNNER_HOST } from '../bind.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

test('an unset, empty or whitespace RUNNER_HOST binds loopback, never every interface', () => {
  assert.equal(DEFAULT_RUNNER_HOST, '127.0.0.1');
  assert.equal(bindHost({}), '127.0.0.1');
  assert.equal(bindHost({ RUNNER_HOST: '' }), '127.0.0.1');
  assert.equal(bindHost({ RUNNER_HOST: '   ' }), '127.0.0.1');
  assert.notEqual(
    bindHost({}),
    '0.0.0.0',
    'a bare `npm start` on the host must not publish an unauthenticated API to the LAN (§3.6)',
  );
});

test('a declared RUNNER_HOST is obeyed, including the wide bind the container needs', () => {
  assert.equal(bindHost({ RUNNER_HOST: '0.0.0.0' }), '0.0.0.0');
  assert.equal(bindHost({ RUNNER_HOST: ' 0.0.0.0 ' }), '0.0.0.0');
  assert.equal(bindHost({ RUNNER_HOST: '100.64.0.7' }), '100.64.0.7');
});

test('the container declares the wide bind itself, so the new default costs Docker nothing', async () => {
  const compose = await readFile(join(REPO, 'infra', 'compose.yaml'), 'utf8');
  assert.match(
    compose,
    /^\s*RUNNER_HOST:\s*0\.0\.0\.0\s*$/m,
    'infra/compose.yaml must keep setting RUNNER_HOST explicitly — the runner no longer guesses it',
  );

  const dockerfile = await readFile(join(REPO, 'infra', 'runner.Dockerfile'), 'utf8');
  assert.match(
    dockerfile,
    /RUNNER_HOST=0\.0\.0\.0/,
    'and the image sets it too, so an image run without compose is still reachable inside its network',
  );
});

/**
 * The published port is the other half of "no public ports", and it is not this file's to
 * fix — it is `infra-compose-engineer`'s. Asserted anyway, because the two decisions are
 * only safe together: a wide container bind is correct *because* the host side is pinned.
 */
test('the published port stays on a bind address, never a bare port mapping', async () => {
  const compose = await readFile(join(REPO, 'infra', 'compose.yaml'), 'utf8');
  assert.match(
    compose,
    /\$\{DEV_BIND_ADDR:-127\.0\.0\.1\}:\$\{RUNNER_PORT:-8787\}:8787/,
    'the host side of the runner port must default to loopback (BOARD constraint 5)',
  );
});
