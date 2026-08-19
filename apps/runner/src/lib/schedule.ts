/**
 * `POST /api/schedule` (§3.2) — a frontmatter commit, and nothing else.
 *
 * The whole design used to be one sentence from the contract: *"A job that exists in the cron
 * sidecar but not in frontmatter is a bug, never a state to reconcile."* The sidecar left
 * `infra/compose.yaml` at `e4e0bff` (ADR-024) and the sentence outlived it, which is how this
 * module ended up in the state a review failed M18 for. The sequence today is:
 *
 *   validate cron  →  edit the SKILL.md line  →  git commit  →  say plainly that nothing fires
 *
 * There is still no schedule table, no cache and no in-memory copy of a cron expression:
 * frontmatter is the source of truth and the map's clock badge reads the file.
 *
 * ## The defect this file is now shaped to prevent
 *
 * Before this change the response was `ok: true` with `nextRunAt` computed from the
 * expression and a since-removed `ofeliaSynced: false` logged at `warn`. Every field was true.
 * Together they told a person *"Saved. Next run 2026-08-20T06:00:00Z."* on a stack with no
 * executor — a declared value read as an observed one (BOARD rule 9), on the only
 * user-visible surface M18 touched, and it succeeded silently rather than erroring.
 *
 * The fix is not a shorter sentence in the drawer. It is that `ScheduleResponse` no longer has
 * a field a client can mistake for a promise: `firedBy` says who will act (`'nobody'`),
 * `nextMatchAt` says when the *expression matches* and says so in its name, and
 * `executionNote` is a server-authored sentence so every client tells the same truth.
 * `executionNote` comes from an exhaustive switch over `ScheduleFiredBy`, so the day an
 * executor is added the compiler stops this file until the sentence is updated with it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import type { ScheduleFiredBy, ScheduleRequest, ScheduleResponse } from '@agnetos/contracts';
import { badRequest } from './errors';
import type { RunnerConfig } from './config';
import { loadAgent, listAgents } from './agents';
import { setScheduleInSource } from './frontmatter';
import { nextRunAt, parseCron } from './cron';
import { commitAgentFile } from './git';

export interface ScheduleLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/** One agent that declares a schedule, and when its expression next matches. */
export interface ScheduledAgent {
  agent: string;
  name: string;
  cron: string;
  /** Next match of the expression, not a scheduled execution — see `ScheduleResponse`. */
  nextMatchAt: string | null;
}

/**
 * Every schedule the library declares, read fresh from frontmatter.
 *
 * **Nothing consumes this today.** Its consumer was the cron sidecar's config generator, which
 * was deleted with the sidecar at `e4e0bff`; it is kept because the rule it enforces outlived
 * both — any future executor reads schedules from frontmatter and from nowhere else. Generating
 * jobs from a database, a cached list or an operator's memory is how a scheduler ends up holding
 * a job frontmatter has never heard of.
 */
export async function scheduledAgents(config: RunnerConfig): Promise<ScheduledAgent[]> {
  const records = await listAgents(config);
  const out: ScheduledAgent[] = [];
  for (const record of records) {
    if (record.schedule === null) continue;
    let next: string | null = null;
    try {
      next = nextRunAt(record.schedule);
    } catch {
      // An unparseable cron already in a file is a library problem, not a reason to fail
      // the whole listing. It is reported as scheduled-with-unknown-next, so a human sees
      // the row and its missing time rather than losing the row entirely.
      next = null;
    }
    out.push({ agent: record.slug, name: record.name, cron: record.schedule, nextMatchAt: next });
  }
  return out;
}

/**
 * **The one place this build states who fires a schedule, and it is nobody.**
 *
 * Not a default and not a fallback — an observation about this checkout. Grep it before you
 * change it: there is no timer anywhere in `apps/runner/src` that reaches `startRun`, the cron
 * sidecar was deleted at `e4e0bff`, and `routes/schedules.ts` records fire *rows* without
 * starting anything (its own header says so). An executor is a code change, and this constant
 * is the line that change has to cross.
 */
