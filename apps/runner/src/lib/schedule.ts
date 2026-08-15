/**
 * `POST /api/schedule` (§3.2) — frontmatter commit, then ofelia sync.
 *
 * The whole design is one sentence from the contract: **"A job that exists in ofelia but
 * not in frontmatter is a bug, never a state to reconcile."**
 *
 * That forces the order of operations and it forces what this module refuses to have.
 * There is no schedule table, no cache, and no in-memory copy of a cron expression. The
 * sequence is:
 *
 *   validate cron  →  edit the SKILL.md line  →  git commit  →  poke ofelia
 *
 * Validation before the commit, because a committed schedule ofelia will not load turns
 * the map's clock badge into a promise nothing keeps. The commit before the sync, because
 * ofelia regenerates its jobs *from* frontmatter — so a failed sync leaves the system
 * stale (`ofeliaSynced:false`) rather than wrong, and re-running the sync is always safe.
 */
import { readFile, writeFile } from 'node:fs/promises';
import type { ScheduleRequest, ScheduleResponse } from '@agnetos/contracts';
import { badRequest } from './errors';
import type { RunnerConfig } from './config';
import { loadAgent, listAgents } from './agents';
import { setScheduleInSource } from './frontmatter';
import { nextRunAt, parseCron } from './cron';
import { commitAgentFile } from './git';
import { syncOfelia } from './ofelia';

export interface ScheduleLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/** One scheduled agent, as ofelia's config generator should see it. */
export interface ScheduledAgent {
  agent: string;
  name: string;
  cron: string;
  nextRunAt: string | null;
}

/**
 * Every schedule the library declares, read fresh from frontmatter.
 *
 * Exported for `infra-compose-engineer`: this is the *only* supported input to ofelia's
 * job generation. Generating jobs from anything else — a database, a cached list, an
 * operator's memory — is how ofelia ends up holding a job frontmatter has never heard of.
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
    out.push({ agent: record.slug, name: record.name, cron: record.schedule, nextRunAt: next });
  }
  return out;
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

  const sync = await syncOfelia(config);
  if (!sync.synced) {
    logger?.warn({ agent: slug, reason: sync.reason }, 'schedule committed but ofelia was not reloaded');
  } else {
    logger?.info({ agent: slug, cron }, 'schedule committed and ofelia reloaded');
  }

  return {
    ok: true,
    agent: slug,
    cron,
    commitSha,
    // Computed from the expression, not from ofelia. The badge on the map and this field
    // therefore agree by construction; asking ofelia would introduce a second answer.
    nextRunAt: cron === null ? null : nextRunAt(cron),
    ofeliaSynced: sync.synced,
  };
}

/** Re-export so route code has one import for the schedule surface. */
export { nextRunAt, parseCron };
