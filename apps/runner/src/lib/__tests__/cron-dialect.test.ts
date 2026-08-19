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
import { parseCron } from '../cron.ts';

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
 * **A pin on a live defect, not a proof of correctness.** ADR-040 found this while writing the
 * gate above and did not fix it, because neither file is `scheduler-engineer`'s:
 * `packages/contracts/src/frontmatter.ts` is `agent-library-curator`'s and
 * `apps/runner/src/lib/cron.ts` is `runner-engineer`'s.
 *
 * `CRON_BOUNDS[4]` is `[0, 7]` — POSIX, where `7` is Sunday. `FIELDS[4]` in the runner is
 * `{ min: 0, max: 6 }`. So `schedule: "0 0 * * 7"` passes `validate:frontmatter`, commits,
 * renders a clock badge and is un-plannable forever. It is not in the library today, and the
 * gate above is what stops it arriving; this pin is what stops the *fact* being forgotten.
 *
 * **It is designed to go red when somebody repairs it**, which is the honest shape when the
 * repair is in another agent's file: a gate that is red on arrival cannot be landed, and a
 * paragraph in a handoff is read once.
 */
test('PIN — the two cron dialects disagree about day-of-week 7, and the divergence is somebody else\'s to fix', () => {
  const fixed =
    'The dialects agree about day-of-week 7. Delete this pin and replace it with the full ' +
    'agreement gate ADR-040 describes: every expression isCronExpression accepts must parse ' +
    'under parseCron, with no exceptions listed.';

  assert.equal(isCronExpression('0 0 * * 7'), true, fixed);
  assert.throws(() => parseCron('0 0 * * 7'), /day of week 7 is out of range/, fixed);

  // The other direction, harmless but real: frontmatter is narrower about names. Recorded so
  // that "the dialects differ" is a checked statement rather than a remembered one.
  assert.equal(isCronExpression('0 0 * * mon'), false, fixed);
  assert.doesNotThrow(() => parseCron('0 0 * * mon'), fixed);
});
