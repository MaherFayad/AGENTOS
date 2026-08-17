/**
 * provenance.mjs — a checker result must say what it is a result about.
 *
 * Guards two incidents, both of which are the same disease at different depths:
 *
 *  1. Two runs of check-tokens.mjs reported 31 and 0, were mistaken for two disagreeing
 *     instruments, and could not be told apart because neither output carried a commit, a
 *     dirty flag or a time. → the sha / dirty / scope tests.
 *
 *  2. The time it then carried was UTC on a UTC+3 host, so a scan run *at that instant*
 *     printed `19:31` beside a message stamped `22:31` — a fresh result that reads three
 *     hours stale, in the one line built to stop a stale result reading as fresh. Found by
 *     `map-galaxy-engineer` 2026-08-16 by holding the number against a wall clock.
 *
 * **The tests below pin the property, never the format string.** The property is what the
 * incident was about, and a format assertion would have been satisfied by the bug: the old
 * test matched `\d{4}-\d{2}-\d{2} \d{2}:\d{2}` and passed happily on a timestamp three hours
 * out. So the three timing tests are stated as:
 *
 *     (a) the printed clock is the clock of the machine that ran the scan;
 *     (b) the timestamp denotes ONE instant, whoever reads it and wherever they are;
 *     (c) a scan run now does not look old to a reader in any zone.
 *
 * They are checked in three real timezones (+00, +03, −10, none of which observe DST) by
 * re-running the helper in child processes with `TZ` forced, because a timezone bug is
 * invisible from inside the timezone that has it. Any format that satisfies (a)–(c) passes:
 * local-with-offset, full ISO with offset, RFC 3339, epoch plus label. The one thing that
 * cannot pass is a bare wall clock with no zone, which is the defect.
 *
 * Owner: design-system-guardian
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { provenance } from '../lib/provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = pathToFileURL(join(ROOT, 'scripts', 'lib', 'provenance.mjs')).href;

/** Three fixed-offset zones. No DST anywhere in this list, so nothing here is seasonal. */
const ZONES = ['UTC', 'Asia/Riyadh', 'Pacific/Honolulu'];
const FIVE_MIN = 5 * 60_000;

/** The timestamp is everything before the first separator — the rest is sha and dirt. */
const stampOf = (line) => line.split(' · ')[0].trim();

function node(code, args, tz) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: tz },
  });
  assert.equal(r.status, 0, `child (TZ=${tz}) failed: ${r.stderr}`);
  return r.stdout;
}

/** Run `provenance()` inside `tz`, and have the child report its own wall clock alongside. */
function provenanceIn(tz) {
  const out = node(
    `import { provenance } from ${JSON.stringify(LIB)};
     const p = (n) => String(n).padStart(2, '0');
     const wall = () => { const d = new Date(); return p(d.getHours()) + ':' + p(d.getMinutes()); };
     const before = wall();
     const prov = provenance(process.argv[1], 'apps/web');
     const after = wall();
     process.stdout.write(JSON.stringify({ before, after, prov }));`,
    [ROOT],
    tz,
  );
  const parsed = JSON.parse(out);
  // If TZ were ignored by the platform the child would simply run in the host zone; every
  // assertion below is still true and still meaningful, only the coverage narrows.
  return parsed;
}

/** Parse a timestamp *as a reader sitting in `tz` would*. */
const parseIn = (text, tz) =>
  Number(node('process.stdout.write(String(Date.parse(process.argv[1])))', [text], tz));

test('the printed clock is the clock of the machine that ran the scan', () => {
  // (a) The incident, stated directly: a scan run now must not display a time that is not
  // now. Compared against the child's own wall clock, so it holds in any zone rather than
  // in the one the developer happens to be in.
  for (const tz of ZONES) {
    const { before, after, prov } = provenanceIn(tz);
    const shown = stampOf(prov.line);
    assert.ok(
      shown.includes(before) || shown.includes(after),
      `TZ=${tz}: line shows "${shown}" while the machine's clock said ${before}/${after}. ` +
        `A freshly run scan that displays a foreign zone's wall clock reads as stale, which ` +
        `is the ambiguity contract §8b exists to remove.`,
    );
  }
});

