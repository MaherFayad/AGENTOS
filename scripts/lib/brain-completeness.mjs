/**
 * brain-completeness.mjs — the one honest measurement of §3.3 Second Brain completeness.
 *
 * §2.1/§3.3: "the center galaxy particle count/brightness scales with brain completeness —
 * a delightful, honest progress indicator." That number is the most visible claim the
 * product makes about itself, so it is measured from the one signal in `company/COMPANY.md`
 * that cannot be produced by a template:
 *
 *   `<!-- UNANSWERED: Qn … -->`  — one marker per interview question, twenty of them.
 *
 * `agents/intelligence/company-interview/SKILL.md` writes and removes those markers and
 * calls the gap list "the honest completeness signal that the galaxy's particle brightness
 * scales with". `company/COMPANY.md` repeats the rule in its own header: *"do not delete
 * the marker to make the file look finished."* So the markers are the contract, and this
 * module is the only place that reads them.
 *
 * What this deliberately does NOT do:
 *   - count `## ` headings (structure is authored once and never moves — it measured 45%
 *     for a file with zero answers, which is the bug this module exists to make impossible);
 *   - score prose length (the template's own instructional paragraphs are prose);
 *   - blend in `company/sources/*` (easier to move than an answer, so it would inflate).
 *
 * Node builtins only (ADR-006), no imports from `apps/**`, so both producers of the number
 * can read it: `scripts/build-graph.mjs` today, and `apps/runner` the same way it already
 * imports `scripts/lib/layout.mjs`.
 *
 * Owner: `map-galaxy-engineer` (contracts/graph-layout.md). Spec: §3.3, §2.1.
 */

import { readFile } from 'node:fs/promises';

/** §3.3 / the interview SKILL: twenty questions. Q1…Q20 are the marker namespace. */
export const BRAIN_QUESTION_COUNT = 20;

/**
 * `<!-- UNANSWERED: Q7 best client -->` and the bare `<!-- UNANSWERED: Q16 -->` form both
 * count. A marker without a question number (`<!-- UNANSWERED: no sources added yet -->`)
 * is a note, not a question, and is ignored on purpose — `sources/` is not one of the 20.
 */
const QUESTION_MARKER = /<!--\s*UNANSWERED\s*:?\s*Q(\d{1,3})\b/gi;

/** Any UNANSWERED marker at all — used only to tell "no markers" from "no file". */
const ANY_MARKER = /<!--\s*UNANSWERED\b/i;

const round3 = (n) => Math.round(n * 1000) / 1000;
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

/**
 * @typedef {object} BrainMeasurement
 * @property {number}   value       0…1, rounded to 3dp — `core.brainCompleteness`.
 * @property {number}   answered    questions with no marker left.
 * @property {number}   total       questions in the interview (20).
 * @property {number[]} unanswered  the question numbers still marked, ascending.
 * @property {'company/COMPANY.md'|'absent'} source  where the number came from.
 */

/**
 * Measure a COMPANY.md. Pure: takes text, returns numbers, touches no filesystem.
 *
 * @param {string|null|undefined} markdown  file contents, or null when there is no file.
 * @param {{total?: number, warn?: (m: string) => void}} [options]
 * @returns {BrainMeasurement}
 */
export function measureBrain(markdown, options = {}) {
  const total =
    Number.isInteger(options.total) && options.total > 0 ? options.total : BRAIN_QUESTION_COUNT;
  const warn = options.warn ?? (() => {});

  // No file, or an empty one: zero answered, every question outstanding. The galaxy then
  // renders as an empty disc rather than a swirl (CLAUDE.md rule 9).
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return { value: 0, answered: 0, total, unanswered: range(total), source: 'absent' };
  }

  const outstanding = new Set();
  for (const match of markdown.matchAll(QUESTION_MARKER)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > total) {
      warn(
        `company/COMPANY.md carries an UNANSWERED marker for Q${match[1]}, which is outside ` +
          `Q1…Q${total} — ignored. The interview asks ${total} questions.`,
      );
      continue;
    }
    outstanding.add(n);
  }

  if (outstanding.size === 0 && !ANY_MARKER.test(markdown)) {
    // Loud on purpose: this is the one input shape that reads as 100% without anybody
    // answering anything. The honesty rule in COMPANY.md's header exists to prevent it.
    warn(
      'company/COMPANY.md carries no UNANSWERED markers, so all ' +
        `${total} interview questions count as answered. If that is not true, restore the ` +
        'markers — deleting them to make the file look finished is the failure mode §3.3 names.',
    );
  }

  const answered = Math.max(0, total - outstanding.size);
  return {
    value: round3(answered / total),
    answered,
    total,
    unanswered: [...outstanding].sort((a, b) => a - b),
    source: 'company/COMPANY.md',
  };
}

/**
 * Read and measure a COMPANY.md path. An unreadable file is `absent` — zero, never a guess.
 *
 * @param {string} path
 * @param {{total?: number, warn?: (m: string) => void}} [options]
 * @returns {Promise<BrainMeasurement>}
 */
export async function measureBrainFile(path, options = {}) {
  let text = null;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    text = null;
  }
  return measureBrain(text, options);
}

/** `0 of 20 answered` — one phrasing, so the build log, the payload and the UI agree. */
export function describeBrain(measurement) {
  return `${measurement.answered} of ${measurement.total} answered`;
}
