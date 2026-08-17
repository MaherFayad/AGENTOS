/**
 * The write path for `ops.thread` and `ops.message` (ADR-023, `Plan §12`).
 *
 * Owner: `thread-model-engineer`. **The schema and its only writer are one change**, and this
 * file exists because M15 proved what happens when they are two: migration 0005 made four
 * columns NOT NULL on `ops.agent_runs`, `ledger.ts` named none of them, and the first real run
 * would have been paid for and then failed to record. `writer-schema-agreement.test.ts` checks
 * the two agree with no database at all, and it is extended to cover these statements in the
 * same commit that adds them.
 *
 * **What this file is not.** `POST /api/thread/:id/message` and the mailbox drain at tool
 * boundaries are `runner-engineer`'s slice (BOARD, M16). This is the storage layer they call:
 * one place that knows the column list, so the route does not learn it a second time.
 *
 * Three properties are worth reading before changing anything here:
 *
 * 1. **Derived, not supplied.** A message's `project_id` and `thread_kind` are `SELECT`ed from
 *    the thread row inside the same statement, never passed in. A caller cannot file one
 *    client's message under another client's thread even by getting an argument wrong. That is
 *    the same move `lib/graph.ts` made when it stopped importing `RunnerConfig`: agreement
 *    between two variables is not derivation from one.
 * 2. **Refusals are refusals.** A `steer` sent to a thread with no run in flight is refused,
 *    never quietly queued as a note. A human who steered and was silently queued believes they
 *    changed course, and nothing did.
 * 3. **No delete.** There is no delete verb in this file and adding one needs an ADR — see
 *    `0008_threads.sql` §6 and `thread-model.md` §9.3.
 */

import { randomUUID } from 'node:crypto';
import {
  assertThreadTransition,
  canonicalAddressedTo,
  messageCarriesInterrupt,
  messageRequiresExpiry,
  threadDeliveryFor,
  threadKindFor,
  type InterruptLevel,
  type MessageKind,
  type ResolvedThreadAddress,
  type ThreadState,
} from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';

/**
 * Who this thread is with. A `session` thread has no address form — nobody typed `@` at a CLI
 * — so it is its own case rather than a fifth value squeezed into the grammar.
 */
export type ThreadSubject =
  | { via: 'address'; address: ResolvedThreadAddress }
  | { via: 'session'; sessionId: string };

export interface CreateThreadInput {
  projectId: string;
  subject: ThreadSubject;
  /** `human:{identity}` · `agent:{department}/{slug}` · `schedule:{id}` · `system:{part}`. */
  createdBy: string;
  /** A thread with a due date is a task (`Plan §19`). ISO 8601, or omitted. */
  dueAt?: string | null;
  /** A preference. The run's own `(account_id, account_source)` answers who paid. */
  accountId?: string | null;
  /** Fan-out children, and delegations, hang off their parent. Same project, by FK. */
  parentThreadId?: string | null;
}

/**
 * The two states a thread may open in. Anything else is a transition, and transitions go
 * through `setThreadState` so `THREAD_TRANSITIONS` is the only place the order is written.
 */
const OPENING_STATE: Readonly<Record<ThreadSubject['via'], ThreadState>> = {
  // An addressed thread exists before anything runs: the human typed, nothing has answered.
  address: 'open',
  // A session is hosted by a CLI that is already attached. It opens running or it is not a
  // session; there is no moment where a live CLI has an idle thread.
  session: 'running',
};

