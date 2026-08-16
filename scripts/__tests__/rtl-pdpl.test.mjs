/**
 * Tests for the RTL / Arabic / PDPL slice.
 *
 * Run: node --test scripts/__tests__/*.test.mjs
 * Owner: rtl-arabic-pdpl-specialist
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogueReport, isWideTracking, scanText } from '../check-rtl.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RTL_CSS = join(ROOT, 'apps', 'web', 'src', 'styles', 'rtl.css');
const PROVIDER = join(ROOT, 'apps', 'web', 'src', 'i18n', 'provider.tsx');
const EN = join(ROOT, 'apps', 'web', 'src', 'i18n', 'strings.en.ts');
const AR = join(ROOT, 'apps', 'web', 'src', 'i18n', 'strings.ar.ts');
const COMPANY = join(ROOT, 'company', 'COMPANY.md');

const TYPE_LITERAL = /\b(font-size|letter-spacing)\s*:\s*([^;!]+)/;
const TYPE_OK = /var\(|inherit|normal|unset|initial|revert|currentColor/;

test('rtl.css has no font-size / letter-spacing type literals', async () => {
  const css = await readFile(RTL_CSS, 'utf8');
  const hits = [];
  for (const line of css.split(/\r?\n/)) {
    const stripped = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
    const m = stripped.match(TYPE_LITERAL);
    if (m && !TYPE_OK.test(m[2])) hits.push(`${m[1]}: ${m[2].trim()}`);
  }
  assert.deepEqual(hits, [], `type literals in rtl.css: ${hits.join('; ')}`);
});

test('rtl.css has no hex', async () => {
  const css = await readFile(RTL_CSS, 'utf8');
  const hex = css.match(/(?<![\w&#])#([0-9a-fA-F]{3,8})\b/g) ?? [];
  assert.deepEqual(hex, []);
});

test('rtl.css itself is clean under check-rtl (exemptions allowed)', async () => {
  const css = await readFile(RTL_CSS, 'utf8');
  const { findings } = scanText('apps/web/src/styles/rtl.css', css);
  assert.deepEqual(
    findings.map((f) => `${f.line}: ${f.message}`),
    [],
  );
});

test('Accented consumes tracking-accent, not a letter-spacing literal', async () => {
  const src = await readFile(PROVIDER, 'utf8');
  assert.match(src, /className="u-accent tracking-accent"/);
  assert.doesNotMatch(src, /letterSpacing|letter-spacing/);
});

test('English and Arabic catalogues have matching keys', async () => {
  const [en, ar] = await Promise.all([readFile(EN, 'utf8'), readFile(AR, 'utf8')]);
  const report = catalogueReport(en, ar);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.orphan, []);
  assert.ok(report.total > 50, `catalogue too small: ${report.total}`);
});

test('empty-state keys exist in both catalogues as complete sentences', async () => {
  const [en, ar] = await Promise.all([readFile(EN, 'utf8'), readFile(AR, 'utf8')]);
  const keys = (text) => [...text.matchAll(/^\s*'(empty\.[^']+)'\s*:/gm)].map((m) => m[1]);
  const values = (text) =>
    [...text.matchAll(/^\s*'empty\.[^']+'\s*:\s*'([^']+)'/gm)].map((m) => m[1]);
  const enKeys = keys(en);
  const arKeys = new Set(keys(ar));
  assert.ok(enKeys.length >= 10, `expected empty-state keys, got ${enKeys.length}`);
  for (const k of enKeys) assert.ok(arKeys.has(k), `Arabic missing ${k}`);
  for (const v of values(en)) {
    assert.equal(/no data available/i.test(v), false, v);
  }
});

test('layout mounts I18nProvider and globals.css imports rtl.css', async () => {
  const layout = await readFile(join(ROOT, 'apps', 'web', 'src', 'app', 'layout.tsx'), 'utf8');
  const globals = await readFile(join(ROOT, 'apps', 'web', 'src', 'app', 'globals.css'), 'utf8');
  assert.match(layout, /I18nProvider/);
  assert.match(layout, /directionOf/);
  // globals.css lives in src/app/ and rtl.css in src/styles/, so the import is
  // '../styles/rtl.css'. The assertion used to pin './styles/rtl.css', a path
  // that has never resolved from src/app/ — the import was right and the test
  // was describing a layout the repo does not have. Matched loosely on the tail
  // of the path so moving globals.css one directory does not fail a file it
  // does not own; what this test actually guards is that the ONLY stylesheet
  // the entrypoint loads still pulls in the RTL layer.
  assert.match(globals, /@import\s+'[^']*styles\/rtl\.css'/);
});

test('COMPANY.md carries the standing PDPL block every run inherits', async () => {
  const md = await readFile(COMPANY, 'utf8');
  assert.match(md, /## 7\. Data handling — PDPL constraints/);
  assert.match(md, /Traces stay local/);
  assert.match(md, /Redact at instrumentation/);
  assert.match(md, /Langfuse/);
});

test('encrypted backups of the local volume are documented', async () => {
  const md = await readFile(join(ROOT, 'infra', 'BACKUP.md'), 'utf8');
  assert.match(md, /Part VII\.4/);
  assert.match(md, /openssl enc/i);
});

test('isWideTracking distinguishes emphasis-as-tracking from optical relief', () => {
  assert.equal(isWideTracking('.25em'), true);
  assert.equal(isWideTracking('.3em'), true);
  assert.equal(isWideTracking('normal'), false);
  assert.equal(isWideTracking('-.01em'), false);
  assert.equal(isWideTracking('var(--track-2)'), false);
});

test('physical left/right in CSS is a finding unless exempted', () => {
  const dirty = '.x { margin-left: 12px; }\n';
  const { findings } = scanText('apps/web/src/x.css', dirty);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'physical-property');

  const clean = '/* rtl-exempt: gradient mapping lives once */\n[dir=ltr] { --to-inline-end: to right; }\n';
  const r = scanText('apps/web/src/x.css', clean);
  assert.equal(r.findings.length, 0);
  assert.ok(r.exemptions.length >= 1);
});
