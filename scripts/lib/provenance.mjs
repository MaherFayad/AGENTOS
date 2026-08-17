/**
 * provenance.mjs — make a checker's result say *what it was a result about*.
 *
 * WHY THIS EXISTS, in one incident.
 *
 * On 2026-08-16 two agents ran the same command — `npm run validate:tokens`, which is
 * literally `node scripts/check-tokens.mjs` — and got 31 violations and 0 violations.
 * That looked like two instruments disagreeing about a central rule, which would be a
 * serious problem. It was not. It was ONE instrument run twice, hours apart, against a file
 * that changed four times in between: `drawer.module.css` was mid-cleanup from literal
 * `font-size:` values to `--drw-fs-*` tokens, and the `no-type-literal` count decayed
 * 38 → 37 → … → 31 → … → 0 as the cleanup landed.
 *
 * Nobody could tell, because the output carried no identity. "violations 0" and
 * "violations 31" are equally credible sentences with nothing in them to date, attribute or
 * reproduce. A stale pass is indistinguishable from a current one — and a stale PASS is the
 * dangerous direction, because it is silent.
 *
 * So every check prints the commit it saw, whether the tree was dirty, and when. Two
 * disagreeing runs can then be adjudicated by reading them instead of by re-litigating them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE TIMESTAMP IS LOCAL AND CARRIES ITS OFFSET. Both halves are load-bearing.
 *
 * The first version of this file printed `new Date().toISOString()` — UTC, with the `Z`
 * sliced off. On a UTC+3 host a scan run *at this instant* printed `scanned at 19:31` beside
 * a message stamped `22:31`. Found by `map-galaxy-engineer` 2026-08-16 by reading the number
 * against a wall clock, which is the only instrument that could have found it.
 *
 * That is this file's own disease, caught in this file. §8b exists because a stale result was
 * indistinguishable from a current one; an unlabelled timestamp in a foreign zone puts that
 * ambiguity straight back into the one line built to remove it, and it fails in the direction
 * that wastes work: a fresh result *looks* three hours old, so the honest reader re-runs it.
 *
 *   - **Local**, because every other timestamp in this repo is local — message filenames,
 *     `created:` frontmatter, BOARD entries. A reader compares the line against the clock on
 *     their wall or the `created:` two lines above it, and both of those are local. A number
 *     that needs arithmetic before it can be compared will not be compared.
 *   - **With an explicit offset**, because "local" is a property of the machine that ran the
 *     scan, not of the person reading it. CI runs UTC; this host runs +03:00. Without the
 *     offset the fix would only move the ambiguity, and this line gets quoted into files that
 *     outlive the session and the machine.
 *
 * **Relative age was considered and deliberately rejected.** A banner printed by the run
 * itself would always say "0m ago", and that zero freezes into every quotation of it — a
 * number that is true for one second and misleading forever after. The absolute local
 * timestamp is the thing a reader can still evaluate tomorrow.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Four scripts depend on this helper, so it degrades rather than throws in every environment
 * it can be run in: a fresh clone, CI before install, a container with no `.git`, a repo with
 * no commit yet, and a working tree someone else's `git` process is holding open. Each of
 * those reports what is actually known instead of guessing — a provenance line that lies
 * about provenance is worse than no line, because it is quoted with confidence.
 *
 * Owner: design-system-guardian
 * Pinned by: scripts/__tests__/provenance.test.mjs
 * Contract: comms/contracts/design-tokens.md §8b
 */

import { spawnSync } from 'node:child_process';

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // A read-only observer must never hang a build or disturb it. `GIT_OPTIONAL_LOCKS=0`
    // stops `status` from taking the index lock, `GIT_TERMINAL_PROMPT=0` stops a
    // credential prompt turning a banner into a deadlock, and the timeout bounds the rest.
    timeout: 5000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
  });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Local wall clock + the offset that makes it an instant.
 * `at` is what gets read; `iso` is what gets parsed. Machines must never parse `at`.
 */
function stamp(d = new Date()) {
  const mins = -d.getTimezoneOffset(); // minutes east of UTC; getTimezoneOffset is inverted
  const sign = mins < 0 ? '-' : '+';
  const abs = Math.abs(mins);
  const zone = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const wall = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    at: `${day} ${wall} ${zone}`,
    iso: `${day}T${wall}:${pad(d.getSeconds())}${zone}`,
  };
}

