/**
 * The scheduling plane's HTTP surface — M18 wave 2, `comms/contracts/scheduling.md` §13.
 *
 * Owner: `scheduler-engineer`. Registered from `api.ts` in one line so the six handlers live
 * beside the contract that argues them rather than inside `runner-engineer`'s route file.
 *
 * ## The one rule this file exists to enforce
 *
 * **Never save an unpreviewed cron expression** (`Plan §14`). `POST …/schedules` recomputes the
 * `previewToken` from the trigger it was *actually sent* and refuses `schedule_preview_stale`
 * (409) on a mismatch. That is the whole mechanism behind the word "confirm": a dialog that
 * previewed Mondays, a field edited before the button, and a schedule that fires monthly under a
 * confirmation screen that said weekly is an ordinary bug, and it is the one cron expressions
 * produce most often.
 *
 * It is **not** a security boundary (BOARD rule 6 — build nothing that is only safe because
 * something else is). Anyone on the tailnet can compute a token. What it cannot do is compute
 * one for times that were never on screen, because the server derives the times itself.
 *
 * ## What is honest about this surface today
 *
 * - **Nothing here starts a run.** `POST …/schedules/:id/fire` records a `pending` fire row and
 *   says so in its response; there is no executor, and `runner-engineer` owns the one that will
 *   be. A route that returned "started" would be the house defect on the surface where believing
 *   it costs money.
 * - **Five of the six need a database that has never existed.** `0011` has never been applied,
 *   so they answer `thread_store_unavailable` (503) rather than degrading. `requireThreadStore`'s
 *   reasoning applies unchanged: an in-memory schedule is a promise that vanishes on the next
 *   deploy while looking exactly like one that persisted.
 * - **`…/schedules/preview` needs nothing** and works on this stack today. It is deliberately the
 *   one that does, because it is the one the save is not allowed to skip.
 * - **No money figure is served by any of them** (§2 invariant 7). The budget preview is all
 *   `null` with a stated reason per field.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  RUNNER_ROUTES,
  assertScheduleAddressable,
  fireTimePreviewToken,
  parseThreadAddress,
  scheduleCost,
  scheduleFiresAreExact,
  MISSED_RUN_POLICIES,
  OVERLAP_POLICIES,
  TRIGGER_KINDS,
  type CreateScheduleRequest,
  type CreateScheduleResponse,
  type FireTimePreview,
  type MissedRunPolicy,
  type OverlapPolicy,
  type ResolvedThreadAddress,
  type ScheduleBudgetPreview,
  type ScheduleFiresResponse,
  type ScheduleNextFire,
  type SchedulePreviewRequest,
  type ScheduleTriggerInput,
  type ScheduleView,
  type SchedulesResponse,
  type ScheduleZoneIntent,
  type TriggerKind,
  type UpdateScheduleRequest,
} from '@agnetos/contracts';
import { ApiError, badRequest } from '../lib/errors.ts';
import { resolveAddress, requireThreadStore } from '../lib/threadService.ts';
import { resolveProject, type MountedProject } from '../lib/project.ts';
import {
  insertSchedule,
  listFires,
  listSchedules,
  readSchedule,
  recordFire,
  scheduleTargetOf,
  updateSchedule,
  type ScheduleRecord,
} from '../db/schedules.ts';
import {
  formatWallClock,
  occurrencesInWindow,
  previewFireTimes,
  type ComputableTrigger,
} from '../lib/scheduleClock.ts';
import { sendApiError } from './http.ts';
import type { ApiContext } from './api.ts';

/* -------------------------------------------------------------------------- *
 * Reading a body without believing it
 * -------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The refusal for a missing mandatory field, and **the hint deliberately does not suggest a
 * value** (`scheduling.md` §8).
 *
 * That restraint is the whole point of the six columns with no `DEFAULT`. `skip` silently loses a
 * briefing; `catch_up_all` silently spends four figures on a laptop that slept a week. A hint
 * reading *"try `skip`"* is a default wearing a sentence — it would let a caller that never
 * considered the question look exactly like one that did, which is the failure the missing
 * DEFAULT exists to prevent.
 */
function policyMissing(field: string, options?: readonly string[]): ApiError {
  return new ApiError('schedule_policy_missing', `A schedule needs ${field}.`, {
    hint: options
      ? `Choose one of: ${options.join(', ')}. There is no default, because the wrong one is silent in both directions — one loses a briefing, the other spends the night catching up.`
      : 'This field has no default. Decide it for this schedule rather than inheriting one.',
    retryable: false,
  });
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') throw policyMissing(field);
  return value;
}

