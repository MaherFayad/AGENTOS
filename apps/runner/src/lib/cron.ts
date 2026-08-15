/**
 * 5-field cron validation and next-fire calculation for `POST /api/schedule` (§3.2).
 *
 * Validation is strict and happens *before* the git commit, because the failure mode we
 * are avoiding is a committed schedule that ofelia silently refuses to load — at which
 * point the map shows a clock badge for a job that will never fire, and the frontmatter
 * has become a lie rather than a source of truth.
 */
import { ApiError } from './errors';

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  /** Named aliases (`mon`, `jan`) mapped to their numeric value. */
  names?: Record<string, number>;
}

const FIELDS: FieldSpec[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  {
    name: 'month',
    min: 1,
    max: 12,
    names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },
  },
  {
    name: 'day of week',
    min: 0,
    max: 6,
    names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
  },
];

function parseFieldValue(spec: FieldSpec, token: string): number {
  const named = spec.names?.[token.toLowerCase()];
  if (named !== undefined) return named;
  const value = Number.parseInt(token, 10);
  if (!Number.isInteger(value) || String(value) !== token.replace(/^0+(?=\d)/, '')) {
    throw new ApiError('invalid_cron', `"${token}" is not a valid ${spec.name}.`, {
      hint: `Use a number between ${spec.min} and ${spec.max}, a range like 1-5, a list like 1,3,5, or *.`,
      retryable: false,
    });
  }
  if (value < spec.min || value > spec.max) {
    throw new ApiError('invalid_cron', `${spec.name} ${value} is out of range.`, {
      hint: `${spec.name} must be between ${spec.min} and ${spec.max}.`,
      retryable: false,
    });
  }
  return value;
}

/** Expand one field to the set of values it matches. */
function expandField(spec: FieldSpec, field: string): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number.parseInt(stepPart, 10);
    if (!Number.isInteger(step) || step < 1) {
      throw new ApiError('invalid_cron', `"${part}" has an invalid step.`, {
        hint: 'A step looks like */15 — a positive whole number after the slash.',
        retryable: false,
      });
    }

    let from = spec.min;
    let to = spec.max;
    if (rangePart !== '*' && rangePart !== undefined) {
      const bounds = rangePart.split('-');
      if (bounds.length === 1) {
        from = parseFieldValue(spec, bounds[0] as string);
        to = stepPart === undefined ? from : spec.max;
      } else if (bounds.length === 2) {
        from = parseFieldValue(spec, bounds[0] as string);
        to = parseFieldValue(spec, bounds[1] as string);
      } else {
        throw new ApiError('invalid_cron', `"${rangePart}" is not a valid ${spec.name} range.`, {
          hint: 'A range looks like 1-5.',
          retryable: false,
        });
      }
    }

    if (from > to) {
      throw new ApiError('invalid_cron', `${spec.name} range ${from}-${to} runs backwards.`, {
        hint: 'Put the smaller number first, or use two entries separated by a comma.',
        retryable: false,
      });
    }
    for (let value = from; value <= to; value += step) out.add(value);
  }
  return out;
}

export interface ParsedCron {
  expression: string;
  fields: Set<number>[];
  /** Which fields were narrowed from `*`. Needed for the day-of-month/day-of-week rule. */
  restricted: boolean[];
}

/** Parse and validate. Throws `invalid_cron` with a hint a human can act on. */
export function parseCron(expression: string): ParsedCron {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new ApiError('invalid_cron', `"${trimmed}" is not a 5-field cron expression.`, {
      hint: 'Schedules look like "0 6 * * 1" — minute, hour, day of month, month, day of week. That one means 06:00 every Monday.',
      retryable: false,
    });
  }
  const fields = FIELDS.map((spec, index) => expandField(spec, parts[index] as string));
  return {
    expression: trimmed,
    fields,
    restricted: parts.map((part) => part !== '*'),
  };
}

/**
 * Next firing at or after `from`, in UTC. Scans minute by minute for up to four years,
 * which terminates for every expression this validator accepts and returns `null` for the
 * pathological ones (30 February) rather than looping.
 */
export function nextRunAt(expression: string, from: Date = new Date()): string | null {
  const { fields, restricted } = parseCron(expression);
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = fields as [
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
  ];
  // Standard cron quirk, and the one people get wrong: when *both* day-of-month and
  // day-of-week are restricted the match is an OR, not an AND. `0 6 1 * 1` fires on the
  // 1st **and** on Mondays. Getting this wrong would make `nextRunAt` disagree with ofelia
  // about when a job actually runs, and the frontmatter badge would be quietly untrue.
  const domRestricted = restricted[2] === true;
  const dowRestricted = restricted[4] === true;

  const cursor = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
    from.getUTCHours(),
    from.getUTCMinutes(),
    0,
    0,
  ));
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  const limit = 4 * 366 * 24 * 60;
  for (let i = 0; i < limit; i += 1) {
    const domHit = daysOfMonth.has(cursor.getUTCDate());
    const dowHit = daysOfWeek.has(cursor.getUTCDay());
    const matchesDay =
      domRestricted && dowRestricted ? domHit || dowHit : domHit && dowHit;
    if (
      minutes.has(cursor.getUTCMinutes()) &&
      hours.has(cursor.getUTCHours()) &&
      months.has(cursor.getUTCMonth() + 1) &&
      matchesDay
    ) {
      return cursor.toISOString();
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}