const FIRED_BY: ScheduleFiredBy = 'nobody';

/**
 * The sentence a person reads, owned by the server so every client says the same thing.
 *
 * The `switch` is exhaustive on purpose. `ScheduleFiredBy` is a one-member union today; the day
 * someone adds `'coordinator'`, `tsc` fails **here**, on the sentence, rather than letting a
 * true-again mechanism ship under wording that still says nothing happens. That is the inverse
 * of the defect being fixed — there, a boolean flipped to `false` under a field name that kept
 * promising — and it is why this is a switch and not a template string.
 */
function executionNote(
  firedBy: ScheduleFiredBy,
  cron: string | null,
  nextMatchAt: string | null,
): string {
  switch (firedBy) {
    case 'nobody':
      if (cron === null) {
        return 'Removed from the agent’s file and committed. It was not running on a timer before this either — nothing in this build fires schedules.';
      }
      return nextMatchAt === null
        ? 'Saved to the agent’s file and committed. Nothing in this build fires schedules, and this expression matches no date in the next four years — run the agent yourself when you need it.'
        : `Saved to the agent’s file and committed. Nothing in this build fires schedules, so no run will start at ${nextMatchAt} or at any other time — run the agent yourself when you need it.`;
    default: {
      // Unreachable while the union has one member. If you are reading this because the
      // compiler sent you, the schedule now has an executor: write its sentence above, and
      // check `ScheduleResponse.nextMatchAt`'s doc comment still tells the truth.
      const impossible: never = firedBy;
      throw new Error(`unhandled schedule executor: ${String(impossible)}`);
    }
  }
}

export async function setSchedule(
  config: RunnerConfig,
  request: ScheduleRequest,
  logger?: ScheduleLogger,
): Promise<ScheduleResponse> {
  if (typeof request?.agent !== 'string' || request.agent.trim() === '') {
    throw badRequest(
      'A schedule needs an agent.',
      'Send {"agent": "department/agent-slug", "cron": "0 6 * * 1"} — or cron:null to unschedule.',
    );
  }
  if (request.cron !== null && typeof request.cron !== 'string') {
    throw badRequest(
      'cron must be a 5-field expression or null.',
      'Use null to remove a schedule. Omitting the field entirely is not the same thing, so it is refused.',
    );
  }

  const slug = request.agent.trim();
  const record = await loadAgent(config, slug);

  // Validate first. `parseCron` throws `invalid_cron` (400) with a hint naming the field
  // that is wrong — before anything is written, so a bad expression costs nothing.
  const cron = request.cron === null ? null : parseCron(request.cron).expression;

  const source = await readFile(record.absolutePath, 'utf8');
  const updated = setScheduleInSource(source, cron);

  if (updated !== source) {
    await writeFile(record.absolutePath, updated, 'utf8');
  }

  // `commitAgentFile` re-checks the path against `agents/**` (ADR-002) even though the
  // slug regex already made escaping impossible. Two independent gates on the one write
  // path a request body can reach.
  const commitSha = await commitAgentFile(
    config,
    record.absolutePath,
    cron === null
      ? `chore(agents): unschedule ${slug}`
      : `chore(agents): schedule ${slug} at "${cron}"`,
  );

  const nextMatchAt = cron === null ? null : nextRunAt(cron);

  logger?.info(
    { agent: slug, cron, firedBy: FIRED_BY, nextMatchAt },
    cron === null
      ? 'schedule removed from frontmatter and committed'
      : 'schedule committed to frontmatter; nothing in this build will fire it',
  );

  return {
    ok: true,
    agent: slug,
    cron,
    commitSha,
    firedBy: FIRED_BY,
    // Computed from the expression by the same function behind the map's clock badge, so the
    // two agree by construction. It answers "when does this cron next match", which is not the
    // same question as "when will this run" — see `executionNote`, and see the field's name.
    nextMatchAt,
    executionNote: executionNote(FIRED_BY, cron, nextMatchAt),
  };
}

/** Re-export so route code has one import for the schedule surface. */
export { nextRunAt, parseCron };