function requireBoolean(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') throw policyMissing(field);
  return value;
}

function requireInteger(body: Record<string, unknown>, field: string, min: number, max: number): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw policyMissing(`${field} (a whole number between ${min} and ${max})`);
  }
  return value;
}

function requireOneOf<T extends string>(
  body: Record<string, unknown>,
  field: string,
  vocabulary: readonly T[],
): T {
  const value = body[field];
  if (typeof value !== 'string' || !(vocabulary as readonly string[]).includes(value)) {
    throw policyMissing(field, vocabulary);
  }
  return value as T;
}

/** `trigger: { kind, spec }`, with `spec` an object because `trigger_spec` is one (PDPL rule 2). */
function readTrigger(value: unknown): ScheduleTriggerInput {
  if (!isObject(value)) throw policyMissing('trigger');
  const kind = value['kind'];
  if (typeof kind !== 'string' || !(TRIGGER_KINDS as readonly string[]).includes(kind)) {
    throw policyMissing('trigger.kind', TRIGGER_KINDS);
  }
  const spec = value['spec'];
  if (!isObject(spec)) {
    throw badRequest(
      'A trigger spec has to be an object.',
      'Send {"kind":"cron","spec":{"expression":"0 7 * * 1-5"}}. It is stored as JSON and never as a sentence, because an event filter is somebody\'s correspondence and prose defeats key-based redaction.',
    );
  }
  return { kind: kind as TriggerKind, spec };
}

/**
 * The two trigger kinds a clock can answer for, as `scheduleClock` wants them. `null` for the
 * other four — `event`, `condition` and `chain` fire on the world and `manual` fires on a person.
 */
function computableTriggerOf(trigger: ScheduleTriggerInput): ComputableTrigger | null {
  if (trigger.kind === 'cron') {
    const expression = trigger.spec['expression'];
    if (typeof expression !== 'string' || expression.trim() === '') {
      throw badRequest('A cron trigger needs an expression.', 'For example {"expression":"0 7 * * 1-5"}.');
    }
    return { kind: 'cron', expression };
  }
  if (trigger.kind === 'interval') {
    const everySeconds = trigger.spec['everySeconds'];
    const anchor = trigger.spec['anchor'];
    if (typeof everySeconds !== 'number' || !Number.isFinite(everySeconds) || everySeconds <= 0) {
      throw badRequest('An interval needs a positive period.', 'everySeconds is how long to wait between fires.');
    }
    if (typeof anchor !== 'string' || !Number.isFinite(Date.parse(anchor))) {
      // No default and never `now`: an anchor of "whenever the coordinator happened to start"
      // makes every occurrence move on every restart, and `occurrence_time` is the idempotency
      // key — a key that moves is not a key.
      throw policyMissing('trigger.spec.anchor (the instant the interval counts from, ISO-8601)');
    }
    return { kind: 'interval', everySeconds, anchor };
  }
  return null;
}

function zoneIntentOf(tz: string, followMe: boolean, standingIn: string | null): ScheduleZoneIntent {
  return followMe ? { tz, followMe: true, standingIn } : { tz, followMe: false };
}

/* -------------------------------------------------------------------------- *
 * Next fire — and the three different reasons there may not be one
 * -------------------------------------------------------------------------- */

/**
 * **`unknown` is not `zero`.** A dash printed for a Gmail trigger, for a follow-me schedule with
 * no zone signal, and for a schedule whose occurrences have run out would be one claim about
 * three different situations, and the one that matters most — *nobody can compute this* — is the
 * one that would disappear.
 */
function nextFireOf(schedule: ScheduleRecord, from: Date): ScheduleNextFire {
  let trigger: ComputableTrigger | null;
  try {
    trigger = computableTriggerOf({ kind: schedule.triggerKind, spec: schedule.triggerSpec });
  } catch {
    // A stored trigger whose spec does not parse is a library problem, not a reason to fail the
    // whole listing — `scheduledAgents` takes the same position on an unparseable cron.
    return { at: null, because: 'not-clockable' };
  }
  if (trigger === null) return { at: null, because: 'not-clockable' };
  if (schedule.followMe) return { at: null, because: 'zone-unresolved' };

  const untilMs = schedule.untilAt === null ? null : Date.parse(schedule.untilAt);
  let scan;
  try {
    scan = occurrencesInWindow(trigger, schedule.tz, {
      after: from,
      through: untilMs !== null && Number.isFinite(untilMs) ? new Date(untilMs) : null,
      max: 1,
    });
  } catch {
    return { at: null, because: 'not-clockable' };
  }
  const first = scan.occurrences[0];
  if (!first) return { at: null, because: 'no-further-occurrence' };
  return {
    at: first.toISOString(),
    local: formatWallClock(wallClockOf(schedule.tz, first)),
  };
}

