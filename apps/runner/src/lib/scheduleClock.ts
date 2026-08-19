/**
 * Occurrence computation — `scheduler-engineer`, ADR-024, `Plan §14`, `contracts/scheduling.md` §6.
 *
 * **This module answers one question: when is this schedule next due, in the zone its author
 * declared?** It starts nothing, writes nothing and reads no database. It is the input to the
 * fire ledger, not a participant in it.
 *
 * ## Why this is not `nextRunAt` in `./cron`
 *
 * `nextRunAt` computes in **UTC only** — it reads `getUTCHours()` against the expression and has
 * no `tz` parameter at all. That was correct for what it serves: ofelia ran on one host, in that
 * host's zone, and the badge on the map only had to agree with ofelia. Under ADR-024 the
 * coordinator fires for N hosts across N zones, and `Plan §14` detail 6 makes the zone a declared
 * per-schedule intent. A 07:00 briefing on `Asia/Riyadh` computed in UTC fires at 10:00 local,
 * every day, looking correct in every view — which is exactly the class of quietly-wrong the
 * plan's *"never save an unpreviewed cron expression"* exists to catch.
 *
 * The field parser is **shared, not forked**: `parseCron` is imported. Two cron parsers that
 * disagree about `0 6 1 * 1` is a defect this repo has the shape of already. And
 * `schedule-clock.test.ts` asserts that for `tz: 'UTC'` this module and `nextRunAt` produce the
 * same instants, so the two cannot drift apart while both exist.
 *
 * ## What it does about the two days a year that are not 24 hours long
 *
 * Both cases are decisions, and both are surfaced rather than absorbed:
 *
 * - **Spring forward.** 02:30 does not exist on the day the clock jumps. There is no occurrence.
 *   The alternative — shifting to 03:00 — invents a time the author did not write.
 * - **Fall back.** 01:30 happens twice. The occurrence is the **earlier** instant, once. This one
 *   is load-bearing for detail 2: two instants are two different `occurrence_time` values, so
 *   they are two different idempotency keys, and `schedule_fire_idempotent` would not catch the
 *   second. The duplicate has to be prevented here or not at all.
 *
 * Both are counted and named in the preview, because a preview that is quietly one short is the
 * same failure as an expression that is quietly wrong.
 */
import {
  PREVIEW_FIRE_TIME_COUNT,
  fireTimePreviewToken,
  resolveFiringZone,
  type FireTimePreview,
  type PreviewedFireTime,
  type ScheduleZoneIntent,
  type TriggerKind,
} from '@agnetos/contracts';
import { parseCron } from './cron';

/* -------------------------------------------------------------------------- *
 * Zones — `Intl`, because the platform already ships the IANA database
 * -------------------------------------------------------------------------- */

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Throws `schedule_tz_unknown` for a zone the runtime's ICU does not carry — **and for the ones
 * it carries and quietly redirects.**
 *
 * That second clause is a finding, observed on this host with Node 22 while writing the test
 * below:
 *
 * ```
 * new Intl.DateTimeFormat('en-US', { timeZone: 'AST' }).resolvedOptions().timeZone
 * // → 'America/Anchorage'
 * new Intl.DateTimeFormat('en-US', { timeZone: 'EST' }).resolvedOptions().timeZone
 * // → 'America/Panama'
 * ```
 *
 * `AST` is what a person in Riyadh writes for Arabia Standard Time and what a person in Halifax
 * writes for Atlantic Standard Time. ICU hands back **Alaska**, with no error, and a 07:00
 * briefing then fires at 19:00 local, every day, looking correct in every view — the exact class
 * of quietly-wrong `Plan §14`'s preview requirement exists to catch, arriving one layer below the
 * preview where the preview would confirm it.
 *
 * So an accepted zone must be in IANA's `Area/Location` form, or be `UTC` exactly. `schedule_tz_present`
 * in `0011` only checks `length(tz) > 0`; this is where the real narrowing lives. It costs the
 * legacy single-word links (`Japan`, `Egypt`, `Zulu`), which have canonical two-part names, and it
 * buys the guarantee that a three-letter abbreviation is never silently resolved to a continent
 * the author has never been to.
 */