export async function createThread(db: DbClient, input: CreateThreadInput): Promise<{ id: string }> {
  const id = randomUUID();

  // Generated here rather than by a column DEFAULT, so a log line about a failed insert can
  // name the thread that failed. An id that only exists if the write succeeded cannot appear
  // in the message explaining why the write did not.
  const { kind, delivery, addressedTo } =
    input.subject.via === 'address'
      ? {
          kind: threadKindFor(input.subject.address),
          delivery: threadDeliveryFor(input.subject.address),
          addressedTo: canonicalAddressedTo(input.subject.address),
        }
      : { kind: 'session' as const, delivery: 'session' as const, addressedTo: input.subject.sessionId };

  if (addressedTo.length === 0) {
    throw Object.assign(
      new Error('A thread cannot be created with an empty address.'),
      { code: 'address_malformed' },
    );
  }

  await db.query(
    `INSERT INTO ops.thread (
       id, project_id, kind, delivery, addressed_to, state,
       parent_thread_id, created_by, due_at, account_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.projectId,
      kind,
      delivery,
      addressedTo,
      OPENING_STATE[input.subject.via],
      input.parentThreadId ?? null,
      input.createdBy,
      input.dueAt ?? null,
      input.accountId ?? null,
    ],
  );

  return { id };
}

export interface AppendMessageInput {
  threadId: string;
  kind: MessageKind;
  /** `human:{identity}` · `agent:{department}/{slug}` · `system:{part}`. */
  author: string;
  body: string;
  /** Required exactly when the kind is one a person sent. Mirrors `messageCarriesInterrupt`. */
  interrupt?: InterruptLevel | null;
  /**
   * An **object**. Never a string of pre-flattened prose: key-based redaction walks object
   * keys, and a string has none (`observability/redact.ts`).
   */
  payload?: Record<string, unknown> | null;
  /** Required exactly when `kind === 'answer'`. */
  inReplyTo?: string | null;
  /** **Mandatory when `kind === 'question'`** (`Plan §12`). ISO 8601. */
  expiresAt?: string | null;
}

/**
 * Append a turn.
 *
 * `project_id` and `thread_kind` are read out of the thread inside the statement, and the
 * database pins them with `message_thread_fk`. Two mechanisms for one property, deliberately:
 * the SELECT makes a wrong value impossible to supply, the foreign key makes it impossible to
 * store if some future writer supplies one anyway.
 *
 * `seq` is derived the same way. `UNIQUE (thread_id, seq)` turns a concurrent append into a
 * loud unique violation, which is the correct direction — two message #4s in a conversation is
 * a defect nobody notices until they read it back.
 */
export async function appendMessage(
  db: DbClient,
  input: AppendMessageInput,
): Promise<{ id: string; seq: number }> {
  assertMessageShape(input);
  const id = randomUUID();

  // A `steer` is injected into an in-flight session. There is nothing to inject into when
  // nothing is running, so the predicate is part of the write rather than a check before it —
  // a read-then-write would let the run end in between and queue a steer as a surprise.
  const requiresRunning = input.interrupt === 'steer';

  const { rows } = await db.query<{ id: string; seq: number }>(
    `INSERT INTO ops.message (
       id, thread_id, project_id, thread_kind, seq, kind, interrupt,
       author, body, payload, in_reply_to, expires_at
     )
     SELECT $1, t.id, t.project_id, t.kind,
            coalesce((SELECT max(m.seq) FROM ops.message m WHERE m.thread_id = t.id), 0) + 1,
            $3, $4, $5, $6, $7::jsonb, $8, $9
       FROM ops.thread t
      WHERE t.id = $2
        AND ($10::boolean IS NOT TRUE OR t.state = 'running')
     RETURNING id, seq`,
    [
      id,
      input.threadId,
      input.kind,
      input.interrupt ?? null,
      input.author,
      input.body,
      // **Deliberately not passed through `redact()`**, unlike `writeOutput`. The two are
      // different acts: `app.agent_outputs` is an *agent* durably persisting something it
      // scraped, and redaction there stops a run laundering PII into a business table. A
      // message is the *record of a conversation a person chose to have* — redacting it would
      // delete the thing the thread exists to hold, and would do it silently, with no unredact
      // path. Part VII.4 is satisfied one layer out instead: the body and the payload never
      // become span attributes (`messageSpanAttributes` has no field for either) and never
      // enter a push payload. Redact at instrumentation, not at storage.
      input.payload == null ? null : JSON.stringify(input.payload),
      input.inReplyTo ?? null,
      input.expiresAt ?? null,
      requiresRunning,
    ],
  );

  const row = rows[0];
  if (!row) return explainAppendFailure(db, input.threadId, requiresRunning);
  return { id, seq: row.seq };
}

/**
 * Zero rows returned has two causes, and answering with one sentence covering both would make
 * "wrong thread" and "wrong moment" the same bug report. One extra query, on the error path
 * only, buys a message that names which it was.
 */
async function explainAppendFailure(
  db: DbClient,
  threadId: string,
  requiresRunning: boolean,
): Promise<never> {
  const { rows } = await db.query<{ state: ThreadState }>(
    'SELECT state FROM ops.thread WHERE id = $1',
    [threadId],
  );
  const state = rows[0]?.state;
  if (!state) {
    throw Object.assign(
      new Error(
        `No thread ${threadId} in this project's scope. From outside its project a thread does ` +
          'not exist, which is the same deliberately opaque refusal a run gets.',
      ),
      { code: 'thread_not_found' },
    );
  }
  if (requiresRunning) {
    throw Object.assign(
      new Error(
        `Thread ${threadId} is "${state}", so there is no run in flight to steer. A steer is ` +
          'refused, never downgraded to a note: being silently queued after steering is ' +
          'indistinguishable from having changed course.',
      ),
      { code: 'interrupt_not_deliverable', hint: 'Send it as a note, or start a run first.' },
    );
  }
  throw Object.assign(
    new Error(`Thread ${threadId} accepted no message and its state is "${state}".`),
    { code: 'thread_not_addressable' },
  );
}

