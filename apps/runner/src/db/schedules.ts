/**
 * The write and read path for `ops.schedule` and `ops.schedule_fire` (ADR-024, `Plan §14`,
 * `comms/contracts/scheduling.md` §3–§4).
 *
 * Owner: `scheduler-engineer`. **The schema and its only writer are one change**, and this file
 * exists because M15 proved what happens when they are two: migration 0005 made four columns
 * NOT NULL on `ops.agent_runs`, `ledger.ts` named none of them, and the first real run would
 * have been paid for and then failed to record. `writer-schema-agreement.test.ts` is extended in
 * the same commit that adds these statements, so the seventeen mandatory columns of `0011` are
 * checked against the insert with no database at all.
 *
 * ## Three properties worth reading before changing anything here
 *
 * 1. **The authority is a type, not a convention.** `0011`'s
 *    `schedule_library_ref_matches_source` says `library_ref` is present *exactly when*
 *    `source = 'library'`. `ScheduleAuthority` below is a discriminated union that makes the
 *    other two combinations unconstructible, so the constraint is satisfied at compile time and
 *    Postgres is the second line rather than the first. It is also why `insertSchedule` cannot
 *    be handed `source: 'library'` without a `libraryRef` by a route that forgot — and why a
 *    route cannot pass `source` from a request body at all.
 * 2. **The fire row is written before the run, and the row-local CHECKs run here first.**
 *    `assertFireRowValid` is called on the row this file is about to insert. `0011` has never
 *    met a live Postgres (§9.2), so today those CHECKs are enforced here or nowhere; when a
 *    database arrives they are enforced twice, which is the right number for the constraint that
 *    makes "never fired" visible.
 * 3. **Every read is `WHERE project_id = $1` on the statement that finds the row, not after
 *    it.** RLS is inert on this stack (compose connects as the owner, `thread-model.md` §8b), so
 *    the scoping that actually holds is this clause and the composite foreign keys. A read that
 *    found the row and then checked whose it was would be a lookup-then-scope route one layer
 *    down.
 *
 * ## What this file has never done
 *
 * **Executed.** `0011` has never been applied to a live Postgres and `DATABASE_URL` is unset on
 * this stack, so every statement below is text that agrees with other text. That is a lower
 * bound on correctness and it is stated rather than implied.
 */

import { randomUUID } from 'node:crypto';
import {
  SCHEDULE_FIRE_BIRTH_STATE,
  assertFireRowValid,
  assertFireTransition,
  canonicalAddressedTo,
  type MissedRunPolicy,
  type OverlapPolicy,
  type ResolvedThreadAddress,
  type ScheduleDelivery,
  type ScheduleFireState,
  type ScheduleFireView,
  type ScheduleThreadKind,
  type ScheduleView,
  type TriggerKind,
} from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';

/* -------------------------------------------------------------------------- *
 * The target — `thread-model.md` §3's grammar, narrowed to what is storable
 * -------------------------------------------------------------------------- */

/**
 * `kind` and `delivery` for a schedulable address.
 *
 * `fan-out` and `session` are absent from the return type rather than mapped to something, so a
 * caller that skipped `assertScheduleAddressable` gets a compile error instead of a row Postgres
 * will refuse at 03:00 with nobody watching. The pairs are exactly
 * `schedule_delivery_matches_kind`.
 */
export function scheduleTargetOf(
  address: ResolvedThreadAddress,
): { kind: ScheduleThreadKind; delivery: ScheduleDelivery; addressedTo: string } {
  switch (address.form) {
    case 'direct':
      return { kind: 'agent', delivery: 'direct', addressedTo: canonicalAddressedTo(address) };
    case 'dispatch':
      return { kind: 'department', delivery: 'dispatch', addressedTo: canonicalAddressedTo(address) };
    case 'default':
      return { kind: 'project', delivery: 'default', addressedTo: canonicalAddressedTo(address) };
    case 'fan-out':
      // Unreachable through `assertScheduleAddressable`, and a throw rather than a fallthrough
      // because the fallthrough would be a `@@` schedule stored as something else.
      throw Object.assign(new Error('A fan-out address is not storable as a schedule.'), {
        code: 'schedule_address_not_schedulable',
        hint: `Schedule the department lead with #${address.department}, or one agent with @.`,
      });
  }
}

