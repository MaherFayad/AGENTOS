/**
 * The **read** half of the thread plane (ADR-023, `Plan §12`).
 *
 * Owner: `runner-engineer`. `db/threads.ts` is `thread-model-engineer`'s and holds the
 * writer; its header states plainly that the route and the mailbox drain are this agent's
 * slice. So the writes stay there and the reads live here, and the seam is written down
 * rather than discovered:
 *
 *   `db/threads.ts`      createThread · appendMessage · markMessagesDelivered · setThreadState
 *   `db/thread-reads.ts` readThread · readMessages · readMailbox · runningThreadIds
 *
 * **Why a second file is safe here and would not have been safe for the writer.** The whole
 * argument for one writer is that a column list can be wrong *by omission* and nothing
 * notices — 0005 made four columns `NOT NULL`, `ledger.ts` named none of them, and the first
 * paid run would have failed to record. A `SELECT` has no such failure mode: naming a column
 * that does not exist is a loud `42703` on the first execution, and omitting one is a missing
 * field the type system sees. The hazard the single-writer rule exists for is not present on
 * this side of it. Filed to `thread-model-engineer` as a `decision-request` all the same — if
 * they want these absorbed, the move is one file and no call sites change.
 *
 * **Every function here takes a `projectId` and puts it in the `WHERE`.** Not for RLS, which
 * is inert while compose's Postgres user is a superuser (`GET /api/status` reports it as
 * `projects.scopeEnforcement: 'bypassed'`), but *because* it is inert: a scoped predicate in
 * the statement is the half of the isolation that holds with no database configuration at
 * all. Two mechanisms for one property, exactly as `appendMessage` has.
 */

import type { InterruptLevel, MessageKind, ThreadMessage } from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';

/** A thread row, project-relative — the project is the caller's, never re-sent to it. */
export interface ThreadRow {
  id: string;
  projectId: string;
  kind: 'agent' | 'department' | 'project' | 'session';
  delivery: 'direct' | 'dispatch' | 'fan-out' | 'default' | 'session';
  addressedTo: string;
  state: 'open' | 'running' | 'waiting' | 'closed' | 'failed';
  parentThreadId: string | null;
  createdBy: string;
  dueAt: string | null;
  accountId: string | null;
  createdAt: string;
}

/**
 * `pg` hands back `Date` for `timestamptz`; the fake clients in tests hand back strings.
 * Both are normalised here rather than at seven call sites, because a payload that is an ISO
 * string on Postgres and an object in a test is a difference that shows up as a rendering bug
 * on the one path nothing exercises.
 */