/**
 * The invariants `0008_threads.sql` states as CHECK constraints, restated in the process that
 * can name the field.
 *
 * Not redundant, and not a second source of truth: the CHECKs are authoritative and
 * `thread-address.test.ts` asserts these predicates are character-for-character the ones in the
 * migration. This copy exists so the failure arrives as *"a question needs an expiry"* rather
 * than as `violates check constraint "message_question_expires"` after a round trip.
 */
function assertMessageShape(input: AppendMessageInput): void {
  const carries = messageCarriesInterrupt(input.kind);
  const has = input.interrupt != null;
  if (carries !== has) {
    throw Object.assign(
      new Error(
        carries
          ? `A "${input.kind}" message is sent by a person and must declare an interrupt level: note, steer or halt.`
          : `A "${input.kind}" message is not sent by a person and cannot declare an interrupt level.`,
      ),
      { code: 'bad_request' },
    );
  }

  if (messageRequiresExpiry(input.kind) !== (input.expiresAt != null)) {
    throw Object.assign(
      new Error(
        messageRequiresExpiry(input.kind)
          ? 'A question must carry expires_at. A run blocked forever on a question nobody saw ' +
            'looks idle, holds a slot, and delivers nothing — on expiry it fails with ' +
            'question_unanswered.'
          : `Only a question carries expires_at; "${input.kind}" does not.`,
      ),
      { code: 'bad_request' },
    );
  }

  if ((input.kind === 'answer') !== (input.inReplyTo != null)) {
    throw Object.assign(
      new Error(
        input.kind === 'answer'
          ? 'An answer must name the question it answers (in_reply_to).'
          : `Only an answer sets in_reply_to; "${input.kind}" does not.`,
      ),
      { code: 'bad_request' },
    );
  }
}

/**
 * Drain: mark messages read at a tool boundary.
 *
 * `delivered_at IS NULL` in the predicate as well as in the index, so draining twice does not
 * rewrite a timestamp and make "when did the agent first see this" unanswerable.
 */
export async function markMessagesDelivered(db: DbClient, messageIds: readonly string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await db.query(
    `UPDATE ops.message
        SET delivered_at = now()
      WHERE id = ANY($1::uuid[])
        AND delivered_at IS NULL`,
    [messageIds],
  );
}

/**
 * Move a thread's state, with the transition table as the only authority.
 *
 * `from` is supplied and asserted in the `WHERE`, so a concurrent transition loses rather than
 * overwrites: the update matches nothing and the caller is told the thread had already moved.
 * The database constrains the *set* of legal states and says nothing about the order — one
 * rule, one implementation, because two copies of a state machine drift and the drift is
 * invisible until a thread is stuck.
 */
export async function setThreadState(
  db: DbClient,
  threadId: string,
  from: ThreadState,
  to: ThreadState,
): Promise<void> {
  assertThreadTransition(from, to);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE ops.thread SET state = $3 WHERE id = $1 AND state = $2 RETURNING id`,
    [threadId, from, to],
  );
  if (rows.length === 0) {
    throw Object.assign(
      new Error(
        `Thread ${threadId} was not in state "${from}", so it was not moved to "${to}". Either ` +
          'it moved underneath this caller or it is not in this project\'s scope.',
      ),
      { code: 'thread_not_addressable' },
    );
  }
}