/** The instant as wall clock in a zone. Thin, so the route never formats a date by hand. */
function wallClockOf(tz: string, instant: Date): {
  year: number; month: number; day: number; hour: number; minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return {
    year: read('year'), month: read('month'), day: read('day'),
    hour: read('hour'), minute: read('minute'),
  };
}

const toView = (record: ScheduleRecord, from: Date): ScheduleView => ({
  ...record,
  nextFire: nextFireOf(record, from),
});

/* -------------------------------------------------------------------------- *
 * The budget preview — every figure null, each with its own reason
 * -------------------------------------------------------------------------- */

/**
 * Occurrences in the next 30 days, capped.
 *
 * The cap is what keeps the projection honest rather than fast: a `* * * * *` schedule fires
 * 43,200 times a month, and a scan that stopped at the cap and reported its partial count as a
 * total would be a plausible number on the one surface where numbers get multiplied. Hitting the
 * cap sets `firesAreExact: false`, so the figure is labelled a lower bound.
 */
const MONTHLY_FIRE_CAP = 10_000;
const THIRTY_DAYS_MS = 30 * 86_400_000;

function firesPerMonth(
  kind: TriggerKind,
  trigger: ComputableTrigger | null,
  tz: string,
  followMe: boolean,
  from: Date,
): { fires: number; exact: boolean } {
  // `scheduleFiresAreExact` is the one place the two-of-six mapping lives, and it is consulted
  // rather than re-derived from `trigger === null` — two copies of that denominator would agree
  // until somebody added a seventh trigger kind. A follow-me schedule is inexact for a different
  // reason: it can be placed in no zone at all today. Both are *zero occurrences computable*,
  // never *zero occurrences*.
  if (!scheduleFiresAreExact(kind) || trigger === null || followMe) return { fires: 0, exact: false };
  try {
    const scan = occurrencesInWindow(trigger, tz, {
      after: from,
      through: new Date(from.getTime() + THIRTY_DAYS_MS),
      max: MONTHLY_FIRE_CAP,
    });
    return {
      fires: scan.occurrences.length,
      exact: scan.complete && scan.occurrences.length < MONTHLY_FIRE_CAP,
    };
  } catch {
    return { fires: 0, exact: false };
  }
}

/**
 * `Plan §14`: *"before you save, show projected monthly spend for this schedule and the
 * project's total scheduled burn against `budget_monthly`."*
 *
 * Built in full, and **every money figure in it is `null`** — see `ScheduleBudgetPreview`. The
 * fire counts are real and derived from the triggers; the money has no source, because zero runs
 * have ever completed, and `ops.project.budget_monthly` has never been read by anything
 * (`project.ts:261` returns `budgetMonthlyUsd: null` unconditionally).
 *
 * A surface that rendered this must not read as though a cap is protecting the user. It is not.
 */
function budgetPreviewFor(
  address: ResolvedThreadAddress,
  thisKind: TriggerKind,
  thisTrigger: ComputableTrigger | null,
  thisTz: string,
  thisFollowMe: boolean,
  siblings: readonly ScheduleRecord[],
  from: Date,
): ScheduleBudgetPreview {
  const mine = firesPerMonth(thisKind, thisTrigger, thisTz, thisFollowMe, from);

  let total = mine.fires;
  let exact = mine.exact;
  for (const sibling of siblings) {
    if (!sibling.enabled) continue;
    let trigger: ComputableTrigger | null = null;
    try {
      trigger = computableTriggerOf({ kind: sibling.triggerKind, spec: sibling.triggerSpec });
    } catch {
      trigger = null;
    }
    const scan = firesPerMonth(sibling.triggerKind, trigger, sibling.tz, sibling.followMe, from);
    total += scan.fires;
    exact = exact && scan.exact;
  }

  return {
    thisSchedule: scheduleCost(address, mine.fires, mine.exact),
    projectScheduledFiresPerMonth: total,
    projectFiresAreExact: exact,
    projectedMonthlyUsd: null,
    capUsd: null,
    capBasis: 'ops.project.budget_monthly is declared and never read',
    enforced: false,
  };
}

