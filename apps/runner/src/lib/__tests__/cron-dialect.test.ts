/**
 * The five-field rule, graded against the parser that has to consume it — ADR-040.
 *
 * `scripts/validate-frontmatter.mjs` refuses a six-field `schedule:`, and until this file existed
 * the reason it gave was *"ofelia would silently take a 6-field one to mean something else"*.
 * Ofelia left the stack at `e4e0bff`. The rule is kept and re-justified (ADR-040), and the new
 * reason is this file rather than a sentence:
 *
 * **`parseCron` is the only code in this repo that turns a cron expression into an occurrence.**
 * `nextRunAt` (the MAP's clock badge) and `scheduleClock.ts` (what the coordinator plans with,
 * `scheduling.md` §12) both share it. It takes exactly five fields. So a `schedule:` string it
 * cannot parse is a clock badge for a job that can never be planned — frontmatter claiming a
 * capability the coordinator does not have.
 *
 * ## Why it reads the real library rather than comparing two validators
 *
 * Tonight's standing finding: *a pin comparing two declarations is satisfiable by a lie.*
 * `isCronExpression` and `parseCron` agreeing proves the two functions agree; it does not prove
 * any committed schedule is plannable. So the load-bearing assertion below takes **the actual
 * strings in `agents/**​/SKILL.md`** and runs them through the coordinator's parser. The subject
 * is a committed value and the verdict is a real parse.
 *
 * And because a corpus reader is the family of checker that goes blind silently — the
 * comment-stripper that deleted half its input and passed, `check-rtl` that could not see 190
 * strings — this file asserts **what it saw** before it asserts anything is true of it: a
 * minimum SKILL.md count, and that at least one of them actually carried a `schedule:`. A green
 * run over zero files is the failure this repo has shipped four times.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCronExpression } from '@agnetos/contracts';
import { nextRunAt, parseCron } from '../cron.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const LIBRARY = join(REPO, 'agents');

/** Every `SKILL.md` under `agents/`, at any depth. Depth is not assumed; the tree is walked. */
async function skillFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await skillFiles(full)));
    else if (entry.name === 'SKILL.md') out.push(full);
  }
  return out;
}

/**
 * The `schedule:` line, read the way YAML frontmatter actually stores it.
 *
 * Deliberately **not** a YAML parse: a full parse would fail on any unrelated frontmatter defect
 * and take this assertion down with it, which is a checker that goes blind for a reason that has
 * nothing to do with cron. The narrow read is a scalar on its own line, quoted or bare, with an
 * optional trailing `#` comment — which is the shape `frontmatter-schema.md` documents and the
 * shape all three committed schedules use.
 */
function scheduleLine(source: string): string | null {
  const match = /^schedule:[ \t]*(.+)$/m.exec(source);
  if (!match) return null;
  let value = (match[1] ?? '').trim();
  const comment = value.indexOf('#');
  if (comment !== -1) value = value.slice(0, comment).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value === '' || value === 'null' ? null : value;
}

test('every schedule: committed to the library is one the coordinator can actually plan', async () => {
  const files = await skillFiles(LIBRARY);

  // What this instrument saw, asserted before anything is concluded from it. Without these two
  // lines a broken path, a renamed directory or an empty checkout is a green run.
  assert.ok(
    files.length >= 10,
    `only ${files.length} SKILL.md files were found under ${LIBRARY} — this gate is reading the wrong tree and cannot see the library it claims to check.`,
  );

  const scheduled: { file: string; cron: string }[] = [];
  for (const file of files) {
    const cron = scheduleLine(await readFile(file, 'utf8'));
    if (cron !== null) scheduled.push({ file: relative(REPO, file), cron });
  }

  assert.ok(
    scheduled.length >= 1,
    'no agent in the library declares a schedule:, so this gate asserted nothing. Either the ' +
      'extractor stopped matching the frontmatter shape or the last scheduled agent was removed; ' +
      'both need a human, and neither is a pass.',
  );

  for (const { file, cron } of scheduled) {
    assert.doesNotThrow(
      () => parseCron(cron),
      `${file} declares schedule: "${cron}", which the coordinator's own parser refuses. The MAP ` +
        'renders a clock badge for it and no occurrence can ever be computed — ADR-040. Fix the ' +
        'expression, or widen parseCron first and this gate second.',
    );
  }
});

