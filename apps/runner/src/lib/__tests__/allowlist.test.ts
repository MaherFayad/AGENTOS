/**
 * Allowlist enforcement — the security boundary of the whole system (§3.2).
 *
 * A tool absent from `wired_into` is refused even when requested mid-run. There is no
 * base set of "harmless" tools; a base set would be a superset, and a superset would
 * make the drawer's WIRED INTO list a lie.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECTOR_REGISTRY,
  assertToolAllowed,
  isToolAllowed,
  resolveAllowlist,
  unknownConnectorError,
} from '../allowlist.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

test('resolveAllowlist is exactly the union of wired_into connectors, never a superset', () => {
  const resolved = resolveAllowlist(['exa', 'workspace']);
  assert.deepEqual(resolved.unknown, []);
  assert.deepEqual(resolved.connectors, ['exa', 'workspace']);
  assert.ok(resolved.tools.includes('mcp__exa__*'));
  assert.ok(resolved.tools.includes('Read'));
  assert.equal(resolved.tools.includes('Bash'), false, 'shell is not implied by workspace');
  assert.equal(resolved.tools.includes('WebSearch'), false, 'undeclared connectors stay out');
});

test('an empty wired_into grants nothing — deny by default', () => {
  const resolved = resolveAllowlist([]);
  assert.deepEqual(resolved.tools, []);
  assert.equal(isToolAllowed(resolved, 'Read'), false);
  assert.equal(isToolAllowed(resolved, 'Bash'), false);
});

test('a tool requested mid-run that is not in wired_into is refused', () => {
  const resolved = resolveAllowlist(['web-search']);
  assert.equal(isToolAllowed(resolved, 'WebSearch'), true);
  assert.equal(isToolAllowed(resolved, 'Bash'), false);
  assert.throws(
    () => assertToolAllowed(resolved, 'Bash'),
    (err: { code?: string }) => err.code === 'tool_not_allowed',
  );
});

test('mcp prefix patterns match a family and nothing else', () => {
  const resolved = resolveAllowlist(['slack']);
  assert.equal(isToolAllowed(resolved, 'mcp__slack__post_message'), true);
  assert.equal(isToolAllowed(resolved, 'mcp__gmail__send'), false);
});

test('unknown connector names are listed, never silently dropped', () => {
  const resolved = resolveAllowlist(['exa', 'not-a-real-connector']);
  assert.deepEqual(resolved.unknown, ['not-a-real-connector']);
  assert.ok(resolved.tools.includes('mcp__exa__*'));
  const err = unknownConnectorError(resolved.unknown);
  assert.equal(err.code, 'unknown_connector');
  assert.equal(err.status, 422);
});

test('CONNECTOR_REGISTRY keys match agents/_registry/connectors.json', async () => {
  const raw = JSON.parse(await readFile(join(ROOT, 'agents', '_registry', 'connectors.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const fileKeys = Object.keys(raw).filter((key) => key !== '$comment').sort();
  const codeKeys = Object.keys(CONNECTOR_REGISTRY).sort();
  assert.deepEqual(codeKeys, fileKeys, 'the data half and the code half of the registry must not drift');
});