/* -------------------------------------------------------------------------- *
 * The routes
 * -------------------------------------------------------------------------- */

const idParam = (request: FastifyRequest): string => {
  const id = (request.params as { id?: string }).id;
  if (!id) throw badRequest('A schedule id is required.');
  return id;
};

const notFound = (): ApiError =>
  new ApiError('schedule_not_found', 'No such schedule in this project.', {
    // Opaque across projects, exactly as `run_not_found` is. A distinguishable refusal would
    // confirm that an id is real somewhere else.
    hint: 'Check the project in the path. A schedule id means nothing outside the project that owns it.',
    retryable: false,
  });

export function registerScheduleRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const projectOf = (request: FastifyRequest): MountedProject =>
    resolveProject(ctx.services.config, (request.params as { project?: string }).project);

  const dbOf = () => requireThreadStore(ctx.ledger.current()?.db ?? null);

  /* ---- 1. The preview. Writes nothing, needs no database, and is the one that works ---- */

  app.post(RUNNER_ROUTES.schedulePreview.path, async (request, reply) => {
    try {
      projectOf(request);
      const body = (request.body ?? {}) as SchedulePreviewRequest;
      if (!isObject(body)) throw badRequest('A preview needs a trigger, a zone and an intent.');

      const trigger = readTrigger((body as Record<string, unknown>)['trigger']);
      const computable = computableTriggerOf(trigger);
      if (computable === null) {
        // Refused rather than answered with an empty list. An empty preview reads as *this fires
        // nothing*; the true statement is *no clock can say when this fires*.
        throw new ApiError(
          'schedule_trigger_not_computable',
          `A ${trigger.kind} trigger has no occurrence a clock can compute.`,
          {
            hint: `${trigger.kind} fires on ${trigger.kind === 'manual' ? 'a person' : 'the world'}, so there is no next time to show. Two of the six triggers have one: cron and interval.`,
            retryable: false,
          },
        );
      }

      const tz = requireString(body as unknown as Record<string, unknown>, 'tz');
      const followMe = requireBoolean(body as unknown as Record<string, unknown>, 'followMe');
      const preview: FireTimePreview = previewFireTimes({
        trigger: computable,
        zone: zoneIntentOf(tz, followMe, body.standingIn ?? null),
        from: new Date(),
      });
      return preview;
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /* ---- 2. Create an `ops` row. The previewToken is recomputed here, not trusted ---- */

  app.post(RUNNER_ROUTES.scheduleCreate.path, async (request, reply) => {
    try {
      const project = projectOf(request);
      const raw = (request.body ?? {}) as Record<string, unknown>;
      if (!isObject(raw)) throw badRequest('A schedule needs a body.');
      const body = raw as unknown as CreateScheduleRequest;

      /**
       * **Everything that can be refused without touching anything is refused first, and this
       * route deliberately differs from `POST …/thread` in that.**
       *
       * The thread route calls `requireThreadStore` before it reads the body, and that is right
       * for it: a well-formed request that cannot be stored should say so. Here the order is
       * inverted, for two reasons that only apply to this route.
       *
       * The first is honest triage. A stale preview is the caller's to fix and a missing database
       * is not, and a 503 that hides a `schedule_preview_stale` sends the person back to a dialog
       * that will fail again for a reason nobody told them about.
       *
       * The second is the one that decided it: **`Plan §14`'s rule is the single thing M18 must
       * be able to demonstrate today.** `0011` has never met a Postgres, so a refusal reachable
       * only through a live database is a refusal nobody in this repo has ever seen — and *never
       * save an unpreviewed cron expression* would be a sentence in a contract rather than a
       * mechanism with a test. It is falsifiable on this stack because it happens here.
       *
       * Nothing is written before `insertSchedule` either way, which is the property the thread
       * route's ordering was actually protecting.
       */

      /* -- the target, refused before the database is reached -- */
      const line = typeof raw['line'] === 'string' ? raw['line'] : '';
      const parsed = parseThreadAddress(line);
      if (!parsed.ok) {
        throw new ApiError('address_malformed', `"${parsed.refusal.token}" is not an address.`, {
          hint: parsed.refusal.hint,
          retryable: false,
        });
      }
      const { address } = await resolveAddress(ctx.services.config, project, parsed.address);
      // §3.4: `@@` and a session are legal in the grammar and unstorable here, with a stated
      // reason and a code — a schedule fires unattended with nobody to read an interactive
      // refusal.
      assertScheduleAddressable(address);
      const target = scheduleTargetOf(address);

      /* -- every mandatory column, each refused by name and with no suggested value -- */
      const trigger = readTrigger(raw['trigger']);
      const computable = computableTriggerOf(trigger);
      const tz = requireString(raw, 'tz');
      const followMe = requireBoolean(raw, 'followMe');
      const jitterSeconds = requireInteger(raw, 'jitterSeconds', 0, 3600);
      const missedRunPolicy = requireOneOf<MissedRunPolicy>(raw, 'missedRunPolicy', MISSED_RUN_POLICIES);
      const overlapPolicy = requireOneOf<OverlapPolicy>(raw, 'overlapPolicy', OVERLAP_POLICIES);
      const enabled = requireBoolean(raw, 'enabled');
      const autoDisableAfter = requireInteger(raw, 'autoDisableAfter', 1, 1000);
      const reviewAt = requireString(raw, 'reviewAt');

      /* -- Plan §14: never save an unpreviewed cron expression -- */
      if (computable !== null) {
        const supplied = raw['previewToken'];
        if (typeof supplied !== 'string' || supplied === '') {
          throw new ApiError(
            'schedule_preview_stale',
            'This schedule has not been previewed.',
            {
              hint: 'Ask for the next ten fire times first and send the receipt back with the save. Cron expressions are quietly wrong more often than they are loudly wrong.',
              retryable: false,
            },
          );
        }
        // Recomputed from the trigger that actually arrived, never from what the client said it
        // previewed. A token echoed from a stale dialog is exactly the bug this catches.
        const recomputed = previewFireTimes({
          trigger: computable,
          zone: zoneIntentOf(tz, followMe, body.standingIn ?? null),
          from: new Date(),
        });
        const expected = fireTimePreviewToken({
          expression: recomputed.expression,
          tz: recomputed.tz,
          followMe: recomputed.followMe,
          fireTimes: recomputed.fireTimes,
        });
        if (supplied !== expected) {
          throw new ApiError(
            'schedule_preview_stale',
            'The times this schedule would fire are not the ones that were confirmed.',
            {
              hint: `It now fires ${recomputed.fireTimes.map((t) => t.local).slice(0, 3).join(', ')} and onwards, in ${recomputed.tz}. Look at the new times and confirm again.`,
              retryable: false,
            },
          );
        }
      }

      // Only now does this need a database, and it refuses rather than degrading — an
      // in-memory schedule is a timer that vanishes on the next deploy while looking exactly
      // like one that persisted.
      const db = dbOf();

      const { id } = await insertSchedule(db, {
        source: 'ops',
        projectId: project.id,
        triggerKind: trigger.kind,
        triggerSpec: trigger.spec,
        kind: target.kind,
        delivery: target.delivery,
        addressedTo: target.addressedTo,
        tz,
        followMe,
        jitterSeconds,
        missedRunPolicy,
        overlapPolicy,
        enabled,
        autoDisableAfter,
        reviewAt,
        untilAt: typeof raw['untilAt'] === 'string' ? (raw['untilAt'] as string) : null,
        disabledReason: typeof raw['disabledReason'] === 'string' ? (raw['disabledReason'] as string) : null,
        // `human:unattributed` — there is no auth in v1 (BOARD rule 6) and inventing an identity
        // here would be a declared value read as an observed one.
        createdBy: 'human:unattributed',
      });

      const now = new Date();
      const saved = await readSchedule(db, project.id, id);
      if (!saved) throw notFound();
      const siblings = (await listSchedules(db, project.id)).filter((s) => s.id !== id);

      const response: CreateScheduleResponse = {
        schedule: toView(saved, now),
        budget: budgetPreviewFor(address, trigger.kind, computable, tz, followMe, siblings, now),
      };
      return response;
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /* ---- 3. The list, with the library half reported rather than left to be inferred ---- */

  app.get(RUNNER_ROUTES.schedules.path, async (request, reply) => {
    try {
      const project = projectOf(request);
      const db = dbOf();
      const now = new Date();
      const response: SchedulesResponse = {
        schedules: (await listSchedules(db, project.id)).map((record) => toView(record, now)),
        library: {
          materialized: 0,
          possibleToday: false,
          reason: 'frontmatter schedule: carries a cron and nothing else',
        },
      };
      return response;
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /* ---- 4. PATCH. A library row is 409: it is edited by PR ---- */

  app.patch(RUNNER_ROUTES.scheduleUpdate.path, async (request, reply) => {
    try {
      const project = projectOf(request);
      const db = dbOf();
      const id = idParam(request);
      const existing = await readSchedule(db, project.id, id);
      if (!existing) throw notFound();
      if (existing.source === 'library') {
        throw new ApiError(
          'schedule_read_only',
          'This schedule comes from an agent\'s frontmatter and is edited by pull request.',
          {
            hint: `Change schedule: in ${existing.libraryRef ?? 'the agent\'s SKILL.md'} and commit it. Editing it here would create a schedule the library does not know about.`,
            retryable: false,
          },
        );
      }

      const raw = (request.body ?? {}) as Record<string, unknown>;
      const patch = raw as unknown as UpdateScheduleRequest;

      // `schedule_disabled_names_a_reason`, checked at the edge so the caller gets the sentence
      // rather than a constraint name. A disabled schedule with no reason is indistinguishable
      // from one somebody turned off on purpose.
      const willBeEnabled = patch.enabled !== undefined ? patch.enabled : existing.enabled;
      const reason = patch.disabledReason !== undefined ? patch.disabledReason : existing.disabledReason;
      if (!willBeEnabled && (reason === null || reason.trim() === '')) {
        throw policyMissing('disabledReason (turning a schedule off requires saying why)');
      }
      if (patch.missedRunPolicy !== undefined) {
        requireOneOf<MissedRunPolicy>(raw, 'missedRunPolicy', MISSED_RUN_POLICIES);
      }
      if (patch.overlapPolicy !== undefined) {
        requireOneOf<OverlapPolicy>(raw, 'overlapPolicy', OVERLAP_POLICIES);
      }
      if (patch.jitterSeconds !== undefined) requireInteger(raw, 'jitterSeconds', 0, 3600);
      if (patch.autoDisableAfter !== undefined) requireInteger(raw, 'autoDisableAfter', 1, 1000);

      const updated = await updateSchedule(db, project.id, id, patch);
      if (!updated) throw notFound();
      return { schedule: toView(updated, new Date()) };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /* ---- 5. The fire ledger for one schedule. Newest first. No money field ---- */

  app.get(RUNNER_ROUTES.scheduleFires.path, async (request, reply) => {
    try {
      const project = projectOf(request);
      const db = dbOf();
      const id = idParam(request);
      // Read the schedule first so an id from another project is `schedule_not_found` rather than
      // an empty ledger, which would read as *this schedule has never fired*.
      const schedule = await readSchedule(db, project.id, id);
      if (!schedule) throw notFound();
      const query = request.query as { limit?: string };
      const limit = query.limit === undefined ? undefined : Number.parseInt(query.limit, 10);
      const response: ScheduleFiresResponse = {
        scheduleId: id,
        fires: await listFires(db, project.id, id, Number.isFinite(limit) ? (limit as number) : 100),
      };
      return response;
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /* ---- 6. Fire now, out of band — recorded before anything runs, like every other path ---- */

  app.post(RUNNER_ROUTES.scheduleFireNow.path, async (request, reply) => {
    try {
      const project = projectOf(request);
      const db = dbOf();
      const id = idParam(request);
      const schedule = await readSchedule(db, project.id, id);
      if (!schedule) throw notFound();

      // Truncated to the minute, because `occurrence_time` is the idempotency key and two taps in
      // the same minute are one intent. Two rows a second apart would be two paid runs that
      // `schedule_fire_idempotent` cannot catch, because they are genuinely different keys — the
      // fall-back-hour argument, arriving through a button instead of through a clock.
      const occurrence = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
      const fire = await recordFire(db, {
        scheduleId: id,
        projectId: project.id,
        occurrenceTime: occurrence,
        catchUp: false,
      });

      return {
        fireId: fire.id,
        occurrenceTime: occurrence,
        recorded: fire.recorded,
        /**
         * **Nothing was started, and the response says so rather than implying it.** There is no
         * executor in this build; `runner-engineer` owns the one that will read `pending` rows
         * and start runs. A route that answered `started: true` would be the house defect on the
         * surface where believing it costs money.
         */
        started: false,
        startedBecause: 'no executor exists — the fire is recorded and nothing reads it yet',
      };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });
}

export type { FastifyReply };