test('six fields is refused by the parser, which is the reason the frontmatter rule now gives', () => {
  // ADR-040's whole substitution, as behaviour: the rule no longer rests on a Go parser that
  // was deleted, it rests on this throw. If parseCron ever accepts six fields, the sentence in
  // validate-frontmatter.mjs becomes false and this test says so before a reader does.
  assert.throws(
    () => parseCron('0 0 7 * * *'),
    /5-field/,
    'parseCron accepts a six-field expression, so ADR-040\'s stated reason for the frontmatter ' +
      'rule is no longer true. Re-argue the rule or drop it; do not leave it citing this throw.',
  );
  assert.equal(isCronExpression('0 0 7 * * *'), false);

  // The permissive half, stated so the rule is graded from both sides: the five-field forms the
  // library actually uses are accepted by both. A refusal that also refuses everything real is a
  // different defect wearing the same green.
  for (const ok of ['0 6 * * 1', '0 5 * * *', '*/15 * * * *', '0 0 1 1 *']) {
    assert.equal(isCronExpression(ok), true, `${ok} should validate in frontmatter`);
    assert.doesNotThrow(() => parseCron(ok), `${ok} should parse for the coordinator`);
  }
});

/**
 * **The agreement gate the pin asked for.** Until 2026-08-19 this file ended in a pin recording
 * that the two dialects disagreed about day-of-week `7`: `CRON_BOUNDS[4]` in
 * `packages/contracts/src/frontmatter.ts` is `[0, 7]` (POSIX/Vixie, where `7` is Sunday) while
 * `FIELDS[4]` in `apps/runner/src/lib/cron.ts` was `{ min: 0, max: 6 }`. So `schedule: "0 6 * * 7"`
 * passed `validate:frontmatter`, committed, rendered a clock badge, and threw in the only parser
 * that can turn it into an occurrence. `runner-engineer` fixed it in the permissive direction —
 * `max: 7` with `7` folded to `0` after range expansion — and the pin is replaced here, in the
 * same commit, by what its own failure message specified.
 *
 * **The direction is one-way and that is deliberate.** `isCronExpression` is what lets a
 * `schedule:` be *committed*; `parseCron` is what turns it into an occurrence. So everything
 * frontmatter accepts must parse, with no exceptions listed. The converse does not hold and must
 * not be asserted: `parseCron` also accepts `mon`/`jan` names, which frontmatter rejects, and a
 * name that cannot be committed cannot strand a badge.
 *
 * **Not a comparison of two declarations.** The standing finding is that a pin comparing two
 * declarations is satisfiable by a lie. This runs a generated corpus through both *functions* and
 * asserts what it saw before concluding anything: how many expressions frontmatter actually
 * accepted, and — named explicitly, because a narrowing of `CRON_BOUNDS` would otherwise make the
 * whole implication vacuously true and green — that `0 0 * * 7` is still one of them.
 */

/** Per-field token forms, including out-of-range ones so the corpus contains real rejections. */
const TOKENS: Record<number, string[]> = {
  0: ['*', '0', '59', '60', '*/15', '0-30', '0,30', '00', '5/10'],
  1: ['*', '0', '23', '24', '*/6', '9-17', '6,18', '09'],
  2: ['*', '1', '31', '0', '32', '1-15', '1,15', '*/2'],
  3: ['*', '1', '12', '0', '13', '1-6', '1,7', '*/3', 'jan'],
  4: ['*', '0', '6', '7', '8', '-1', '1-5', '5-7', '0-7', '1,7', '7/1', '*/2', '07', 'mon'],
};