function formatterFor(tz: string): Intl.DateTimeFormat {
  const cached = formatters.get(tz);
  if (cached) return cached;
  if (!tz.includes('/') && tz.toUpperCase() !== 'UTC') {
    throw Object.assign(new Error(`"${tz}" is not an IANA zone name.`), {
      code: 'schedule_tz_unknown',
      hint: 'Write the zone as Area/Location — Asia/Riyadh, America/Halifax, Europe/London. A three-letter abbreviation is ambiguous: AST is both Arabia and Atlantic time, and this host resolves it to Alaska.',
    });
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (cause) {
    throw Object.assign(new Error(`"${tz}" is not a timezone this host knows.`), {
      code: 'schedule_tz_unknown',
      hint: 'Use an IANA zone name such as Asia/Riyadh or Europe/London. Abbreviations like AST are ambiguous and are not accepted.',
      cause,
    });
  }
  formatters.set(tz, formatter);
  return formatter;
}

function wallClockIn(tz: string, instant: Date): WallClock {
  const parts = formatterFor(tz).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number.parseInt(part.value, 10) : Number.NaN;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

/** The zone's UTC offset in milliseconds at a given instant. Positive east of Greenwich. */
function zoneOffsetMs(tz: string, instant: Date): number {
  const w = wallClockIn(tz, instant);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const flooredToMinute = Math.floor(instant.getTime() / 60_000) * 60_000;
  return asIfUtc - flooredToMinute;
}

/**
 * Every UTC instant that renders as this wall clock in this zone.
 *
 * Returns **zero** entries for a time the zone skipped, **two** for one it repeated, **one**
 * otherwise. Returning a list rather than a `Date` is the whole point: a function that had to
 * return one value would have to invent one on the days there is no answer, or pick silently on
 * the days there are two.
 *
 * Every candidate is kept only if it renders **back** to the wall clock that was asked for, which
 * is what makes a skipped time come back empty instead of coming back plausible.
 *
 * The probe set is the part that had to be got right, and the first version was wrong: a pure
 * fixed-point iteration (guess with one offset, re-read the offset at the guess, repeat)
 * **converges immediately on a fall-back day and finds only the first instant**, because the
 * offset it reads at 01:30 is still the summer one and the answer it produces is already
 * self-consistent. The second instant is never probed and the ambiguity is invisible. So the
 * offsets are sampled a day either side as well: any transition adjacent to the wall clock is
 * then in the candidate set, and the round-trip filter discards whatever does not belong.
 */
export function instantsForWallClock(tz: string, wall: WallClock): Date[] {
  const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const DAY = 86_400_000;
  const offsets = new Set<number>();
  for (const probe of [asIfUtc - DAY, asIfUtc, asIfUtc + DAY]) {
    offsets.add(zoneOffsetMs(tz, new Date(probe)));
  }
  const candidates = new Set<number>();
  for (const offset of offsets) candidates.add(asIfUtc - offset);
  return [...candidates]
    .sort((a, b) => a - b)
    .filter((t) => {
      const back = wallClockIn(tz, new Date(t));
      return (
        back.year === wall.year &&
        back.month === wall.month &&
        back.day === wall.day &&
        back.hour === wall.hour &&
        back.minute === wall.minute
      );
    })
    .map((t) => new Date(t));
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** `2026-08-18T07:00` — wall clock, no offset, because a wall clock does not have one. */
export function formatWallClock(w: WallClock): string {
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/* -------------------------------------------------------------------------- *
 * Trigger specs this module can answer for — and the four it refuses to
 * -------------------------------------------------------------------------- */

export type ComputableTrigger =
  | { kind: 'cron'; expression: string }
  | {
      kind: 'interval';
      everySeconds: number;
      /**
       * The instant the interval counts from. **No default, and never `now`.**
       *
       * An anchor of "whenever the coordinator happened to start" makes every occurrence move on
       * every restart — and `occurrence_time` is the idempotency key, so a key that moves is not
       * a key. `schedule_fire_idempotent` would let the same work run twice under two different
       * keys and be entirely correct in doing so. The anchor is stored in `trigger_spec` and it
       * is a fact about the schedule, not about the process.
       */
      anchor: string;
    };

/**
 * `event`, `condition`, `chain` and `manual` have no occurrence derivable from the trigger — they
 * fire on the world or on a person. `scheduleFiresAreExact` is the same denominator stated in the
 * contracts package, and this refusal is the executable half of it.
 *
 * **`chain` is refused here, not answered.** `contracts/scheduling.md` §11.5 leaves open whether a
 * chain references a schedule or a fire; nothing in this module depends on knowing, because a
 * chained occurrence is produced by an upstream outcome and never by this clock. Refusing keeps
 * the question genuinely undecided rather than deciding it by accident at a call site.
 */
export function assertTriggerIsComputable(kind: TriggerKind): asserts kind is 'cron' | 'interval' {
  if (kind === 'cron' || kind === 'interval') return;
  throw Object.assign(
    new Error(`A ${kind} trigger has no occurrence a clock can compute.`),
    {
      code: 'schedule_trigger_not_computable',
      hint: `${kind} fires on ${kind === 'manual' ? 'a person' : 'the world'}, so there is no next time to show. Two of the six triggers have one: cron and interval.`,
    },
  );
}

/* -------------------------------------------------------------------------- *
 * The scan
 * -------------------------------------------------------------------------- */

export interface OccurrenceScan {
  /** Ascending, UTC. Empty is a legitimate answer (`0 0 30 2 *`). */
  occurrences: Date[];
  /** Wall-clock times the zone skipped. See the header. */
  nonexistentLocalTimes: string[];
  /** Wall-clock times the zone repeated, collapsed to the earlier instant. */
  ambiguousLocalTimes: string[];
  /**
   * `false` ⇒ the scan stopped on its own bound, not on `max` or `through`. A caller that is
   * catching up must run again from the last occurrence rather than assume it saw everything —
   * which is safe precisely because recording a fire is idempotent.
   */
  complete: boolean;
}

export interface ScanOptions {
  /** Exclusive lower bound. Occurrences strictly after this instant. */
  after: Date;
  /** Inclusive upper bound, or `null` for "as far as `max` needs". */
  through: Date | null;
  /** Hard cap on how many occurrences to return. **No default** — see `scheduleCost`'s `fires`. */
  max: number;
}

/**
 * Four years of minutes. The same bound `nextRunAt` uses, and for the same reason: it terminates
 * for every expression `parseCron` accepts and returns nothing for the pathological ones (30
 * February) rather than looping forever.
 */
const MAX_SCAN_MINUTES = 4 * 366 * 24 * 60;

export function occurrencesInWindow(
  trigger: ComputableTrigger,
  tz: string,
  options: ScanOptions,
): OccurrenceScan {
  if (options.max <= 0) {
    throw Object.assign(new Error('An occurrence scan needs a positive max.'), {
      code: 'bad_request',
      hint: 'Ask for the number of occurrences you intend to act on. A scan with no bound is how a week of sleep becomes ten thousand rows in one tick.',
    });
  }
  return trigger.kind === 'interval'
    ? scanInterval(trigger, options)
    : scanCron(trigger.expression, tz, options);
}

function scanInterval(
  trigger: Extract<ComputableTrigger, { kind: 'interval' }>,
  options: ScanOptions,
): OccurrenceScan {
  const anchor = Date.parse(trigger.anchor);
  if (!Number.isFinite(anchor)) {
    throw Object.assign(new Error(`"${trigger.anchor}" is not an instant.`), {
      code: 'bad_request',
      hint: 'An interval trigger stores the instant it counts from, as ISO-8601. Without one, every occurrence moves when the coordinator restarts.',
    });
  }
  if (!Number.isFinite(trigger.everySeconds) || trigger.everySeconds <= 0) {
    throw Object.assign(new Error('An interval needs a positive period.'), {
      code: 'bad_request',
      hint: 'everySeconds is how long to wait between fires.',
    });
  }
  const period = trigger.everySeconds * 1000;
  const after = options.after.getTime();
  // The first multiple strictly after `after`. Computed, not walked: an interval has an
  // arithmetic answer and walking one is how a fortnight of catch-up takes a second.
  const steps = Math.floor((after - anchor) / period) + 1;
  const occurrences: Date[] = [];
  let t = anchor + Math.max(0, steps) * period;
  if (t <= after) t += period;
  while (occurrences.length < options.max) {
    if (options.through !== null && t > options.through.getTime()) {
      return { occurrences, nonexistentLocalTimes: [], ambiguousLocalTimes: [], complete: true };
    }
    occurrences.push(new Date(t));
    t += period;
  }
  return { occurrences, nonexistentLocalTimes: [], ambiguousLocalTimes: [], complete: true };
}

function scanCron(expression: string, tz: string, options: ScanOptions): OccurrenceScan {
  const { fields, restricted } = parseCron(expression);
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = fields as [
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
  ];
  // The cron quirk people get wrong, kept identical to `nextRunAt`: when *both* day-of-month and
  // day-of-week are narrowed the match is an OR. `0 6 1 * 1` fires on the 1st **and** on Mondays.
  const domRestricted = restricted[2] === true;
  const dowRestricted = restricted[4] === true;

  const start = wallClockIn(tz, options.after);
  // A naive `Date` used purely as a calendar: its UTC getters are the *local* wall-clock fields.
  // It is never treated as an instant, which is the one discipline that keeps this correct.
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute));
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  const occurrences: Date[] = [];
  const nonexistentLocalTimes: string[] = [];
  const ambiguousLocalTimes: string[] = [];

  for (let i = 0; i < MAX_SCAN_MINUTES; i += 1) {
    const domHit = daysOfMonth.has(cursor.getUTCDate());
    const dowHit = daysOfWeek.has(cursor.getUTCDay());
    const matchesDay = domRestricted && dowRestricted ? domHit || dowHit : domHit && dowHit;
    if (
      minutes.has(cursor.getUTCMinutes()) &&
      hours.has(cursor.getUTCHours()) &&
      months.has(cursor.getUTCMonth() + 1) &&
      matchesDay
    ) {
      const wall: WallClock = {
        year: cursor.getUTCFullYear(),
        month: cursor.getUTCMonth() + 1,
        day: cursor.getUTCDate(),
        hour: cursor.getUTCHours(),
        minute: cursor.getUTCMinutes(),
      };
      const instants = instantsForWallClock(tz, wall);
      if (instants.length === 0) {
        nonexistentLocalTimes.push(formatWallClock(wall));
      } else {
        if (instants.length > 1) ambiguousLocalTimes.push(formatWallClock(wall));
        const instant = instants[0] as Date;
        if (options.through !== null && instant.getTime() > options.through.getTime()) {
          return { occurrences, nonexistentLocalTimes, ambiguousLocalTimes, complete: true };
        }
        if (instant.getTime() > options.after.getTime()) {
          occurrences.push(instant);
          if (occurrences.length >= options.max) {
            return { occurrences, nonexistentLocalTimes, ambiguousLocalTimes, complete: true };
          }
        }
      }
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return { occurrences, nonexistentLocalTimes, ambiguousLocalTimes, complete: false };
}

/* -------------------------------------------------------------------------- *
 * The preview — `Plan §14`'s ten times, and the receipt that they were shown
 * -------------------------------------------------------------------------- */

/**
 * *"Natural language in, expression plus the next ten fire times out, confirm."*
 *
 * **The middle step is what this builds; the first is not built and is named as unbuilt.**
 * Turning *"every weekday at seven"* into `0 7 * * 1-5` is a model call, it belongs to the save
 * dialog, and writing a phrase-matching approximation of it here would produce a component whose
 * failure mode is a confidently wrong expression — the exact thing the ten fire times exist to
 * catch. What is guaranteed here is the half that makes the guess safe: **no expression is
 * saved without these ten times having been on screen**, and `previewToken` is the receipt the
 * save route checks.
 *
 * `follow_me: true` returns a refusal rather than a preview. There is nowhere for the times to be
 * computed *in* — see `SCHEDULE_FOLLOW_ME`.
 */
export function previewFireTimes(input: {
  trigger: ComputableTrigger;
  zone: ScheduleZoneIntent;
  from: Date;
}): FireTimePreview {
  const zone = resolveFiringZone(input.zone);
  if (!zone.ok) {
    throw Object.assign(
      new Error('This schedule follows you, and this build does not know where you are.'),
      { code: 'schedule_zone_unresolved', hint: zone.hint },
    );
  }
  if (input.trigger.kind === 'interval' && input.zone.followMe) {
    // Refused rather than ignored. An interval is a stopwatch: "every 30 minutes" means the same
    // thing in every zone, so `follow_me` on one is a setting the author believes changed
    // something and that changes nothing — a declared value read as an observed one, in the one
    // place §14 detail 6 says the system must not guess.
    throw Object.assign(
      new Error('follow_me has no meaning on an interval trigger.'),
      {
        code: 'schedule_zone_intent_incoherent',
        hint: 'An interval fires every N seconds no matter which zone you are standing in. Set follow_me only on a cron schedule, where a wall-clock time is what moves.',
      },
    );
  }

  const scan = occurrencesInWindow(input.trigger, zone.tz, {
    after: input.from,
    through: null,
    max: PREVIEW_FIRE_TIME_COUNT,
  });

  const fireTimes: PreviewedFireTime[] = scan.occurrences.map((instant) => ({
    utc: instant.toISOString(),
    local: formatWallClock(wallClockIn(zone.tz, instant)),
  }));

  const expression =
    input.trigger.kind === 'cron'
      ? input.trigger.expression.trim()
      : `every ${input.trigger.everySeconds}s from ${input.trigger.anchor}`;

  return {
    expression,
    tz: zone.tz,
    followMe: input.zone.followMe,
    fireTimes,
    nonexistentLocalTimes: scan.nonexistentLocalTimes,
    ambiguousLocalTimes: scan.ambiguousLocalTimes,
    complete: scan.complete && fireTimes.length === PREVIEW_FIRE_TIME_COUNT,
    previewToken: fireTimePreviewToken({
      expression,
      tz: zone.tz,
      followMe: input.zone.followMe,
      fireTimes,
    }),
  };
}
