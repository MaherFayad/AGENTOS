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

import {
  catalogueReport,
  isWideTracking,
  looksLikeProse,
  moduleOf,
  ratchetReport,
  scanText,
} from '../check-rtl.mjs';

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
  assert.ok(report.keys > 50, `catalogue too small: ${report.keys}`);
});

/* ---------------------------------------------------------------------------
 * The M15 verdict's item 3b, turned into a test.
 *
 * The falsification that found it: delete the Arabic `two`, `few` and `many` from
 * three count-bearing keys. `tsc` exited 0 (they are optional on `Plural`),
 * `check-rtl --gate` exited 0, the ratchet said "holding" and `arabic 212 (97%)`
 * did not move by one. Nothing in the repo could observe a missing plural class —
 * the only granularity that is Arabic-specific.
 * ------------------------------------------------------------------------ */

const EN_PLURAL = ["export const en = {", "  'a.count': {", "    one: '{count} run',", "    other: '{count} runs',", "  } satisfies Plural,", '};'].join('\n');
const arPlural = (classes) =>
  ['export const ar = {', "  'a.count': {", ...classes.map((c) => `    ${c}: 'x',`), '  },', '};'].join('\n');

test('a missing Arabic plural class is a finding — the dual is not the singular', () => {
  const full = catalogueReport(EN_PLURAL, arPlural(['one', 'two', 'few', 'many', 'other']));
  assert.deepEqual(full.pluralGaps, [], 'a complete Arabic plural must not be reported');

  const noDual = catalogueReport(EN_PLURAL, arPlural(['one', 'few', 'many', 'other']));
  assert.deepEqual(noDual.pluralGaps, [{ key: 'a.count', missing: ['two'] }]);

  const englishShaped = catalogueReport(EN_PLURAL, arPlural(['one', 'other']));
  assert.deepEqual(englishShaped.pluralGaps[0].missing, ['two', 'few', 'many']);
});

test('a class English declares is required of Arabic too, and zero is not invented', () => {
  const enWithZero = EN_PLURAL.replace("  'a.count': {", "  'a.count': {\n    zero: 'No runs',");
  // English separated zero, so it is a copy decision Arabic has to answer.
  assert.deepEqual(
    catalogueReport(enWithZero, arPlural(['one', 'two', 'few', 'many', 'other'])).pluralGaps,
    [{ key: 'a.count', missing: ['zero'] }],
  );
  // English did not, so CLDR's Arabic `zero` falls through to `other` — the
  // correct MSA form for a count of zero. Requiring it would be taste as grammar.
  assert.deepEqual(
    catalogueReport(EN_PLURAL, arPlural(['one', 'two', 'few', 'many', 'other'])).pluralGaps,
    [],
  );
});

test('an Arabic todo() is an admitted gap, not a plural-class failure', () => {
  const ar = ['export const ar = {', "  'a.count': todo('{count} runs'),", '};'].join('\n');
  const r = catalogueReport(EN_PLURAL, ar);
  assert.deepEqual(r.pluralGaps, []);
  assert.deepEqual(r.todoKeys, ['a.count']);
});

test('todo() counts call sites; TODO(ar) counts human markers; neither counts prose', () => {
  const ar = [
    '/* The word todo() appears four times in this comment: todo() todo() todo(). */',
    '// TODO(ar): a human left this note.',
    "  'a.real': todo('English'),",
    "  'a.done': 'عربي',",
  ].join('\n');
  const r = catalogueReport("export const en = {\n  'a.real': 'x',\n  'a.done': 'y',\n};", ar);
  assert.equal(r.todos, 1, 'five occurrences of the characters todo( — one is a call site');
  assert.equal(r.markers, 1, 'the uppercase human marker was never counted at all');
  assert.equal(r.translated, 1);
});

