/**
 * §3.3 completeness — the number the galaxy's brightness is scaled by.
 *
 * The regression this file exists for: `build-graph.mjs` once counted `## ` headings and
 * reported a 0/20 COMPANY.md as 45% complete, which painted the Second Brain at 45%
 * brightness for a brain nobody had answered a question of (BOARD rule 9, Part VII.3).
 * The last test reads the real `company/COMPANY.md`, so the fabricated number cannot come
 * back without a red test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRAIN_QUESTION_COUNT,
  describeBrain,
  measureBrain,
  measureBrainFile,
} from '../lib/brain-completeness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPANY = join(ROOT, 'company', 'COMPANY.md');

const marker = (n) => `<!-- UNANSWERED: Q${n} something -->`;
const allMarkers = () =>
  Array.from({ length: BRAIN_QUESTION_COUNT }, (_, i) => marker(i + 1)).join('\n');

test('a missing COMPANY.md is zero, with every question outstanding', () => {
  const m = measureBrain(null);
  assert.equal(m.value, 0);
  assert.equal(m.answered, 0);
  assert.equal(m.total, BRAIN_QUESTION_COUNT);
  assert.equal(m.unanswered.length, BRAIN_QUESTION_COUNT);
  assert.equal(m.source, 'absent');
});

test('headings do not count as answers — structure is authored once and never moves', () => {
  const templateShapedLikeOurs = `# COMPANY.md\n\n${[
    '## 1. Identity',
    '## 2. Offers',
    '## 3. ICP',
    '## 4. Pricing',
    '## 5. Voice',
    '## 6. Red lines',
    '## 7. Data handling',
    '## 8. Operations',
    '## 9. Sources',
  ].join('\n\n')}\n\n${allMarkers()}\n`;

  const m = measureBrain(templateShapedLikeOurs);
  assert.equal(m.answered, 0, 'nine headings, zero answers');
  assert.equal(m.value, 0, 'the old implementation returned 0.45 here');
});

test('long instructional prose does not count as an answer either', () => {
  const text = `## 4. Pricing\n\nWrite the rule, not the number: "day rate × estimated days,\nfloor 5 days" survives a price change; "SAR 40,000" does not.\n\n${allMarkers()}\n`;
  assert.equal(measureBrain(text).answered, 0);
});

test('removing a marker is what moves the number', () => {
  const before = measureBrain(allMarkers());
  const after = measureBrain(
    allMarkers()
      .split('\n')
      .filter((line) => !/Q(1|2|3)\b/.test(line))
      .join('\n'),
  );
  assert.equal(before.answered, 0);
  assert.equal(before.value, 0);
  assert.equal(after.answered, 3);
  assert.equal(after.value, 0.15);
  assert.deepEqual(after.unanswered.slice(0, 3), [4, 5, 6]);
  assert.equal(describeBrain(after), '3 of 20 answered');
});

test('the bare marker form and a full COMPANY.md both parse', () => {
  const m = measureBrain(
    '- Sectors we will not take: <!-- UNANSWERED: Q16 -->\n<!--UNANSWERED:Q17-->\n<!-- UNANSWERED: no sources added yet -->\n',
  );
  // Q16 and Q17 outstanding; the note without a question number is not one of the twenty.
  assert.equal(m.answered, BRAIN_QUESTION_COUNT - 2);
  assert.deepEqual(m.unanswered, [16, 17]);
});

test('a fully answered brain is 1, and an out-of-range marker warns rather than counting', () => {
  const warnings = [];
  const m = measureBrain('Everything answered.\n<!-- UNANSWERED: Q99 -->\n', {
    warn: (w) => warnings.push(w),
  });
  assert.equal(m.value, 1);
  assert.match(warnings.join(' '), /outside Q1…Q20/);
});

test('a file with no markers at all warns loudly before reporting 100%', () => {
  const warnings = [];
  const m = measureBrain('# COMPANY\n\nWe do things.\n', { warn: (w) => warnings.push(w) });
  assert.equal(m.value, 1);
  assert.match(warnings.join(' '), /no UNANSWERED markers/);
});

test('the real company/COMPANY.md is 0 of 20 answered, and the payload must say so', async () => {
  const m = await measureBrainFile(COMPANY);
  const text = await readFile(COMPANY, 'utf8');

  // The file states its own truth in prose; the measurement has to agree with it.
  assert.match(text, /Completeness:\*\* 0 of 20 answered/);
  assert.equal(m.answered, 0);
  assert.equal(m.total, 20);
  assert.equal(m.value, 0, 'a 0/20 brain may never paint at 45% (CLAUDE.md rule 9)');
});
