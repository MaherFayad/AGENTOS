/**
 * PWA assets the coverage checker cannot see into — the files exist, parse, and
 * keep the §3.6 rules that live in plain JS (no bundler, no vitest).
 *
 * Run: node --test scripts/__tests__/shell-pwa.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(ROOT, 'apps', 'web', 'public');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

test('manifest is valid JSON with standalone display and a dark theme', async () => {
  const raw = await readFile(join(PUBLIC, 'manifest.webmanifest'), 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, 'Command Center');
  assert.equal(manifest.short_name, 'Command');
  assert.equal(manifest.start_url, '/map');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#111114');
  assert.equal(manifest.background_color, '#111114');
  const sizes = new Set(manifest.icons.map((i) => `${i.sizes}:${i.purpose}`));
  assert.ok(sizes.has('192x192:any'));
  assert.ok(sizes.has('512x512:any'));
  assert.ok(sizes.has('512x512:maskable'));
});

test('placeholder icons and the notification badge exist as non-empty PNGs', async () => {
  for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'badge-72.png']) {
    const path = join(PUBLIC, 'icons', name);
    assert.ok(await exists(path), `${name} is missing`);
    const bytes = await readFile(path);
    assert.ok(bytes.length > 32, `${name} is too small to be a PNG`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok((await stat(path)).size > 0);
  }
});

test('sw.js precaches the shell, never caches /api or /ws, and owns no push handler', async () => {
  const sw = await readFile(join(PUBLIC, 'sw.js'), 'utf8');
  assert.match(sw, /importScripts\('\/sw-push\.js'\)/);
  assert.match(sw, /\/offline/);
  assert.match(sw, /\/manifest\.webmanifest/);
  assert.match(sw, /\/icons\/icon-192\.png/);
  assert.match(sw, /\/icons\/badge-72\.png/);
  assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /pathname\.startsWith\('\/ws\/'\)/);
  assert.match(sw, /keys\.filter\(\(key\) => !key\.startsWith\(VERSION\)\)/);
  assert.doesNotMatch(sw, /addEventListener\(\s*['"]push['"]/);
  assert.doesNotMatch(sw, /addEventListener\(\s*['"]notificationclick['"]/);
});

test('sw-push.js (sessions-owned) still lives at the import path and names the three kinds', async () => {
  const push = await readFile(join(PUBLIC, 'sw-push.js'), 'utf8');
  assert.match(push, /permission/);
  assert.match(push, /run-failed/);
  assert.match(push, /approval/);
  assert.match(push, /addEventListener\(\s*['"]push['"]/);
});
