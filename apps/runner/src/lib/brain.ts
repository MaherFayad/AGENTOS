/**
 * The Second Brain (§3.3) — `company/COMPANY.md` + `company/sources/*`.
 *
 * Two jobs:
 *   1. Provide COMPANY.md to every single runner invocation (that is what makes outputs
 *      sound like this company, and it is why the injection lives in one function).
 *   2. Compute **brain completeness** honestly.
 *
 * On (2): the galaxy's particle count and brightness scale with this number, so it is a
 * progress indicator a person will read as truth. It is therefore computed from what
 * COMPANY.md actually answers — never a constant, never nudged upward, and never blended
 * with easier-to-move quantities like the number of files in `sources/` (which is
 * reported alongside it instead, so it can inform without inflating).
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrainCompleteness } from '@agnetos/contracts';
import { commitCompanyFile, lastCommitIso } from './git';
import type { RunnerConfig } from './config';

/**
 * Minimum characters before the interview's artifact is trusted to replace the brain.
 * A near-empty artifact would silently erase COMPANY.md and commit the erasure as its new
 * history, so `writeBackBrain` refuses below this.
 */
const MIN_ANSWER_CHARS = 40;

async function countSources(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

interface BrainMeasurement {
  value: number;
  answered: number;
  total: number;
  unanswered: number[];
}

/**
 * `scripts/lib/brain-completeness.mjs` — **`map-galaxy-engineer`'s module, imported and
 * never reimplemented**, the same arrangement as `layout.mjs` under ADR-003.
 *
 * Loaded dynamically because `scripts/` may not be mounted in every container.
 */
async function loadCounter(config: RunnerConfig): Promise<
  ((markdown: string | null) => BrainMeasurement) | null
> {
  try {
    const url = pathToFileURL(join(config.repoRoot, 'scripts', 'lib', 'brain-completeness.mjs')).href;
    const mod = (await import(url)) as { measureBrain: (md: string | null) => BrainMeasurement };
    return (markdown) => mod.measureBrain(markdown);
  } catch {
    return null;
  }
}

/**
 * Compute completeness. A missing COMPANY.md is `0` with every question listed as missing —
 * an honest empty state, which the spec prefers to a plausible fake one (Part VII.3).
 *
 * **The counter is the `<!-- UNANSWERED: Qn -->` markers, and nothing else.** It used to be
 * "does a section matching this topic's aliases contain ≥40 non-placeholder characters",
 * which scored a file with twenty untouched markers at 45% because it was reading the
 * template's *instructions* as the section's *answer* (`fidelity-qa-reviewer`, 2026-08-16).
 * Two heuristics on one file is one heuristic too many, and the markers are the only signal
 * in COMPANY.md a template cannot fabricate — the interview writes them, and the file's own
 * header forbids deleting one to look finished.
 *
 * The measurement itself lives in `scripts/lib/brain-completeness.mjs` so that this and
 * `scripts/build-graph.mjs` cannot disagree. They did, for a milestone, and the map showed
 * the disagreement as brightness (`comms/inbox/runner-engineer/…-one-brain-counter.md`).
 * If that module is unreachable, this reports **zero** — never a guess, and never a number
 * that could be higher than the truth.
 */
export async function computeBrainCompleteness(config: RunnerConfig): Promise<BrainCompleteness> {
  let markdown: string | null = null;
  try {
    markdown = await readFile(config.companyFile, 'utf8');
  } catch {
    markdown = null;
  }

  const [sources, measure] = await Promise.all([
    countSources(config.companySourcesDir),
    loadCounter(config),
  ]);

  const measurement = measure
    ? measure(markdown)
    : { value: 0, answered: 0, total: INTERVIEW_QUESTION_COUNT, unanswered: allQuestions() };

  if (markdown === null) {
    return { ...toCompleteness(measurement), sources, updatedAt: null };
  }

  let updatedAt = await lastCommitIso(config, 'company/COMPANY.md');
  if (updatedAt === null) {
    try {
      updatedAt = (await stat(config.companyFile)).mtime.toISOString();
    } catch {
      updatedAt = null;
    }
  }

  return { ...toCompleteness(measurement), sources, updatedAt };
}

/** The interview asks twenty questions; `Qn` is the marker namespace COMPANY.md uses. */
const INTERVIEW_QUESTION_COUNT = 20;
const allQuestions = (): number[] =>
  Array.from({ length: INTERVIEW_QUESTION_COUNT }, (_, i) => i + 1);

/**
 * `missing[]` is question labels (`"Q7"`), not topic keys.
 *
 * The old topic keys were a *different* twenty from the twenty the interview actually asks
 * (`INTERVIEW_TOPICS` has `positioning`, `competitors`, `proof`…; the SKILL asks about
 * identity, offers, ICP, pricing, voice, red lines, operations), so some of them could
 * never have been moved by answering the interview as written. A question number is also
 * findable: the drawer can say "Q7, Q8, Q9 outstanding" and a person can go read those
 * exact lines in COMPANY.md.
 */
function toCompleteness(m: BrainMeasurement): Omit<BrainCompleteness, 'sources' | 'updatedAt'> {
  return {
    value: m.value,
    answered: m.answered,
    total: m.total,
    missing: m.unanswered.map((n) => `Q${n}`),
  };
}

/** COMPANY.md, or `null` when the brain has not been written yet. */
export async function readCompanyBrain(config: RunnerConfig): Promise<string | null> {
  try {
    return await readFile(config.companyFile, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The one agent whose artifact is written back into `company/` (§3.3).
 *
 * A slug, not a frontmatter flag. A flag would let any SKILL.md grant itself brain-write
 * by adding a line — and SKILL.md files are exactly what an "import this agent from
 * GitHub" flow (Part IV) brings in from outside. A constant in the runner cannot be
 * granted by a file that arrives later.
 */
export const INTERVIEW_AGENT_SLUG = 'intelligence/company-interview';

export interface BrainWriteBack {
  /** Repo-relative path written. */
  path: string;
  commitSha: string;
  /** Completeness *after* the write — what the map should scale to now. */
  completeness: BrainCompleteness;
}

/**
 * Write the interview's artifact back to `company/COMPANY.md` and commit it (§3.3: "git
 * history is brain versioning").
 *
 * The agent itself never writes outside its scratch workspace. It produces `output.md`
 * like every other agent; the runner copies that out and commits it. So the capability to
 * change the file eleven other agents obey lives in the runner — behind `approval:
 * required`, which the interview's frontmatter declares — and not in a prompt.
 *
 * Returns `null` for every other agent, which is the common case and deliberately silent.
 */
/** Interview modes that are allowed to replace the brain. `review-gaps` reports; it never writes. */
const BRAIN_WRITING_MODES = new Set(['first-run', 'update-section']);

/**
 * Does this artifact look like COMPANY.md, or merely like a document the interview produced?
 *
 * Until 2026-08-16 those were the same test — "any `.md` over 40 characters" — and it was
 * unreachable only because the agent had no tool that could create a file. Closing that bug
 * (ADR-009, `wired_into: [workspace]`) opened this one: a `review-gaps` run, whose entire
 * job is to *report* which sections are thin, would have overwritten the brain with a
 * description of its own holes and committed that as the brain's new history.
 *
 * `agent-library-curator` closed it from the prompt side by telling the agent to write no
 * file in that mode. That is a sentence holding a boundary, which ADR-007 says explicitly
 * should not happen — and a filename trick would not have helped either, because
 * `extractArtifact` falls back to any single file with a known extension. So the check is
 * here, on the runner's side of the wire, where a prompt cannot argue with it.
 *
 * Two independent conditions, because either alone is too weak: the *mode the human chose*
 * must permit a write, and the artifact must *carry the brain's own structure*. The
 * structural test keys on the `<!-- UNANSWERED` marker namespace and the `## ` headings —
 * the same signal completeness is measured from, so a file that cannot be scored cannot be
 * installed either.
 */
function looksLikeTheBrain(markdown: string): boolean {
  const headings = (markdown.match(/^##\s+/gm) ?? []).length;
  const hasMarkerNamespace = /<!--\s*UNANSWERED/i.test(markdown);
  // A finished brain has no markers left, so markers cannot be *required*. Structure can.
  return headings >= 5 || (hasMarkerNamespace && headings >= 1);
}

export async function writeBackBrain(
  config: RunnerConfig,
  agentSlug: string,
  artifact: { absolutePath: string; kind: string } | null,
  inputs: Record<string, unknown> = {},
): Promise<BrainWriteBack | null> {
  if (agentSlug !== INTERVIEW_AGENT_SLUG) return null;
  if (!artifact || artifact.kind !== 'md') return null;

  // The mode the human picked in the drawer. Absent is treated as writing, because
  // `first-run` is the default path and the input is optional in frontmatter — but an
  // explicitly non-writing mode is refused outright.
  const mode = typeof inputs.mode === 'string' ? inputs.mode : 'first-run';
  if (!BRAIN_WRITING_MODES.has(mode)) return null;

  const markdown = await readFile(artifact.absolutePath, 'utf8');
  // An empty or near-empty artifact would silently erase the brain and, worse, would then
  // be committed as its new history. Refuse instead: the run still succeeded, and its
  // artifact is still downloadable for a human to look at.
  if (markdown.trim().length < MIN_ANSWER_CHARS) return null;
  if (!looksLikeTheBrain(markdown)) return null;

  await mkdir(dirname(config.companyFile), { recursive: true });
  await writeFile(config.companyFile, markdown, 'utf8');

  const completeness = await computeBrainCompleteness(config);
  const commitSha = await commitCompanyFile(
    config,
    config.companyFile,
    `brain: company interview — ${completeness.answered} of ${completeness.total} topics answered`,
  );

  return { path: 'company/COMPANY.md', commitSha, completeness };
}

/**
 * Snapshot `build-graph.mjs` reads as `company/.brain.json` when present.
 *
 * Not a git commit — the brain's version history is COMPANY.md, and this file is a cache
 * so layout rebuilds (`computeLayout` opts) and the watcher's live value share one
 * producer. GET `/api/graph` serves the stored artifact as-is — no brain overlay.
 */
export async function writeBrainSnapshot(
  config: RunnerConfig,
  completeness: BrainCompleteness,
): Promise<string> {
  const path = join(config.companyDir, '.brain.json');
  await mkdir(config.companyDir, { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        completeness: completeness.value,
        answered: completeness.answered,
        total: completeness.total,
        sources: completeness.sources,
        updatedAt: completeness.updatedAt,
        missing: completeness.missing,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return path;
}