/** `* * * * *` with one field replaced — enough shape without a 100k-row cross product. */
function corpus(): string[] {
  const out = new Set<string>(['* * * * *']);
  for (const [index, tokens] of Object.entries(TOKENS)) {
    for (const token of tokens) {
      const parts = ['*', '*', '*', '*', '*'];
      parts[Number(index)] = token;
      out.add(parts.join(' '));
    }
  }
  for (const whole of ['0 0 * * 7', '0 6 * * 7', '0 6 * * 1,7', '0 6 * * 5-7', '30 2 1 1 0', '*/15 9-17 * * 1-5']) {
    out.add(whole);
  }
  return [...out];
}

test('every expression frontmatter accepts, the coordinator can parse — no exceptions', () => {
  const all = corpus();
  const accepted = all.filter((expression) => isCronExpression(expression));

  // What the instrument saw, asserted before anything is concluded from it. A corpus that
  // generated nothing, or a CRON_BOUNDS narrowed until nothing is accepted, would otherwise
  // satisfy the implication below by holding it vacuously.
  assert.ok(
    accepted.length >= 30,
    `frontmatter accepted only ${accepted.length} of ${all.length} generated expressions — this ` +
      'gate is asserting an implication over almost nothing. Either the corpus stopped generating ' +
      'or isCronExpression was narrowed; both need a human.',
  );
  assert.ok(
    accepted.includes('0 0 * * 7'),
    'isCronExpression no longer accepts "0 0 * * 7", so the very case this gate replaced a pin ' +
      'for is no longer being tested and every assertion below is vacuous for it. If day-of-week ' +
      '7 was deliberately removed from CRON_BOUNDS that is a frontmatter schema change ' +
      '(agent-library-curator, ADR-040) — and parseCron should be narrowed back in the same breath.',
  );

  for (const expression of accepted) {
    assert.doesNotThrow(
      () => parseCron(expression),
      `frontmatter accepts "${expression}" and the coordinator's parser refuses it. That is a ` +
        'schedule a human can commit, that renders a clock badge, and that can never be planned ' +
        '— ADR-040. Widen parseCron, or narrow frontmatter and say so in an ADR.',
    );
  }
});

/**
 * **Parsing `7` is not enough, and accepting it without folding would be worse than refusing it.**
 * Every consumer matches the expanded day-of-week set against `getUTCDay()`, which returns 0-6 and
 * never 7. So a `max: 7` without the fold parses clean, validates clean, renders a badge — and
 * matches no day for the four years `nextRunAt` scans. That is the same stranded badge wearing a
 * green tick, which is why the assertions below are about occurrences and not about a Set.
 */
test('day-of-week 7 is Sunday, all the way through to the occurrence', () => {
  const from = new Date('2026-08-19T00:00:00.000Z'); // a Wednesday

  const sunday = nextRunAt('0 6 * * 7', from);
  assert.ok(sunday !== null, '"0 6 * * 7" produced no occurrence in four years — 7 parsed but was ' +
    'never folded to 0, so it matches a weekday that does not exist.');
  assert.equal(new Date(sunday).getUTCDay(), 0, `"0 6 * * 7" fired on day ${new Date(sunday).getUTCDay()}, not Sunday.`);
  assert.equal(sunday, nextRunAt('0 6 * * 0', from), '"0 6 * * 7" and "0 6 * * 0" are the same schedule in POSIX cron.');

  // A range that spans the seam: Fri, Sat, Sun. Folding at parse time would have turned this into
  // `5-0` and thrown "runs backwards", so this is what pins the fold to *after* expansion.
  const span = parseCron('0 6 * * 5-7').fields[4]!;
  assert.deepEqual([...span].sort(), [0, 5, 6], '"5-7" should expand to Fri, Sat, Sunday-as-0.');
  assert.deepEqual([...parseCron('0 6 * * 1,7').fields[4]!].sort(), [0, 1]);

  // `*` must not leak a 7 into the set either — it expands across the widened max.
  assert.deepEqual([...parseCron('0 6 * * *').fields[4]!].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);

  // Widened by exactly one, not opened. 8 is out of range in both dialects.
  assert.throws(() => parseCron('0 6 * * 8'), /day of week 8 is out of range/);
  assert.equal(isCronExpression('0 6 * * 8'), false);
});
