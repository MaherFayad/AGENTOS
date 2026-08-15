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
import { dirname } from 'node:path';
import type { BrainCompleteness } from '@agnetos/contracts';
import { commitCompanyFile, lastCommitIso } from './git';
import type { RunnerConfig } from './config';

export interface InterviewTopic {
  /** Stable key. Reported in `missing[]`, so the drawer can name what is still unanswered. */
  key: string;
  /** The question the interview agent asks (§3.3: "~20 questions"). */
  question: string;
  /** Lowercased heading fragments that count as this topic being addressed. */
  aliases: string[];
}

/**
 * The interview (§3.3). `agent-library-curator` authors
 * `agents/intelligence/company-interview/SKILL.md`; this list is the checklist that
 * agent's output is scored against, so the two must stay in step — if the interview asks
 * a question that is not here, answering it moves no bar, and completeness under-reports.
 */
export const INTERVIEW_TOPICS: readonly InterviewTopic[] = [
  { key: 'identity', question: 'What does the company do, in one paragraph?', aliases: ['what we do', 'identity', 'about', 'overview', 'company'] },
  { key: 'offers', question: 'What are the offers, and what does each include?', aliases: ['offers', 'services', 'products', 'packages'] },
  { key: 'icp', question: 'Who is the ideal customer, and who is explicitly not?', aliases: ['icp', 'ideal customer', 'audience', 'who we serve', 'segments'] },
  { key: 'pricing', question: 'What do things cost, and how is pricing structured?', aliases: ['pricing', 'price', 'rates', 'fees', 'commercials'] },
  { key: 'positioning', question: 'Why you and not the obvious alternative?', aliases: ['positioning', 'differentiation', 'why us', 'unique'] },
  { key: 'competitors', question: 'Who are the competitors and how do you talk about them?', aliases: ['competitors', 'competition', 'alternatives'] },
  { key: 'proof', question: 'What proof exists — results, case studies, names you may use?', aliases: ['proof', 'case studies', 'results', 'testimonials', 'clients'] },
  { key: 'objections', question: 'What objections come up, and what is the honest answer?', aliases: ['objections', 'faq', 'pushback', 'concerns'] },
  { key: 'tone', question: 'How does the company sound in English?', aliases: ['tone', 'voice', 'style', 'brand voice'] },
  { key: 'arabic-register', question: 'How does it sound in Arabic — MSA or dialect, and which register?', aliases: ['arabic', 'msa', 'عربي', 'arabic register', 'localisation', 'localization'] },
  { key: 'vocabulary', question: 'Words the company always uses, and words it never uses.', aliases: ['vocabulary', 'lexicon', 'banned words', 'terminology', 'glossary'] },
  { key: 'red-lines', question: 'Red lines: what must an agent never say, claim or promise?', aliases: ['red lines', 'never', 'prohibited', 'do not', 'guardrails'] },
  { key: 'pdpl', question: 'PDPL and data handling: what client data may agents touch?', aliases: ['pdpl', 'data handling', 'privacy', 'compliance', 'gdpr'] },
  { key: 'approvals', question: 'What must a human approve before it leaves the building?', aliases: ['approval', 'approvals', 'sign-off', 'review'] },
  { key: 'markets', question: 'Which markets, languages and geographies?', aliases: ['markets', 'geography', 'regions', 'languages', 'countries'] },
  { key: 'channels', question: 'Which channels do you sell and deliver through?', aliases: ['channels', 'distribution', 'platforms'] },
  { key: 'sales-process', question: 'What happens between first contact and signature?', aliases: ['sales process', 'pipeline', 'funnel', 'deal flow'] },
  { key: 'delivery', question: 'What happens between signature and delivery?', aliases: ['delivery', 'onboarding', 'fulfilment', 'fulfillment', 'operations'] },
  { key: 'team', question: 'Who is on the team and who owns what?', aliases: ['team', 'roles', 'people', 'org'] },
  { key: 'stack', question: 'Which tools and systems hold the company’s data?', aliases: ['stack', 'tools', 'systems', 'integrations', 'crm'] },
];

/** Placeholder shapes that must not count as an answer. */
const PLACEHOLDER = /^(tbd|tba|todo|n\/a|na|\?+|-+|_+|\.\.\.|<[^>]*>|\[[^\]]*\])$/i;

/** Minimum non-placeholder characters before a section counts as answered. */
const MIN_ANSWER_CHARS = 40;

interface Section {
  title: string;
  content: string;
}

/** Split markdown into `## heading` sections. Text before the first heading is `intro`. */
function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: 'intro', content: '' };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      sections.push(current);
      current = { title: (heading[1] ?? '').trim(), content: '' };
      continue;
    }
    current.content += `${line}\n`;
  }
  sections.push(current);
  return sections;
}

function isAnswered(section: Section): boolean {
  const meaningful = section.content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*>\s]+/, '').trim())
    // A line that is only a placeholder is not an answer, however long the section is.
    .filter((line) => line !== '' && !PLACEHOLDER.test(line))
    .join(' ');
  return meaningful.length >= MIN_ANSWER_CHARS;
}

function matchesTopic(topic: InterviewTopic, title: string): boolean {
  const normalised = title.toLowerCase();
  return topic.aliases.some((alias) => normalised.includes(alias));
}

async function countSources(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

/**
 * Compute completeness. A missing COMPANY.md is `0` with every topic listed as missing —
 * an honest empty state, which the spec prefers to a plausible fake one (Part VII.3).
 */
export async function computeBrainCompleteness(config: RunnerConfig): Promise<BrainCompleteness> {
  const total = INTERVIEW_TOPICS.length;
  let markdown: string | null = null;
  try {
    markdown = await readFile(config.companyFile, 'utf8');
  } catch {
    markdown = null;
  }

  const sources = await countSources(config.companySourcesDir);

  if (markdown === null) {
    return {
      value: 0,
      answered: 0,
      total,
      sources,
      updatedAt: null,
      missing: INTERVIEW_TOPICS.map((t) => t.key),
    };
  }

  const sections = splitSections(markdown).filter((section) => isAnswered(section));
  const missing: string[] = [];
  let answered = 0;

  for (const topic of INTERVIEW_TOPICS) {
    const hit = sections.some((section) => matchesTopic(topic, section.title));
    if (hit) answered += 1;
    else missing.push(topic.key);
  }

  let updatedAt = await lastCommitIso(config, 'company/COMPANY.md');
  if (updatedAt === null) {
    try {
      updatedAt = (await stat(config.companyFile)).mtime.toISOString();
    } catch {
      updatedAt = null;
    }
  }

  return {
    // Rounded to 3dp: enough resolution for a particle count, not enough to imply a
    // precision this measurement does not have.
    value: Math.round((answered / total) * 1000) / 1000,
    answered,
    total,
    sources,
    updatedAt,
    missing,
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
export async function writeBackBrain(
  config: RunnerConfig,
  agentSlug: string,
  artifact: { absolutePath: string; kind: string } | null,
): Promise<BrainWriteBack | null> {
  if (agentSlug !== INTERVIEW_AGENT_SLUG) return null;
  if (!artifact || artifact.kind !== 'md') return null;

  const markdown = await readFile(artifact.absolutePath, 'utf8');
  // An empty or near-empty artifact would silently erase the brain and, worse, would then
  // be committed as its new history. Refuse instead: the run still succeeded, and its
  // artifact is still downloadable for a human to look at.
  if (markdown.trim().length < MIN_ANSWER_CHARS) return null;

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