/* -------------------------------------------------------------------------- *
 * ops.schedule
 * -------------------------------------------------------------------------- */

/**
 * One table, two authorities (`Plan §14`), as a union rather than as two nullable fields.
 *
 * **No `library` value is constructible by any caller in this repo today** and that is not
 * enforced here — it is enforced by there being nothing that can supply the four policy fields
 * from frontmatter (§3.3). The union exists so that when a materializer is finally written, the
 * pairing constraint is one the compiler has already checked.
 */
export type ScheduleAuthority =
  | { source: 'ops'; libraryRef?: undefined }
  | { source: 'library'; libraryRef: string };

/**
 * Every column the insert names. **The mandatory ones are required properties with no defaults**
 * — the same decision `0011` made by giving them no `DEFAULT`, restated where a writer's author
 * meets it. `skip` silently loses a briefing and `catch_up_all` silently spends four figures on
 * a laptop that slept a week; the two failures point in opposite directions, so there is no
 * value that is safe to assume on anyone's behalf.
 */
export type InsertScheduleInput = ScheduleAuthority & {
  projectId: string;
  triggerKind: TriggerKind;
  /** An object, never prose (`schedule_trigger_spec_is_object`, PDPL rule 2). */
  triggerSpec: Record<string, unknown>;
  kind: ScheduleThreadKind;
  delivery: ScheduleDelivery;
  addressedTo: string;
  tz: string;
  followMe: boolean;
  jitterSeconds: number;
  missedRunPolicy: MissedRunPolicy;
  overlapPolicy: OverlapPolicy;
  enabled: boolean;
  autoDisableAfter: number;
  reviewAt: string;
  untilAt: string | null;
  disabledReason: string | null;
  createdBy: string;
};

/**
 * The columns selected by every read below, in one place so two readers cannot drift into
 * disagreeing about what a schedule is.
 */
const SCHEDULE_COLUMNS = `
  id, source, library_ref, trigger_kind, trigger_spec, kind, delivery, addressed_to,
  tz, follow_me, jitter_seconds, missed_run_policy, overlap_policy, enabled,
  auto_disable_after, consecutive_failures, disabled_reason, until_at, review_at,
  created_by, created_at`;

