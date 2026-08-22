/* =============================================================================
 * threads/lib/list.ts — reading `GET /api/p/:project/threads` defensively
 *
 * The route this file consumes was **deliberately absent** from M16 until ADR-042's
 * session, and the reason it was absent is the reason this parser is shaped the way it
 * is: `thread-model.md` §9.6 ruled that a thread's *label* is a view concern, because
 * authoring one is a field nobody fills and deriving one server-side puts a copy of the
 * highest-PII value in the database into every list payload.
 *
 * So there is no `title` here and no excerpt, and `ThreadListItem` on the wire has
 * neither. The label is composed **in the view** out of `addressedTo` and the counts —
 * fields that cannot carry a sentence somebody typed. If a `body`, `preview`, `excerpt`
 * or `title` ever appears in this parser, the decision has been quietly reversed and
 * the PII objection is live again.
 *
 * `parse` returning `null` means **"the route answered and it is not what we agreed"**,
 * which `useEndpoint` reports with its own sentence, never the not-built one — the same
 * discipline `lib/detail.ts` documents. A project with no threads is a legitimate answer
 * and is modelled as an empty array; putting it in the failure bucket would report a
 * real state as a bug, and `unknown` is not `zero` (BOARD rule 9).
 *
 * NODE-LOADABLE LEAF: `import type` only.
 * ========================================================================== */

import type { ThreadKind, ThreadState } from '@agnetos/contracts';

/** One row of the list. Deliberately a subset of `ThreadSummary` plus the two counts. */
export interface ThreadListRow {
  id: string;
  kind: ThreadKind;
  delivery: 'direct' | 'dispatch' | 'fan-out' | 'default' | 'session';
  /** `{department}/{slug}` · `{department}` · `chief-of-staff` · a session id. */
  addressedTo: string;
  state: ThreadState;
  /** Turns in the thread. A count — never a preview of them. */
  messageCount: number;
  /** Newest turn, or creation for a thread nobody has answered. The sort key. */
  lastActivityAt: string;
  createdAt: string;
}

export interface ThreadList {
  threads: ThreadListRow[];
  /**
   * Matching threads before `limit`. Kept so a truncated list can *say* it is truncated
   * rather than presenting its first page as the whole set — the same reason `runsAreExact`
   * exists on the cost preview.
   */
  total: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/**
 * A count. `0` is legitimate and must survive, so this cannot use a falsy check —
 * `value || null` would turn a real empty thread into a parse failure.
 */
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

const KINDS = ['agent', 'department', 'project', 'session'] as const;
const DELIVERIES = ['direct', 'dispatch', 'fan-out', 'default', 'session'] as const;
const STATES = ['open', 'running', 'waiting', 'closed', 'failed'] as const;

function parseRow(value: unknown): ThreadListRow | null {
  if (!isRecord(value)) return null;
  const id = str(value.id);
  const kind = oneOf(value.kind, KINDS);
  const delivery = oneOf(value.delivery, DELIVERIES);
  const addressedTo = str(value.addressedTo);
  const state = oneOf(value.state, STATES);
  const messageCount = count(value.messageCount);
  const lastActivityAt = str(value.lastActivityAt);
  const createdAt = str(value.createdAt);
  if (
    id === null ||
    kind === null ||
    delivery === null ||
    addressedTo === null ||
    state === null ||
    messageCount === null ||
    lastActivityAt === null ||
    createdAt === null
  ) {
    return null;
  }
  return { id, kind, delivery, addressedTo, state, messageCount, lastActivityAt, createdAt };
}

export function parseThreadList(json: unknown): ThreadList | null {
  if (!isRecord(json) || !Array.isArray(json.threads)) return null;
  const rows: ThreadListRow[] = [];
  for (const raw of json.threads) {
    const row = parseRow(raw);
    // One bad row fails the whole read rather than being skipped. A list that silently
    // drops what it could not understand is a list whose length is a lie, and the length
    // is the number a person reads first.
    if (row === null) return null;
    rows.push(row);
  }
  const total = count(json.total);
  if (total === null) return null;
  return { threads: rows, total };
}