test('the timestamp denotes one instant, whoever reads it', () => {
  // (b) "Local time" is a property of the machine that scanned, not of the person reading
  // the quote six hours and one timezone later. So the string has to carry its own zone:
  // three readers in three zones must resolve it to the same instant.
  for (const tz of ZONES) {
    const shown = stampOf(provenanceIn(tz).prov.line);
    const epochs = ZONES.map((reader) => parseIn(shown, reader));
    assert.ok(Number.isFinite(epochs[0]), `"${shown}" does not parse as a date at all`);
    assert.equal(
      new Set(epochs).size,
      1,
      `"${shown}" (written under TZ=${tz}) resolves to ${epochs.length} different instants ` +
        `depending on the reader's zone: ${epochs.join(', ')}. It needs an explicit offset.`,
    );
  }
});

test('a scan run now does not look old to a reader in any zone', () => {
  // (c) (a) and (b) together, measured against the clock that matters — the reader's, and
  // every reader, not a convenient one. Pinning a single reader zone here would have let the
  // original bug through: UTC digits read by a UTC reader are correct, and the incident was
  // a +03 reader. Each of the three zones must find the scan fresh.
  for (const tz of ZONES) {
    const shown = stampOf(provenanceIn(tz).prov.line);
    for (const reader of ZONES) {
      const age = Date.now() - parseIn(shown, reader);
      assert.ok(
        Math.abs(age) < FIVE_MIN,
        `scanned under TZ=${tz}, read from ${reader}: "${shown}" reads as ` +
          `${Math.round(age / 60_000)} minutes old the moment it was produced.`,
      );
    }
  }
});

test('machines get a full ISO instant so nothing has to parse the display string', () => {
  const p = provenance(ROOT, 'apps/web');
  assert.ok(Number.isFinite(Date.parse(p.iso)), `iso "${p.iso}" must be machine-parseable`);
  assert.ok(Math.abs(Date.now() - Date.parse(p.iso)) < FIVE_MIN);
  // Same instant as the human line, to the minute the human line prints.
  assert.ok(Math.abs(Date.parse(p.iso) - Date.parse(stampOf(p.line))) < 60_000);
});

test('reports the commit and the dirty count for the scanned scope', () => {
  const p = provenance(ROOT, 'apps/web');
  assert.match(p.head, /^[0-9a-f]{7,}$/, 'a short sha');
  assert.equal(typeof p.dirty, 'number');
  assert.equal(p.scope, 'apps/web');
  assert.ok(p.line.includes(` · ${p.head} · `), 'the sha is in the line, not only the object');
});