export async function insertSchedule(db: DbClient, input: InsertScheduleInput): Promise<{ id: string }> {
  const id = randomUUID();

  // Generated here rather than by a column DEFAULT, so a log line about a failed insert can name
  // the schedule that failed. An id that only exists if the write succeeded cannot appear in the
  // message explaining why the write did not — `createThread`'s reasoning, unchanged.

  // `schedule_disabled_names_a_reason`, checked before the statement is built. A disabled
  // schedule with no reason is indistinguishable from one somebody turned off on purpose, which
  // is how thirty failed nights stay invisible (detail 7).
  if (!input.enabled && (input.disabledReason === null || input.disabledReason.trim() === '')) {
    throw Object.assign(new Error('A disabled schedule has to say why.'), {
      code: 'schedule_policy_missing',
      hint: 'Give a reason a person reading the list in three months will understand.',
    });
  }

  await db.query(
    `INSERT INTO ops.schedule (
       id, project_id, source, library_ref, trigger_kind, trigger_spec,
       kind, delivery, addressed_to,
       tz, follow_me, jitter_seconds, missed_run_policy, overlap_policy,
       enabled, auto_disable_after, disabled_reason,
       until_at, review_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      id,
      input.projectId,
      input.source,
      input.libraryRef ?? null,
      input.triggerKind,
      JSON.stringify(input.triggerSpec),
      input.kind,
      input.delivery,
      input.addressedTo,
      input.tz,
      input.followMe,
      input.jitterSeconds,
      input.missedRunPolicy,
      input.overlapPolicy,
      input.enabled,
      input.autoDisableAfter,
      input.disabledReason,
      input.untilAt,
      input.reviewAt,
      input.createdBy,
    ],
  );

  return { id };
}

/** The row shape the two readers return. `nextFire` is added by the route, which owns the clock. */
export type ScheduleRecord = Omit<ScheduleView, 'nextFire'>;

interface ScheduleDbRow {
  id: string;
  source: string;
  library_ref: string | null;
  trigger_kind: string;
  trigger_spec: unknown;
  kind: string;
  delivery: string;
  addressed_to: string;
  tz: string;
  follow_me: boolean;
  jitter_seconds: number;
  missed_run_policy: string;
  overlap_policy: string;
  enabled: boolean;
  auto_disable_after: number;
  consecutive_failures: number;
  disabled_reason: string | null;
  until_at: Date | string | null;
  review_at: Date | string;
  created_by: string;
  created_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : iso(value));

function toScheduleRecord(row: ScheduleDbRow): ScheduleRecord {
  return {
    id: row.id,
    source: row.source as ScheduleRecord['source'],
    libraryRef: row.library_ref,
    triggerKind: row.trigger_kind as TriggerKind,
    // `jsonb` arrives parsed from `pg`; a string would mean a driver that did not, and an object
    // is what `schedule_trigger_spec_is_object` guarantees on the way in.
    triggerSpec:
      typeof row.trigger_spec === 'string'
        ? (JSON.parse(row.trigger_spec) as Record<string, unknown>)
        : ((row.trigger_spec ?? {}) as Record<string, unknown>),
    kind: row.kind as ScheduleThreadKind,
    delivery: row.delivery as ScheduleDelivery,
    addressedTo: row.addressed_to,
    tz: row.tz,
    followMe: row.follow_me,
    jitterSeconds: row.jitter_seconds,
    missedRunPolicy: row.missed_run_policy as MissedRunPolicy,
    overlapPolicy: row.overlap_policy as OverlapPolicy,
    enabled: row.enabled,
    autoDisableAfter: row.auto_disable_after,
    consecutiveFailures: row.consecutive_failures,
    disabledReason: row.disabled_reason,
    untilAt: isoOrNull(row.until_at),
    reviewAt: iso(row.review_at),
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

export async function listSchedules(db: DbClient, projectId: string): Promise<ScheduleRecord[]> {
  const { rows } = await db.query<ScheduleDbRow>(
    `SELECT ${SCHEDULE_COLUMNS} FROM ops.schedule WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return rows.map(toScheduleRecord);
}

/**
 * One schedule **in this project's scope**. `null` for a schedule that belongs to another
 * project, exactly as for one that does not exist — the route turns both into
 * `schedule_not_found` (404), and the opacity is the point: a distinguishable 403 would confirm
 * the id is real somewhere else.
 */
export async function readSchedule(
  db: DbClient,
  projectId: string,
  id: string,
): Promise<ScheduleRecord | null> {
  const { rows } = await db.query<ScheduleDbRow>(
    `SELECT ${SCHEDULE_COLUMNS} FROM ops.schedule WHERE id = $1 AND project_id = $2`,
    [id, projectId],
  );
  const row = rows[0];
  return row ? toScheduleRecord(row) : null;
}

export interface UpdateScheduleInput {
  enabled?: boolean;
  disabledReason?: string | null;
  untilAt?: string | null;
  reviewAt?: string;
  missedRunPolicy?: MissedRunPolicy;
  overlapPolicy?: OverlapPolicy;
  jitterSeconds?: number;
  autoDisableAfter?: number;
}

/**
 * A partial update, project-pinned in the `WHERE`.
 *
 * **`source` is not updatable and neither is the target.** Changing which agent a schedule fires
 * is not an edit, it is a different schedule — and letting an `ops` row become a `library` one
 * would let the app claim an authority that belongs to a commit.
 */
export async function updateSchedule(
  db: DbClient,
  projectId: string,
  id: string,
  patch: UpdateScheduleInput,
): Promise<ScheduleRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, projectId];
  const push = (column: string, value: unknown): void => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.enabled !== undefined) push('enabled', patch.enabled);
  if (patch.disabledReason !== undefined) push('disabled_reason', patch.disabledReason);
  if (patch.untilAt !== undefined) push('until_at', patch.untilAt);
  if (patch.reviewAt !== undefined) push('review_at', patch.reviewAt);
  if (patch.missedRunPolicy !== undefined) push('missed_run_policy', patch.missedRunPolicy);
  if (patch.overlapPolicy !== undefined) push('overlap_policy', patch.overlapPolicy);
  if (patch.jitterSeconds !== undefined) push('jitter_seconds', patch.jitterSeconds);
  if (patch.autoDisableAfter !== undefined) push('auto_disable_after', patch.autoDisableAfter);

  if (sets.length === 0) return readSchedule(db, projectId, id);

  const { rows } = await db.query<ScheduleDbRow>(
    `UPDATE ops.schedule SET ${sets.join(', ')}
      WHERE id = $1 AND project_id = $2
      RETURNING ${SCHEDULE_COLUMNS}`,
    params,
  );
  const row = rows[0];
  return row ? toScheduleRecord(row) : null;
}

