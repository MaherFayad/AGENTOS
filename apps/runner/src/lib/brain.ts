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
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { agentRef as makeAgentRef, type BrainCompleteness } from '@agnetos/contracts';
import { ApiError } from './errors';
import { commitCompanyFile, lastCommitIso, repoRelative } from './git';
import type { RunnerConfig } from './config';
import type { MountedProject } from './project';

/**
 * A **tier** of the brain: one `company/` directory and the file inside it.
 *
 * `company/COMPANY.md` rule 9 splits the brain in two under N projects — a **global** tier
 * holding facts about *us*, injected into every run of every project, and a **project**
 * tier holding facts about *that client*. Every function below takes the tier it is about
 * rather than reading one path out of `RunnerConfig`, because "one path in the config" is
 * exactly the shape that makes project two's interview overwrite project one's brain.
 *
 * Both `RunnerConfig` and `MountedProject` satisfy this structurally, so the coordinator's
 * own tier (`GET /api/status`, the watcher) keeps working unchanged while the run pipeline
 * passes the mounted project.
 */
export interface BrainTier {
  companyDir: string;
  companyFile: string;
  companySourcesDir: string;
}

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
export async function computeBrainCompleteness(
  config: RunnerConfig,
  tier: BrainTier = config,
): Promise<BrainCompleteness> {
  let markdown: string | null = null;
  try {
    markdown = await readFile(tier.companyFile, 'utf8');
  } catch {
    markdown = null;
  }

  const [sources, measure] = await Promise.all([
    countSources(tier.companySourcesDir),
    loadCounter(config),
  ]);

  const measurement = measure
    ? measure(markdown)
    : { value: 0, answered: 0, total: INTERVIEW_QUESTION_COUNT, unanswered: allQuestions() };

  if (markdown === null) {
    return { ...toCompleteness(measurement), sources, updatedAt: null };
  }

  // The pathspec is derived from the tier, not written out as `company/COMPANY.md`. A
  // literal here would date the *coordinator's* brain onto every project's number the day a
  // second library is mounted — an "updated 3 days ago" about somebody else's file.
  let updatedAt = await lastCommitIso(config, repoRelative(config, tier.companyFile));
  if (updatedAt === null) {
    try {
      updatedAt = (await stat(tier.companyFile)).mtime.toISOString();
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

/**
 * COMPANY.md for one tier, or `null` when that tier's brain has not been written yet.
 *
 * The run pipeline passes the **mounted project**, never the coordinator's config: §3.3
 * injects this into every invocation, so a tier resolved from the wrong place is client A's
 * company context reaching an agent running for client B on every single call, with no
 * error message. There is deliberately **no global fallback** — `project-scoping.md` Q8b is
 * still open and the conservative side of an unanswered question is the one that cannot
 * leak (adding a fallback later is additive; removing one after the fact is not).
 */
export async function readCompanyBrain(tier: BrainTier): Promise<string | null> {
  try {
    return await readFile(tier.companyFile, 'utf8');
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
 *
 * **It is half a key, not a key.** `department/slug` is identical in every project under
 * the cascade, so this constant answers "is this the interview?" and cannot answer "whose
 * interview?". `brainWriteRef` is what the gate actually compares against.
 */
export const INTERVIEW_AGENT_SLUG = 'intelligence/company-interview';

/**
 * The one `agent_ref` allowed to replace **this project's** brain:
 * `{project}/intelligence/company-interview` (ADR-014 §2).
 *
 * This is the write-path consequence `company/COMPANY.md` rule 9 spells out, made into a
 * mechanism. The gate used to be `agentSlug !== INTERVIEW_AGENT_SLUG` against a single
 * configured `companyFile`, and **both halves were project-blind**: every project has an
 * `intelligence/company-interview`, and `config.companyFile` is one path. At N=2 that is
 * not a display bug — project two's interview overwrites project one's brain and the commit
 * that follows enshrines the overwrite as the brain's new history, on a file §3.3 injects
 * into every subsequent run of the project it just destroyed.
 *
 * Deriving the permitted ref *from the project being written to* is what makes the two
 * facts one fact: there is no pair of arguments for which the agent named and the file
 * written can disagree about the project.
 */
export function brainWriteRef(project: MountedProject): string {
  return makeAgentRef(project.slug, INTERVIEW_AGENT_SLUG);
}

/** `<global>` — the root of the configured global library, or `null` when there is none. */
function globalLibraryRoot(config: RunnerConfig): string | null {
  // `config.globalLibraryDir` is `<global>/agents`; the tier we must protect is its sibling
  // `<global>/company`. Guarding the whole root rather than that one directory is
  // deliberate: it costs nothing and it does not have to be re-reasoned if the global
  // library ever grows a second copy-bearing folder.
  return config.globalLibraryDir === null ? null : dirname(config.globalLibraryDir);
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

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
  project: MountedProject,
  agentRef: string,
  artifact: { absolutePath: string; kind: string } | null,
  inputs: Record<string, unknown> = {},
): Promise<BrainWriteBack | null> {
  // Keyed on the `agent_ref`, and the ref is derived from the project whose file is about
  // to be written. `intelligence/company-interview` running for project B therefore cannot
  // reach project A's brain: not because a caller remembered to check, but because the only
  // ref that passes is the one this project's own interview carries.
  if (agentRef !== brainWriteRef(project)) return null;
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

  /**
   * The global tier is refused outright, and loudly.
   *
   * COMPANY.md rule 9: the global tier holds facts about *us* and is injected into every
   * run of **every** project, "which is precisely why nothing client-identifying may ever
   * be written into it". The interview is a client-facing agent. A client's ICP, pricing or
   * red line written there is a breach of PDPL rule 4 on every subsequent invocation for
   * every other client, with no code defect required and no error message.
   *
   * This throws rather than returning `null` like the other refusals. `null` is the right
   * answer for the common, legitimate cases — a different agent, the wrong mode, a document
   * that is not a brain. This one is never legitimate, and a silent `null` here would look
   * exactly like "the interview produced nothing", which is the sentence that stops anyone
   * looking.
   */
  const globalRoot = globalLibraryRoot(config);
  if (globalRoot !== null && isInside(globalRoot, project.companyFile)) {
    // `git_write_refused` — the runner's existing write-boundary code, reused rather than
    // invented. A `brain_write_refused` code would read better and would be an edit to
    // `ApiErrorCode` in `packages/contracts`, which is `runner-engineer`'s under
    // `api-contracts.md`. It is proposed to them as a decision-request; it is not taken here.
    throw new ApiError(
      'git_write_refused',
      'The company interview may not write the global tier of the brain.',
      {
        hint:
          `Nothing was written. ${project.companyFile} is inside the global library at ${globalRoot}, and ` +
          'the global tier (COMPANY.md sections 5 and 7) is injected into every run of every project — a ' +
          "client's facts written there reach every other client on every invocation (company/COMPANY.md " +
          'rule 9, Part VII.4). The interview writes its own project tier and nothing else.',
        retryable: false,
      },
    );
  }

  await mkdir(dirname(project.companyFile), { recursive: true });
  await writeFile(project.companyFile, markdown, 'utf8');

  const completeness = await computeBrainCompleteness(config, project);
  const commitSha = await commitCompanyFile(
    config,
    project.companyFile,
    `brain(${project.slug}): company interview — ${completeness.answered} of ${completeness.total} topics answered`,
  );

  // The path that was actually written, not a literal. `company/COMPANY.md` was true of the
  // one mount and would have been a quiet lie about any other.
  return { path: repoRelative(config, project.companyFile), commitSha, completeness };
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
  tier: BrainTier = config,
): Promise<string> {
  const path = join(tier.companyDir, '.brain.json');
  await mkdir(tier.companyDir, { recursive: true });
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