const iso = (value: unknown): string | null => {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/** Non-null variant, for the columns the schema guarantees. */
const isoRequired = (value: unknown): string => iso(value) ?? '';

type RawThread = Record<string, unknown>;

const toThread = (row: RawThread): ThreadRow => ({
  id: String(row.id),
  projectId: String(row.project_id),
  kind: row.kind as ThreadRow['kind'],
  delivery: row.delivery as ThreadRow['delivery'],
  addressedTo: String(row.addressed_to),
  state: row.state as ThreadRow['state'],
  parentThreadId: row.parent_thread_id == null ? null : String(row.parent_thread_id),
  createdBy: String(row.created_by),
  dueAt: iso(row.due_at),
  accountId: row.account_id == null ? null : String(row.account_id),
  createdAt: isoRequired(row.created_at),
});

const toMessage = (row: RawThread): ThreadMessage => ({
  id: String(row.id),
  threadId: String(row.thread_id),
  projectId: String(row.project_id),
  seq: Number(row.seq),
  kind: row.kind as MessageKind,
  interrupt: row.interrupt == null ? null : (row.interrupt as InterruptLevel),
  author: String(row.author),
  // Free text a person typed. It leaves this process only inside its own project's
  // response, and never as a span attribute — `messageSpanAttributes` has no field for it.
  body: String(row.body),
  payload: (row.payload as Record<string, unknown> | null) ?? null,
  inReplyTo: row.in_reply_to == null ? null : String(row.in_reply_to),
  expiresAt: iso(row.expires_at),
  deliveredAt: iso(row.delivered_at),
  createdAt: isoRequired(row.created_at),
});

const THREAD_COLUMNS =
  'id, project_id, kind, delivery, addressed_to, state, parent_thread_id, created_by, due_at, account_id, created_at';

const MESSAGE_COLUMNS =
  'id, thread_id, project_id, seq, kind, interrupt, author, body, payload, in_reply_to, expires_at, delivered_at, created_at';

/**
 * One thread, in this project.
 *
 * `null` rather than a throw, so the caller decides whether the absence is
 * `thread_not_found` (a read) or a wiring fault (a run that lost its own thread). From
 * outside its project a thread does not exist, which is the same deliberately opaque
 * refusal a run gets — hence `project_id` in the predicate rather than a check afterwards.
 */
export async function readThread(
  db: DbClient,
  projectId: string,
  threadId: string,
): Promise<ThreadRow | null> {
  const { rows } = await db.query<RawThread>(
    `SELECT ${THREAD_COLUMNS} FROM ops.thread WHERE id = $1 AND project_id = $2`,
    [threadId, projectId],
  );
  const row = rows[0];
  return row ? toThread(row) : null;
}

/**
 * Every thread in this project, newest activity first.
 *
 * ## What this deliberately does not select
 *
 * `THREAD_COLUMNS` and two aggregates. **No column from `ops.message` reaches the caller** —
 * not `body`, not an excerpt, not a first line. `thread-model.md` §9.6 ruled that a thread
 * label is a view concern precisely because deriving one server-side puts a copy of the
 * highest-PII value in the database into every list payload, and a list payload is the one
 * shape that gets logged, cached and pushed. The aggregates are a `count` and a `max(...)`
 * of a timestamp: neither can carry a sentence somebody typed.
 *
 * ## Why the sort key is activity and not creation
 *
 * A thread matters because it moved. `COALESCE(max(m.created_at), t.created_at)` keeps a
 * brand-new thread with no turns at the top where it belongs, rather than sorting it as
 * `NULL` — which Postgres would place first or last depending on a `NULLS` clause nobody
 * would remember to write.
 *
 * `project_id` is in the predicate rather than checked afterwards, for the same reason
 * `readThread` does it: from outside its project a thread does not exist.
 */
export async function listThreads(
  db: DbClient,
  projectId: string,
  limit = 100,
): Promise<{ threads: Array<ThreadRow & { messageCount: number; lastActivityAt: string }>; total: number }> {
  const { rows } = await db.query<RawThread & { message_count: string; last_activity_at: string; total: string }>(
    `SELECT ${THREAD_COLUMNS.split(', ').map((c) => 't.' + c).join(', ')},
            COUNT(m.id)                                        AS message_count,
            COALESCE(MAX(m.created_at), t.created_at)          AS last_activity_at,
            COUNT(*) OVER ()                                   AS total
       FROM ops.thread t
       LEFT JOIN ops.message m ON m.thread_id = t.id AND m.project_id = t.project_id
      WHERE t.project_id = $1
      GROUP BY t.id
      ORDER BY COALESCE(MAX(m.created_at), t.created_at) DESC
      LIMIT $2`,
    [projectId, limit],
  );
  return {
    threads: rows.map((row) => ({
      ...toThread(row),
      messageCount: Number(row.message_count),
      lastActivityAt: new Date(row.last_activity_at).toISOString(),
    })),
    // `COUNT(*) OVER ()` counts the grouped rows, so it is the number of threads before
    // LIMIT — not the number of messages. Zero rows means zero threads, and the caller
    // gets 0 rather than a missing field it would have to guess at.
    total: rows.length > 0 ? Number(rows[0]!.total) : 0,
  };
}

/**
 * A thread's turns, oldest first.
 *
 * `limit` is a ceiling on how much conversation a single payload — or a single seeded
 * prompt — can carry. It has a default because the caller that forgets one is the caller
 * that pages a year of a conversation into a model's context window and pays for it.
 */
export async function readMessages(
  db: DbClient,
  projectId: string,
  threadId: string,
  limit = 200,
): Promise<ThreadMessage[]> {
  const { rows } = await db.query<RawThread>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM ops.message
      WHERE thread_id = $1 AND project_id = $2
      ORDER BY seq ASC
      LIMIT $3`,
    [threadId, projectId, limit],
  );
  return rows.map(toMessage);
}

/**
 * **The mailbox**: `delivered_at IS NULL`, ordered by `seq`.
 *
 * A predicate, not a table (`thread-model.md` §4.3) — one place the messages live, one place
 * the agent reads them, and no second entity to fall out of step with the first. This is the
 * read half of the drain; `markMessagesDelivered` is the write half and lives with the
 * writer. The partial index `message_mailbox_idx` is exactly this query.
 */
export async function readMailbox(
  db: DbClient,
  projectId: string,
  threadId: string,
): Promise<ThreadMessage[]> {
  const { rows } = await db.query<RawThread>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM ops.message
      WHERE thread_id = $1 AND project_id = $2 AND delivered_at IS NULL
      ORDER BY seq ASC`,
    [threadId, projectId],
  );
  return rows.map(toMessage);
}

/** How many turns are still unread. Separate from `readMailbox` so a list payload is cheap. */
export async function mailboxDepth(
  db: DbClient,
  projectId: string,
  threadId: string,
): Promise<number> {
  const { rows } = await db.query<{ depth: string | number }>(
    `SELECT count(*) AS depth
       FROM ops.message
      WHERE thread_id = $1 AND project_id = $2 AND delivered_at IS NULL`,
    [threadId, projectId],
  );
  return Number(rows[0]?.depth ?? 0);
}