/** Count the porcelain lines for one pathspec. `null` when git could not answer. */
function dirtyCount(root, pathspec) {
  const porcelain = git(['status', '--porcelain', '--', pathspec], root);
  return porcelain === null ? null : porcelain.split('\n').filter((l) => l.trim()).length;
}

/**
 * Where the checkers themselves live. A second pathspec rather than a wider scope — see
 * the block comment below for why widening was rejected.
 */
const INSTRUMENT_DIR = 'scripts';

/**
 * @param {string} root   repo root
 * @param {string} [scope] optional path prefix (e.g. 'apps/web') — dirtiness is reported for
 *                         the scanned scope, since that is what can invalidate the result.
 * @param {string} [instrument] where the checker's own source lives. Reported SEPARATELY.
 * @returns {{at: string, iso: string, head: string|null, dirty: number|null,
 *            instrumentDirty: number|null, instrument: string|null,
 *            scope: string|null, line: string}}
 */
export function provenance(root, scope, instrument = INSTRUMENT_DIR) {
  const { at, iso } = stamp();
  const head = git(['rev-parse', '--short', 'HEAD'], root);

  // Asked even when HEAD is unavailable, because the two failures are different facts:
  // no `.git` at all vs. a real repo with no commit yet. The old code reported both as
  // "no git", which is a small lie in the file whose whole job is not telling those.
  const porcelain = git(['status', '--porcelain', '--', scope ?? '.'], root);
  const dirty = porcelain === null ? null : porcelain.split('\n').filter((l) => l.trim()).length;

  /* ───────────────────────────────────────────────────────────────────────────────────
   * THE SCOPE CANNOT CONTAIN THE ONE FILE THAT MOST INVALIDATES THE RESULT.
   *
   * Found in M15's re-gate by `fidelity-qa-reviewer` and routed by
   * `commandcenter-orchestrator`. `check-tokens.mjs` calls `provenance(ROOT, 'apps/web')`,
   * and a run made from a worktree with `scripts/check-rtl.mjs` modified printed:
   *
   *     scanned at        2026-08-17 20:34 +03:00 · eaca677 · clean
   *
   * The scoping decision above is right and stays: dirtiness is reported for the scanned
   * scope, because that is what can invalidate the result. **The exception is the
   * instrument.** §8b exists so a number can be re-derived later, and the two inputs to
   * that re-derivation are the scanned tree AND the checker that scanned it — a modified
   * checker changes the number without changing a single scanned file. So the banner's
   * `clean` was precisely wrong in the one case §8b was written for: a declared value read
   * as an observed one, on the instrument that exists to stop exactly that.
   *
   * TWO FIGURES, NOT ONE WIDER FIGURE. Widening `scope` to the repo was rejected and the
   * reason is about readers rather than about correctness: every banner would then read
   * dirty on an unrelated `comms/` edit, which trains people to ignore the field — worse
   * than the bug, because a field nobody reads fails silently. Reporting the instrument
   * separately keeps the existing sentence meaning exactly what it already meant and adds
   * the one clause it could not say.
   *
   * ASKED ONLY WHEN THE SCAN IS SCOPED. An unscoped run (`check-metrics`) already counts
   * `scripts/` inside `dirty`, and printing it twice would be noise dressed as rigour.
   * ─────────────────────────────────────────────────────────────────────────────────── */
  const instrumentDirty = scope ? dirtyCount(root, instrument) : null;

  const where = scope ? ` under ${scope}` : '';
  const state =
    dirty === null ? 'dirty state unknown' : dirty === 0 ? 'clean' : `${dirty} uncommitted${where}`;

  // Named for what it is rather than counted: the useful fact is "the thing that produced
  // this number is not the committed one", and a reader does not need to know it was two
  // files rather than one to act on that.
  const checker = instrumentDirty ? ` · checker modified under ${instrument}` : '';

  const id = head ?? (porcelain === null ? null : 'no commit');
  const line = id === null ? `${at} · no git` : `${at} · ${id} · ${state}${checker}`;

  return {
    at,
    iso,
    head,
    dirty,
    instrumentDirty,
    instrument: scope ? instrument : null,
    scope: scope ?? null,
    line,
  };
}

/**
 * The one-line banner. Deliberately printed even when the run is green: a pass you cannot
 * date is a pass you cannot trust later, and "later" is when passes get cited.
 */
export function provenanceLine(root, scope) {
  return provenance(root, scope).line;
}