test('the catalogue report counts plural-class sentences, not just keys', async () => {
  const [en, ar] = await Promise.all([readFile(EN, 'utf8'), readFile(AR, 'utf8')]);
  const r = catalogueReport(en, ar);
  assert.ok(r.pluralKeys >= 8, `expected count-bearing keys, got ${r.pluralKeys}`);
  // The number the report used to print was `keys`, labelled "strings". Arabic
  // declares more classes than English by construction, so this is the invariant
  // that says the plural sentences are inside a number now.
  assert.ok(r.arClasses > r.enClasses, `${r.arClasses} Arabic classes vs ${r.enClasses} English`);
  assert.equal(r.enStrings, r.keys - r.pluralKeys + r.enClasses);
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

/**
 * REQ-RTL-12, and the reason it is four assertions rather than one.
 *
 * This block previously claimed **"Right to erasure is executable"** — in the one file §3.3
 * injects into every run of every project. It was false: no plane in this repo has a delete
 * verb. It survived because REQ-RTL-12's "Verified by" pointed at the test above, which
 * asserts `Traces stay local`, `Redact at instrumentation` and `Langfuse` and never looked at
 * the erasure sentence at all. **A requirement whose verification cannot see it is an
 * unverified requirement wearing a tick** — the same shape as `check-rtl` being blind to 190
 * rendered strings.
 *
 * So these assert the *corrected* content, and the ratchet is deliberate: restoring the old
 * claim now fails here. Falsified before it was claimed — reinstating the sentence "Right to
 * erasure is executable." turns this red, and removing rule 10 turns it red too.
 */
test('COMPANY.md states erasure by tier and does not claim it is executable', async () => {
  // Whitespace-normalised before matching. COMPANY.md is hard-wrapped prose, so every phrase
  // long enough to be worth asserting is long enough to straddle a newline — the first draft
  // of this test went red on `asserts no processing region for the model endpoint` purely
  // because the line broke after "processing". A checker that can only see phrases which
  // happen to fit on one line is the same blind instrument as the rest of this file's
  // fixtures, and it fails *open* on rewrap, which is the dangerous direction.
  const md = (await readFile(COMPANY, 'utf8')).replace(/\s+/g, ' ');

  assert.equal(
    /right to erasure is executable/i.test(md),
    false,
    'COMPANY.md claims erasure is executable. No plane in this repo has a delete verb, and this ' +
      'file is inherited by every run of every project — a false capability here is asserted to ' +
      'every agent in the system. State the tiers instead (thread-model.md §9.3 ruling).',
  );

  // Tier 3 is the whole ruling: a delete verb does not reach a person named inside free text,
  // because erasure requires selection first and prose has nothing to select on.
  assert.match(md, /No plane in this repo has a delete verb/i);
  assert.match(md, /A delete verb does not fix this tier/i);

  // The two lines co-owned with `observability-engineer`, which are rules an agent follows and
  // no redactor can enforce — which is exactly why they live in the inherited file.
  assert.match(md, /Never put a human's message into a trace, a log, or a push payload/i);
  assert.match(md, /Do not flatten a structured payload before tracing or logging/i);

  // "Traces stay local" is true and is not the whole egress story. Pinned so the narrower
  // claim cannot quietly go back to doing the wider claim's work.
  assert.match(md, /The model is a processor/i);
  assert.match(
    md,
    /asserts no processing region for the model endpoint/i,
    'the unasserted region is the honest part; deleting it leaves rule 11 reading as though it ' +
      'binds the model, which it does not',
  );
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

/* ---------------------------------------------------------------------------
 * The blind spots that made the counter unable to move.
 *
 * Each of these is a real shape from a real file that `check-rtl` scored as
 * clean while it was rendering English to a reader. They are pinned as fixtures
 * rather than as paths so the tests survive the files being refactored.
 * ------------------------------------------------------------------------ */

const copyFindings = (path, text) =>
  scanText(path, text).findings.filter((f) => f.rule === 'hardcoded-string');

test('a const map of user-facing words is copy — the LastRuns STATUS_WORD shape', () => {
  const src = [
    "const STATUS_WORD: Record<RunRow['status'], string> = {",
    "  queued: 'queued',",
    "  ok: 'finished',",
    "  'awaiting-approval': 'waiting for approval',",
    '};',
  ].join('\n');
  const found = copyFindings('apps/web/src/drawer/sections/LastRuns.tsx', src);
  assert.equal(found.length, 3, found.map((f) => f.message).join(' | '));
});

test('an object literal of sentences is copy — the CostTicker COPY shape', () => {
  const src = [
    'const COPY = {',
    "  loading: \"Checking today's agent spend.\",",
    "  zero: 'No agent run has been recorded today, so nothing has been spent.',",
    '};',
  ].join('\n');
  assert.equal(copyFindings('apps/web/src/components/shell/CostTicker.tsx', src).length, 2);
});

test('JSX text on its own line is copy — the BrainEmptyState shape', () => {
  // The rule this pins: the old regex forbade a newline inside the text node, so
  // Prettier's own formatting hid every string in the file.
  const src = ['<text y={4} textAnchor="middle">', '  Second brain', '</text>'].join('\n');
  const found = copyFindings('apps/web/src/map/svg/BrainEmptyState.tsx', src);
  assert.equal(found.length, 1, found.map((f) => f.message).join(' | '));
  assert.match(found[0].message, /Second brain/);
});

test('a sentence Prettier wrapped across two lines is ONE finding, not two', () => {
  const src = [
    'const COPY = {',
    "  outage:",
    "    'The run ledger is not answering, so today\\u2019s spend is unknown ' +",
    "    'and runs will be recorded once the database is back.',",
    '};',
  ].join('\n');
  assert.equal(copyFindings('apps/web/src/components/shell/CostTicker.tsx', src).length, 1);
});

test('one string is one finding even when two rules match it', () => {
  const src = '<button aria-label="Focus next department" />';
  assert.equal(copyFindings('apps/web/src/map/chrome/FocusRotator.tsx', src).length, 1);
});

test('machinery is not copy — the noise that would make people stop reading the output', () => {
  const cases = [
    ["'use client';", 'a bundler directive'],
    ["const c = 'flex items-center gap-2';", 'a Tailwind class list'],
    ["const TONE_TEXT = {\n  coral: 'text-ink-coral',\n};", 'a class map'],
    ["const FONT_FAMILY = {\n  sans: 'Plus Jakarta Sans',\n};", 'a font stack'],
    ["headers: { 'cache-control': 'no-store, no-transform' },", 'an HTTP header'],
    ["const u = 'https://example.test/a b';", 'a URL'],
    ["const s = 'repeating-linear-gradient(45deg, var(--line) 0px, transparent 8px)';", 'CSS'],
    ["const x = ok ? 'a' : 'b'; // spaces in a query mean \"then, later\"", 'a trailing comment'],
  ];
  for (const [src, what] of cases) {
    assert.deepEqual(
      copyFindings('apps/web/src/x.tsx', src).map((f) => f.message),
      [],
      `${what} was reported as copy`,
    );
  }
});

/* ---------------------------------------------------------------------------
 * The M15 verdict's item 2, and the fourth blind spot found alongside it.
 * ------------------------------------------------------------------------ */

test('a template literal with no ${} is a plain string literal', () => {
  // Falsified in the verdict by planting identical prose two ways: a FAIL as
  // `aria-label="…"` and silent as ``aria-label={`…`}``. The blind-spot
  // declaration for templates justifies itself on `${a} · ${b}` joins; a
  // zero-interpolation template has no such defence, and a declared blind spot is
  // not a licence over the decidable part of its own class.
  const quoted = '<button aria-label="Everything on screen is scoped." />';
  const backtick = '<button aria-label={`Everything on screen is scoped.`} />';
  assert.equal(copyFindings('apps/web/src/x.tsx', quoted).length, 1);
  assert.equal(
    copyFindings('apps/web/src/x.tsx', backtick).length,
    1,
    'the same prose in backticks was silent',
  );
  // …and it must stop being double-counted as a thing nobody looked at.
  assert.equal(scanText('apps/web/src/x.tsx', backtick).blind.exprAttr, 0);

  assert.equal(copyFindings('apps/web/src/x.tsx', 'const s = `Nothing is running yet.`;').length, 1);
  // An interpolated one is still the declared blind spot, not a finding.
  const assembled = 'const s = `Run ${when} finished cleanly today`;';
  assert.equal(copyFindings('apps/web/src/x.tsx', assembled).length, 0);
  assert.equal(scanText('apps/web/src/x.tsx', assembled).blind.template, 1);
});

test('a sentence cannot suppress its own finding by containing the word "to"', () => {
  // MACHINE_CONTEXT holds `to`, `it`, `as`, `id`, `key`, `name`, `type` and `test`
  // — identifiers, and ordinary English. Matched against the raw line, the copy
  // being judged got a vote on whether it was copy. These two differ by one
  // preposition and used to get opposite verdicts.
  const withPreposition = "const s = 'Everything on screen is scoped to it.';";
  const without = "const s = 'Everything on screen is scoped.';";
  assert.equal(copyFindings('apps/web/src/x.tsx', withPreposition).length, 1);
  assert.equal(copyFindings('apps/web/src/x.tsx', without).length, 1);
});

test('machine context still suppresses when it is code, including across lines', () => {
  // The mirror of the test above: blanking literals must not blank the suppression.
  assert.deepEqual(copyFindings('apps/web/src/x.tsx', 'className="flex items-center gap-2"'), []);
  // Prettier decides whether `headers: {` shares a line with its entries. The
  // context is the object, not the column width.
  const wrapped = ['{', '  headers: {', "    'cache-control': 'no-store, no-transform',", '  },', '}'].join('\n');
  assert.deepEqual(copyFindings('apps/web/src/x.ts', wrapped), []);
});

test('a backtick inside a quoted sentence is punctuation, not a template', () => {
  const src = "setError('Paste the recovery secret from `happy auth` on the machine.');";
  const found = copyFindings('apps/web/src/x.ts', src);
  assert.equal(found.length, 1, found.map((f) => f.message).join(' | '));
  assert.match(found[0].message, /Paste the recovery secret/);
});

test('looksLikeProse holds the line between a label and an identifier', () => {
  assert.equal(looksLikeProse('spend unknown'), true);
  assert.equal(looksLikeProse('Run now (beta)'), true);
  assert.equal(looksLikeProse('queued'), false); // one word — needs a copy-shaped home
  assert.equal(looksLikeProse('text-ink-coral'), false);
  assert.equal(looksLikeProse('/api/cost/today'), false);
  assert.equal(looksLikeProse('use client'), false);
});

test('the file reports what it cannot see, with a count or with nothing — never a zero', () => {
  const src = [
    'const label = "hello";',
    '<div title={label} aria-label={label} />;',
    'const s = `Run ${when} \\u2014 ${status} finished cleanly`;',
  ].join('\n');
  const { blind } = scanText('apps/web/src/x.tsx', src);
  assert.equal(blind.exprAttr, 2, 'expression-valued attributes must be counted, not judged');
  assert.equal(blind.template, 1, 'a sentence assembled from a template must be counted');
});

/* ---------------------------------------------------------------------------
 * The ratchet — what turns a red checker nobody runs back into a gate.
 * ------------------------------------------------------------------------ */

test('moduleOf names the unit an owner owns', () => {
  assert.equal(moduleOf('apps/web/src/components/shell/CostTicker.tsx'), 'components/shell');
  assert.equal(moduleOf('apps\\web\\src\\map\\svg\\BrainEmptyState.tsx'), 'map/svg');
  assert.equal(moduleOf('apps/web/src/MapView.tsx'), 'MapView.tsx');
});

test('the ratchet fails on new debt and stays silent on old debt', () => {
  const baseline = { total: 10, byRule: { 'hardcoded-string': 10 }, byModule: { 'map/svg': 10 } };

  const held = ratchetReport(
    { total: 10, byRule: { 'hardcoded-string': 10 }, byModule: { 'map/svg': 10 } },
    baseline,
  );
  assert.deepEqual(held.regressions, []);

  const worse = ratchetReport(
    { total: 11, byRule: { 'hardcoded-string': 11 }, byModule: { 'map/svg': 11 } },
    baseline,
  );
  assert.equal(worse.regressions.length, 3);

  const better = ratchetReport(
    { total: 9, byRule: { 'hardcoded-string': 9 }, byModule: { 'map/svg': 9 } },
    baseline,
  );
  assert.deepEqual(better.regressions, []);
  assert.equal(better.improvements.length, 3);
});

test('a module the baseline has never seen is entirely new debt', () => {
  // The case this exists for: a whole new surface lands — M15's project switcher
  // arrived mid-session with six uncatalogued strings — and a total-only ratchet
  // would hide it behind someone else's cleanup in another module.
  const r = ratchetReport(
    { total: 10, byRule: { 'hardcoded-string': 10 }, byModule: { 'map/svg': 4, 'components/shell': 6 } },
    { total: 10, byRule: { 'hardcoded-string': 10 }, byModule: { 'map/svg': 10 } },
  );
  assert.equal(r.regressions.length, 1);
  assert.match(r.regressions[0].scope, /components\/shell/);
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