test('a repo with no git degrades to a dated line instead of throwing', async () => {
  // These scripts run on fresh clones, in CI before install, and in containers with no .git.
  // A checker that crashes without git is a checker nobody can run in the place it matters.
  const dir = await mkdtemp(join(tmpdir(), 'prov-'));
  try {
    const p = provenance(dir);
    assert.equal(p.head, null);
    assert.match(p.line, /no git$/);
    assert.ok(Math.abs(Date.now() - Date.parse(stampOf(p.line))) < FIVE_MIN, 'still dated');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a git repo with no commit says so, instead of claiming there is no git', async () => {
  // Two different facts, and the file whose job is telling results apart may not blur them:
  // "there is no repository here" and "this repository has nothing committed yet" send a
  // reader to different places.
  const dir = await mkdtemp(join(tmpdir(), 'prov-empty-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8', windowsHide: true });
    const p = provenance(dir);
    assert.equal(p.head, null);
    assert.ok(!p.line.includes('no git'), `an initialised repo is not "no git": ${p.line}`);
    assert.match(p.line, /no commit/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a dirty scope is reported as uncommitted, which is the stale-result warning', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prov-git-'));
  try {
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', windowsHide: true });
    g('init', '-q');
    g('config', 'user.email', 't@t.t');
    g('config', 'user.name', 't');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'a.txt'), 'one', 'utf8');
    g('add', '-A');
    g('commit', '-qm', 'init');

    assert.equal(provenance(dir, 'src').dirty, 0, 'clean after commit');
    assert.match(provenance(dir, 'src').line, /clean$/);

    await writeFile(join(dir, 'src', 'a.txt'), 'two', 'utf8');
    const p = provenance(dir, 'src');
    assert.equal(p.dirty, 1);
    assert.match(p.line, /1 uncommitted under src$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a modified checker is reported even though it is outside the scanned scope', async () => {
  // M15's re-gate: `check-tokens.mjs` scopes to `apps/web`, so a run made with
  // `scripts/check-rtl.mjs` modified printed `· clean`. §8b exists so a number can be
  // RE-DERIVED, and the two inputs to that are the scanned tree and the checker that
  // scanned it — a modified checker changes the number without touching a scanned file.
  // So the banner's `clean` was precisely wrong in the one case §8b was written for.
  //
  // Falsified rather than reasoned, in a repo built for it: the clause must be ABSENT
  // when only the scanned scope is dirty, and PRESENT when only the instrument is. A
  // clause that is always on is a clause nobody reads.
  const dir = await mkdtemp(join(tmpdir(), 'prov-instrument-'));
  try {
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', windowsHide: true });
    g('init', '-q');
    g('config', 'user.email', 't@t.t');
    g('config', 'user.name', 't');
    await mkdir(join(dir, 'src'), { recursive: true });
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await writeFile(join(dir, 'src', 'a.txt'), 'one', 'utf8');
    await writeFile(join(dir, 'scripts', 'check.mjs'), 'export const v = 1;\n', 'utf8');
    g('add', '-A');
    g('commit', '-qm', 'init');

    const clean = provenance(dir, 'src');
    assert.equal(clean.instrumentDirty, 0);
    assert.ok(
      !clean.line.includes('checker modified'),
      `a clean checker must say nothing: ${clean.line}`,
    );

    // The exact shape of the incident: the SCANNED SCOPE IS UNTOUCHED and the instrument
    // is not. This is the case that printed a confident `clean`.
    await writeFile(join(dir, 'scripts', 'check.mjs'), 'export const v = 2;\n', 'utf8');
    const p = provenance(dir, 'src');
    assert.equal(p.dirty, 0, 'the scanned scope really is clean — that half was never wrong');
    assert.equal(p.instrumentDirty, 1);
    assert.match(p.line, /clean · checker modified under scripts$/);

    // And the two figures stay independent: a dirty scope keeps its own sentence intact.
    await writeFile(join(dir, 'src', 'a.txt'), 'two', 'utf8');
    assert.match(provenance(dir, 'src').line, /1 uncommitted under src · checker modified/);

    // An UNSCOPED run already counts scripts/ in `dirty`. Saying it twice would be noise
    // dressed as rigour, and the widening that would have produced it was rejected because
    // a banner that is always dirty trains readers to skip the field.
    const whole = provenance(dir);
    assert.equal(whole.instrumentDirty, null);
    assert.ok(!whole.line.includes('checker modified'), whole.line);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

for (const [name, script, scope] of [
  ['check-tokens', 'scripts/check-tokens.mjs', 'apps/web'],
  ['check-comms', 'scripts/check-comms.mjs', 'comms'],
]) {
  test(`${name} prints a fresh, datable provenance line in human and --json output`, () => {
    const human = spawnSync(process.execPath, [join(ROOT, script)], { cwd: ROOT, encoding: 'utf8' });
    const banner = human.stdout.match(/(?:scanned|checked) at\s+(.+)/);
    assert.ok(banner, `${name} printed no provenance banner`);
    const shown = stampOf(banner[1]);
    assert.ok(
      Math.abs(Date.now() - Date.parse(shown)) < FIVE_MIN,
      `${name} banner "${shown}" does not read as just-run`,
    );

    const json = spawnSync(process.execPath, [join(ROOT, script), '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.provenance.scope, scope);
    assert.ok(parsed.provenance.at, 'json carries the display timestamp');
    assert.ok(
      Math.abs(Date.now() - Date.parse(parsed.provenance.iso)) < FIVE_MIN,
      'json carries a machine-parseable instant',
    );
  });
}
