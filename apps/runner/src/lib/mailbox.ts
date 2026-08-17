/**
 * The mailbox drain (ADR-023, `Plan §12`; `comms/contracts/thread-model.md` §4.3).
 *
 * Owner: `runner-engineer`. The contract fixes the semantics; this is the mechanism.
 *
 * > *Every thread has a mailbox; every running agent drains it at tool boundaries.*
 *
 * **The mailbox is a predicate, not a table** — `ops.message WHERE delivered_at IS NULL`,
 * ordered by `seq`. One place the messages live, one place the agent reads them, and no
 * second entity to fall out of step with the first. That is the same argument that deleted
 * `ops.question`, applied one layer down.
 *
 * Three properties this file exists to hold, each of which is a decision:
 *
 * 1. **A drain marks `delivered_at` once.** `markMessagesDelivered` carries
 *    `AND delivered_at IS NULL`, so a second drain over the same ids does not rewrite the
 *    timestamp. *"When did the agent first see this"* stays answerable, which it would not
 *    be if a retry moved the clock forward.
 * 2. **A drain that finds a `halt` stops at that message and does not consume the ones
 *    behind it.** Inclusive of the halt itself — the agent *did* read it, and that is why it
 *    stopped. Everything after it stays in the mailbox for the run that resumes the thread.
 * 3. **A `steer` is never consumed here.** It is refused at the route (see
 *    `MID_RUN_STEER`), so one reaching the mailbox means something bypassed the route. The
 *    drain stops on it, leaves it undelivered, and says so. That wedges the mailbox, loudly
 *    and visibly in `mailboxDepth` — which is the correct direction: quietly consuming it as
 *    though it were a note is exactly the silent downgrade `thread-model.md` invariant 7
 *    forbids, and a wedged mailbox can be seen while a downgraded steer cannot.
 */

import type { ThreadMessage } from '@agnetos/contracts';
import { markMessagesDelivered } from '../db/threads.ts';
import { readMailbox } from '../db/thread-reads.ts';
import type { DbClient } from '../observability/types.ts';

/**
 * Whether this runner can inject a turn into an **in-flight** SDK session.
 *
 * `false`, and typed `false` rather than commented, for the same reason
 * `FAN_OUT_DISPATCH.allowed` is: flipping it must be a reviewable, type-level act in the
 * same commit as whatever proves it works, not a config edit.
 *
 * **What is actually missing, stated so nobody re-derives it.** `createSdkSession` calls the
 * Agent SDK's `query({ prompt })` with a *string* prompt. Pushing another user turn into a
 * running query needs its streaming-input mode, which this repo has never exercised —
 * `RUNNER_ANTHROPIC_API_KEY` is unset and **zero runs have executed**, so the SDK has never
 * been loaded, let alone driven. Writing that plumbing now would put unverifiable code on
 * the one path no test in this repo can reach, and the first thing to exercise it would be a
 * paid run. So the capability is declared absent and the route refuses on it.
 *
 * The consequence, which is the honest half: **`steer` does not work in M16.** `note` and
 * `halt` do. `#`/`@@`/bare addressing parses, stores and previews. This is one line to
 * delete the day the key lands and streaming input is proven.
 */
export const MID_RUN_STEER: {
  readonly supported: false;
  readonly reason: string;
  readonly unblockedBy: string;
} = {
  supported: false,
  reason:
    'This runner cannot inject a turn into a session that is already running: the Agent ' +
    "SDK is driven with a string prompt, and its streaming-input mode has never been " +
    'exercised here because no run has ever executed.',
  unblockedBy: 'RUNNER_ANTHROPIC_API_KEY + a proven streaming-input session',
};

/**
 * What one drain read, and what it means for the run that called it.
 *
 * `halted` is separate from `messages` on purpose: a caller that had to scan for a halt
 * would be a second implementation of rule 2 above, and the second implementation is the one
 * that gets it wrong when a halt is also the last message.
 */
export interface MailboxDrain {
  /** Consumed and now marked delivered, in `seq` order. Includes the halt, if there was one. */
  messages: readonly ThreadMessage[];
  /** The message that stopped the drain, if any. Its body is what the human wants stopped for. */
  halted: ThreadMessage | null;
  /**
   * A `steer` the drain refused to consume — see property 3. Present ⇒ the mailbox is
   * wedged at this message and nothing behind it will be read until it is resolved.
   */
  undeliverable: ThreadMessage | null;
  /** Turns left in the mailbox after this drain. `> 0` with `halted` set is the normal case. */
  remaining: number;
}

const EMPTY: MailboxDrain = { messages: [], halted: null, undeliverable: null, remaining: 0 };

/**
 * Read and consume the mailbox for one thread, at a tool boundary.
 *
 * Deliberately **not** transactional, and that is a decision rather than an omission: the
 * read and the mark are two statements, so a crash between them leaves messages that were
 * read but not marked — they are read *again* by the next drain. The other direction, marking
 * first, would lose a human's message on a crash. Between duplicating a note and dropping
 * one, duplicating is the recoverable failure.
 */
export async function drainMailbox(
  db: DbClient,
  projectId: string,
  threadId: string,
): Promise<MailboxDrain> {
  const pending = await readMailbox(db, projectId, threadId);
  if (pending.length === 0) return EMPTY;

  const consumed: ThreadMessage[] = [];
  let halted: ThreadMessage | null = null;
  let undeliverable: ThreadMessage | null = null;

  for (const message of pending) {
    if (message.interrupt === 'steer') {
      // Not consumed. See property 3 — leaving it undelivered is the only reading that
      // cannot be mistaken for having acted on it.
      undeliverable = message;
      break;
    }
    consumed.push(message);
    if (message.interrupt === 'halt') {
      halted = message;
      break;
    }
  }

  await markMessagesDelivered(
    db,
    consumed.map((message) => message.id),
  );

  return {
    messages: consumed,
    halted,
    undeliverable,
    remaining: pending.length - consumed.length,
  };
}

/**
 * The one line a run's console shows for a drained message.
 *
 * Bracketed like every other out-of-band notice the runner writes into the token stream
 * (`[company/COMPANY.md is empty …]`), so a reader can tell the agent's own output from the
 * runner talking. The body is included because this frame is served **inside the message's
 * own project** — the same boundary that lets `GET /api/p/:project/approvals` carry `inputs`.
 * It is not the boundary a span or a push payload crosses, and neither of those ever sees it.
 */
export function renderDrainedMessage(message: ThreadMessage): string {
  const level = message.interrupt ? message.interrupt : message.kind;
  return `[${level} from ${message.author}: ${message.body}]\n`;
}