/* -------------------------------------------------------------------------- *
 * ops.schedule_fire — the row exists before the run does
 * -------------------------------------------------------------------------- */

const FIRE_COLUMNS = `
  id, schedule_id, occurrence_time, state, catch_up, attempts,
  recorded_at, started_at, ended_at, thread_id, refusal_code, question_message_id`;

export interface RecordFireInput {
  scheduleId: string;
  projectId: string;
  /** The **scheduled** instant, never the actual one. This is half the idempotency key. */
  occurrenceTime: string;
  /** No default: a catch-up storm reading as normal traffic is a graph that lies. */
  catchUp: boolean;
}

/**
 * `Plan §14` detail 1 — **the row is written at the occurrence time, in `pending`, before
 * anything runs.**
 *
 * Fire-then-record makes *"never fired"* invisible, which is precisely the failure most worth
 * seeing: a coordinator that dies between deciding and starting leaves nothing at all to look at.
 * `schedule_fire_recorded_before_run` is the database's half; `assertFireRowValid` below is the
 * half that works today, because `0011` has never been applied.
 *
 * **`ON CONFLICT DO NOTHING` on the idempotency key, and the empty result is the answer.**
 * Detail 2 calls a double-fire on restart *"the single most common scheduler bug in existence"*.
 * A coordinator that restarts and re-derives the same window hits `schedule_fire_idempotent`
 * here; returning `{ recorded: false }` rather than throwing is what makes a restart *ordinary*
 * instead of an error a caller has to special-case — and a caller that special-cases an error is
 * a caller that will one day swallow it and start the run anyway.
 */
export async function recordFire(db: DbClient, input: RecordFireInput): Promise<{ id: string; recorded: boolean }> {
  const id = randomUUID();
  const recordedAt = new Date().toISOString();

  assertFireRowValid({
    scheduleId: input.scheduleId,
    projectId: input.projectId,
    occurrenceTime: input.occurrenceTime,
    state: SCHEDULE_FIRE_BIRTH_STATE,
    catchUp: input.catchUp,
    attempts: 0,
    recordedAt,
    startedAt: null,
    endedAt: null,
    threadId: null,
    refusalCode: null,
    questionMessageId: null,
  });

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO ops.schedule_fire (
       id, schedule_id, project_id, occurrence_time, state, catch_up
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (schedule_id, occurrence_time) DO NOTHING
     RETURNING id`,
    [id, input.scheduleId, input.projectId, input.occurrenceTime, SCHEDULE_FIRE_BIRTH_STATE, input.catchUp],
  );

  const row = rows[0];
  return row ? { id: row.id, recorded: true } : { id, recorded: false };
}

interface FireDbRow {
  id: string;
  schedule_id: string;
  occurrence_time: Date | string;
  state: string;
  catch_up: boolean;
  attempts: number;
  recorded_at: Date | string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  thread_id: string | null;
  refusal_code: string | null;
  question_message_id: string | null;
}

const toFireView = (row: FireDbRow): ScheduleFireView => ({
  id: row.id,
  scheduleId: row.schedule_id,
  occurrenceTime: iso(row.occurrence_time),
  state: row.state as ScheduleFireState,
  catchUp: row.catch_up,
  attempts: row.attempts,
  recordedAt: iso(row.recorded_at),
  startedAt: isoOrNull(row.started_at),
  endedAt: isoOrNull(row.ended_at),
  threadId: row.thread_id,
  refusalCode: row.refusal_code,
  questionMessageId: row.question_message_id,
});

/** One schedule's ledger, newest first. Project-pinned in the statement, not after it. */
export async function listFires(
  db: DbClient,
  projectId: string,
  scheduleId: string,
  limit = 100,
): Promise<ScheduleFireView[]> {
  const { rows } = await db.query<FireDbRow>(
    `SELECT ${FIRE_COLUMNS} FROM ops.schedule_fire
      WHERE project_id = $1 AND schedule_id = $2
      ORDER BY occurrence_time DESC
      LIMIT $3`,
    [projectId, scheduleId, Math.max(1, Math.min(limit, 500))],
  );
  return rows.map(toFireView);
}

export interface AdvanceFireInput {
  projectId: string;
  fireId: string;
  to: ScheduleFireState;
  startedAt?: string | null;
  endedAt?: string | null;
  threadId?: string | null;
  refusalCode?: string | null;
  questionMessageId?: string | null;
  /** Detail 7's retry ladder increments this on the **existing** row. */
  attempts?: number;
}

/**
 * Move a fire, refusing an illegal move **before** the statement is built.
 *
 * `schedule_fire_state_known` proves a value is in the vocabulary and says nothing about the
 * move: a writer can take a `done` row back to `pending` and every CHECK in `0011` passes. So
 * the rule has an enforcer here, as `assertThreadTransition` does one table over. `null` back
 * means the row is not this project's — the same opacity as `readSchedule`.
 */
export async function advanceFire(db: DbClient, input: AdvanceFireInput): Promise<ScheduleFireView | null> {
  const { rows: current } = await db.query<FireDbRow>(
    `SELECT ${FIRE_COLUMNS} FROM ops.schedule_fire WHERE id = $1 AND project_id = $2`,
    [input.fireId, input.projectId],
  );
  const before = current[0];
  if (!before) return null;

  const attemptsAfter = input.attempts ?? before.attempts;
  assertFireTransition({
    from: before.state as ScheduleFireState,
    to: input.to,
    attemptsBefore: before.attempts,
    attemptsAfter,
  });

  const next: ScheduleFireView = {
    ...toFireView(before),
    state: input.to,
    attempts: attemptsAfter,
    startedAt: input.startedAt !== undefined ? input.startedAt : isoOrNull(before.started_at),
    endedAt: input.endedAt !== undefined ? input.endedAt : isoOrNull(before.ended_at),
    threadId: input.threadId !== undefined ? input.threadId : before.thread_id,
    refusalCode: input.refusalCode !== undefined ? input.refusalCode : before.refusal_code,
    questionMessageId:
      input.questionMessageId !== undefined ? input.questionMessageId : before.question_message_id,
  };

  // Every row-local CHECK in `0011`, run against the row this is about to become. Today they are
  // enforced here or nowhere.
  assertFireRowValid({ ...next, projectId: input.projectId });

  const { rows } = await db.query<FireDbRow>(
    `UPDATE ops.schedule_fire
        SET state = $3, attempts = $4, started_at = $5, ended_at = $6,
            thread_id = $7, refusal_code = $8, question_message_id = $9
      WHERE id = $1 AND project_id = $2
      RETURNING ${FIRE_COLUMNS}`,
    [
      input.fireId,
      input.projectId,
      next.state,
      next.attempts,
      next.startedAt,
      next.endedAt,
      next.threadId,
      next.refusalCode,
      next.questionMessageId,
    ],
  );
  const row = rows[0];
  return row ? toFireView(row) : null;
}
