/**
 * Threads at the route layer (ADR-023, `Plan §12`).
 *
 * Owner: `runner-engineer`. Semantics are `comms/contracts/thread-model.md`'s and are not
 * re-argued here; this file is the three things that contract explicitly leaves to the
 * runner — **resolution against a project's roster**, **the route bodies**, and **the point
 * where an address is refused rather than spent**.
 *
 * The shape of the whole file follows from one rule: *the grammar validates shape, and
 * resolution answers existence.* `parseThreadAddress` never consults a department list —
 * `Plan §10` says seven departments in one sentence and an eighth in the next, and BOARD
 * forbids baking `7` into anything project-shaped. So "does `sales` exist" is a question
 * about **this project's resolved roster**, which is the cascade's, which is why resolution
 * lives next to the routes rather than in the shared contracts package.
 */

import {
  addressCost,
  assertFanOutDispatchable,
  canonicalAddressedTo,
  DEFAULT_RECIPIENT,
  FAN_OUT_DISPATCH,
  formatThreadAddress,
  parseThreadAddress,
  type CreateThreadRequest,
  type CreateThreadResponse,
  type PostThreadMessageRequest,
  type PostThreadMessageResponse,
  type ResolvedThreadAddress,
  type ThreadAddress,
  type ThreadDetail,
  type ThreadMessageRef,
  type ThreadSummary,
} from '@agnetos/contracts';
import { ApiError, badRequest } from './errors.ts';
import { MID_RUN_STEER } from './mailbox.ts';
import { listResolvedAgents } from './cascade.ts';
import type { RunnerConfig } from './config.ts';
import type { MountedProject } from './project.ts';
import { appendMessage, createThread } from '../db/threads.ts';
import { mailboxDepth, readMessages, readThread, type ThreadRow } from '../db/thread-reads.ts';
import type { DbClient } from '../observability/types.ts';

/**
 * The thread plane needs Postgres, and `--profile dev` deliberately has none.
 *
 * A refusal rather than a fallback, and it is the same judgement the metrics routes made:
 * *unknown is not zero*. An in-memory thread would be a conversation that vanishes on the
 * next deploy while looking exactly like one that persisted — a broken state wearing the
 * working state's clothes, which is the defect BOARD rule 9 is about.
 */
export function requireThreadStore(db: DbClient | null): DbClient {
  if (db) return db;
  throw new ApiError('thread_store_unavailable', 'This runner has no thread store.', {
    hint:
      'Threads live in Postgres and this runner is not connected to one. Start the stack ' +
      'with the full profile (`docker compose --profile full up -d`) and try again — nothing ' +
      'was lost, because nothing was written.',
    retryable: true,
  });
}

/**
 * `human:{identity}` per `thread_created_by_shape` — and there is no identity in v1.
 *
 * BOARD #5: no auth, by design, tailnet only. So the runner genuinely does not know which
 * person typed this, and `unattributed` is the **named** state for that, borrowed verbatim
 * from `ops.agent_runs.account_source` (ADR-015 Q20): a bucket a UI must render, not a NULL
 * it can drop. Inventing `human:owner` would put a person in the record who never existed.
 */
export const UNIDENTIFIED_HUMAN = 'human:unattributed';

/* -------------------------------------------------------------------------- *
 * Resolution — the half `thread-model.md` §3.3 routes to the cascade
 * -------------------------------------------------------------------------- */

export interface Resolution {
  address: ResolvedThreadAddress;
  /**
   * The **resolved** member count of the addressed department, or 0 where the form does not
   * address one. Read by `addressCost` for a fan-out, and a caller that guesses it has
   * invented the one figure in the preview that was supposed to be real.
   */
  memberCount: number;
}

/** Every `(department, slug)` this project would actually run, via the one cascade. */
async function roster(
  config: RunnerConfig,
  project: MountedProject,
): Promise<Array<{ department: string; slug: string; ref: string }>> {
  const resolved = await listResolvedAgents(config, project, () => {
    /* An unresolvable SKILL.md costs its own row, never the whole roster — the same rule
     * `GET /api/agents` follows. It is deliberately not surfaced as an address refusal:
     * "this agent is broken" and "you addressed nobody" are different sentences. */
  });
  return resolved.map(({ record }) => ({
    department: record.department,
    slug: record.slug.includes('/') ? record.slug.slice(record.slug.indexOf('/') + 1) : record.slug,
    ref: record.slug,
  }));
}

/**
 * Turn a parsed address into one this project can act on, or refuse by name.
 *
 * **It never picks.** `@account-enrichment` matching two departments is `address_ambiguous`
 * with both matches in the hint — picking the first runs an agent the human did not mean,
 * which is `Plan §21.9`'s bug class with no error message, and the one provenance exists to
 * mitigate.
 */
export async function resolveAddress(
  config: RunnerConfig,
  project: MountedProject,
  address: ThreadAddress,
): Promise<Resolution> {
  if (address.form === 'default') {
    return { address: { form: 'default' }, memberCount: 0 };
  }

  const agents = await roster(config, project);

  if (address.form === 'direct') {
    if (address.department) {
      const hit = agents.find((a) => a.department === address.department && a.slug === address.slug);
      if (!hit) {
        throw new ApiError(
          'address_unresolved',
          `No agent "${address.department}/${address.slug}" in project "${project.slug}".`,
          {
            hint: `Check the name on the map. This project's library resolves ${agents.length} agent(s).`,
            retryable: false,
          },
        );
      }
      return { address: { form: 'direct', department: hit.department, slug: hit.slug }, memberCount: 0 };
    }

    const matches = agents.filter((a) => a.slug === address.slug);
    if (matches.length === 0) {
      throw new ApiError('address_unresolved', `No agent "${address.slug}" in project "${project.slug}".`, {
        hint: `Write it as "@department/${address.slug}" if you know the department, or check the name on the map.`,
        retryable: false,
      });
    }
    if (matches.length > 1) {
      throw new ApiError(
        'address_ambiguous',
        `"${address.slug}" exists in more than one department, so this message has no single recipient.`,
        {
          // The refusal lists the matches. It does not pick one, and it does not pick the
          // first — see the function's own doc comment for why that matters more than it looks.
          hint: `Say which: ${matches.map((m) => `@${m.department}/${m.slug}`).join(' or ')}.`,
          retryable: false,
        },
      );
    }
    const only = matches[0]!;
    return { address: { form: 'direct', department: only.department, slug: only.slug }, memberCount: 0 };
  }

  // `#department` and `@@department` — the department must exist in *this* project.
  const members = agents.filter((a) => a.department === address.department);
  if (members.length === 0) {
    const known = [...new Set(agents.map((a) => a.department))].sort();
    throw new ApiError(
      'address_unresolved',
      `No department "${address.department}" in project "${project.slug}".`,
      {
        hint: known.length
          ? `This project has: ${known.join(', ')}.`
          : 'This project resolves no agents at all, so it has no departments yet.',
        retryable: false,
      },
    );
  }
  return { address: { form: address.form, department: address.department }, memberCount: members.length };
}

/* -------------------------------------------------------------------------- *
 * Dispatchability — where an address stops being free
 * -------------------------------------------------------------------------- */

export interface Dispatchability {
  allowed: boolean;
  reason: string | null;
  unblockedBy: string | null;
}

/**
 * Can a run actually be started for this address today?
 *
 * **Creating a thread and messaging it are free; starting a run is what costs money**, so
 * this is advisory on `POST /thread` and *enforced* on `POST /run` — `assertRunnable` below
 * is the single branch, and it is called from the run pipeline rather than duplicated here.
 * Three of the four forms are refused, each for a reason that is somebody's named open
 * question rather than an omission:
 */
export function dispatchabilityOf(address: ResolvedThreadAddress, memberCount: number): Dispatchability {
  switch (address.form) {
    case 'direct':
      return { allowed: true, reason: null, unblockedBy: null };
    case 'fan-out':
      return {
        allowed: false,
        reason:
          `Fan-out would start ${memberCount} runs, and dispatch is held until the monthly cap ` +
          'has proven it can refuse one. Zero runs have ever executed, so no enforcement point ' +
          'in this product has ever fired.',
        unblockedBy: FAN_OUT_DISPATCH.unblockedBy,
      };
    case 'dispatch':
      return {
        allowed: false,
        reason:
          'Dispatch goes to a department lead, and nothing in the frontmatter schema marks an ' +
          'agent as a lead yet — so `#` has no target to run. The thread, the address and the ' +
          'preview all work; only the run does not.',
        unblockedBy: 'agent-library-curator: how a department lead is identified (thread-model.md §9.2)',
      };
    case 'default':
      return {
        allowed: false,
        reason:
          'A bare address means the Chief of Staff, which M16 defines as an *address* and not ' +
          'an agent. The router that would answer it is M22\'s (`Plan §17`). The message is ' +
          'kept and addressed honestly rather than quietly delivered somewhere else.',
        unblockedBy: 'M22 — Chief of Staff routing',
      };
  }
}

/**
 * **The enforcement point, and the only one.** Called by the run pipeline before a session
 * is spawned, and by nothing else.
 *
 * The fan-out branch delegates to `assertFanOutDispatchable`, which is
 * `thread-model-engineer`'s and throws `fanout_dispatch_refused` naming the count that would
 * have been spent. Its unproven status is not softened here: `FAN_OUT_DISPATCH.enforcementProven`
 * is `false` and **the cap has never refused anything, because no run has ever executed.**
 */
export function assertRunnable(thread: Pick<ThreadRow, 'kind' | 'delivery' | 'addressedTo'>, memberCount: number): void {
  if (thread.delivery === 'direct') return;
  if (thread.delivery === 'fan-out') assertFanOutDispatchable(memberCount);

  const form = thread.delivery === 'dispatch' ? 'dispatch' : 'default';
  const { reason, unblockedBy } = dispatchabilityOf(
    form === 'dispatch'
      ? { form: 'dispatch', department: thread.addressedTo }
      : { form: 'default' },
    memberCount,
  );
  throw new ApiError('address_unresolved', reason ?? 'This address cannot be run.', {
    hint: `Address one agent with @department/agent, which costs one run. Unblocked by: ${unblockedBy}.`,
    retryable: false,
  });
}

/* -------------------------------------------------------------------------- *
 * The routes
 * -------------------------------------------------------------------------- */

const toSummary = (row: ThreadRow): ThreadSummary => ({
  id: row.id,
  kind: row.kind,
  delivery: row.delivery,
  addressedTo: row.addressedTo,
  state: row.state,
  createdBy: row.createdBy,
  dueAt: row.dueAt,
  createdAt: row.createdAt,
});

/** `POST /api/p/:project/thread`. */
export async function createThreadFromLine(
  db: DbClient,
  config: RunnerConfig,
  project: MountedProject,
  request: CreateThreadRequest,
): Promise<CreateThreadResponse> {
  if (typeof request?.line !== 'string') {
    throw badRequest('A thread needs a line.', 'Send {"line": "@sales/account-enrichment do the thing"}.');
  }

  const parsed = parseThreadAddress(request.line);
  if (!parsed.ok) {
    // The parser's own code goes in the hint, which is written for the person typing —
    // `api-contracts.md`'s rule for `hint`, applied to the one refusal a human sees live.
    throw new ApiError('address_malformed', `"${parsed.refusal.token}" is not an address.`, {
      hint: parsed.refusal.hint,
      retryable: false,
    });
  }

  const { address, memberCount } = await resolveAddress(config, project, parsed.address);
  const { id } = await createThread(db, {
    projectId: project.id,
    subject: { via: 'address', address },
    createdBy: UNIDENTIFIED_HUMAN,
    dueAt: request.dueAt ?? null,
  });

  let message: ThreadMessageRef | null = null;
  if (parsed.body.length > 0) {
    const interrupt = request.interrupt ?? 'note';
    assertInterruptDeliverable(interrupt, 'open');
    const appended = await appendMessage(db, {
      threadId: id,
      kind: 'human',
      author: UNIDENTIFIED_HUMAN,
      body: parsed.body,
      interrupt,
    });
    message = {
      id: appended.id,
      seq: appended.seq,
      kind: 'human',
      interrupt,
      createdAt: new Date().toISOString(),
    };
  }

  const row = await readThread(db, project.id, id);
  if (!row) {
    // The row was written one statement ago and cannot be read back. That is this runner's
    // own state being wrong, not the caller's request — the same class as
    // `artifact_unattributed`, and it must not read as "no such thread".
    throw new ApiError('internal', `Thread ${id} was created and could not be read back.`, {
      hint: 'The thread store accepted the write and then did not return the row. Check the runner logs for this timestamp.',
    });
  }

  const cost = addressCost(address, memberCount);
  return {
    thread: toSummary(row),
    message,
    cost,
    dispatchable: dispatchabilityOf(address, memberCount),
  };
}

/**
 * A `steer` is **refused, never downgraded** (`thread-model.md` invariant 7).
 *
 * Two refusals, deliberately distinct in their hints because they send a person to two
 * different actions. The second one is the honest half of M16 and is written out in full at
 * `MID_RUN_STEER`: a steer with a run in flight is refused because this runner cannot inject
 * a turn into a live session — not because the human did anything wrong. Queueing it as a
 * note instead would be the exact failure the invariant names: they believe they changed
 * course, and nothing did.
 */
function assertInterruptDeliverable(interrupt: string, state: ThreadSummary['state']): void {
  if (interrupt !== 'steer') return;
  if (state !== 'running') {
    throw new ApiError('interrupt_not_deliverable', `This thread is "${state}", so there is no run in flight to steer.`, {
      hint: 'Send it as a note — it reaches the agent on this thread\'s next run. Or start a run first.',
      retryable: false,
    });
  }
  throw new ApiError('interrupt_not_deliverable', MID_RUN_STEER.reason, {
    hint:
      'Send a halt to stop this run now and be asked before it continues, or a note, which ' +
      `the agent reads on this thread's next run. Unblocked by: ${MID_RUN_STEER.unblockedBy}.`,
    retryable: false,
  });
}

/** `POST /api/p/:project/thread/:id/message`. */
export async function postThreadMessage(
  db: DbClient,
  project: MountedProject,
  threadId: string,
  request: PostThreadMessageRequest,
): Promise<PostThreadMessageResponse> {
  if (typeof request?.body !== 'string' || request.body.trim() === '') {
    throw badRequest('A message needs a body.', 'Send {"body": "…", "interrupt": "note"}.');
  }
  if (request.interrupt !== 'note' && request.interrupt !== 'steer' && request.interrupt !== 'halt') {
    // Declared by the sender, never inferred from context — so an absent level is a refusal
    // rather than a default. A defaulted `note` on a message somebody meant as a halt is a
    // run that keeps spending after a human told it to stop.
    throw badRequest(
      'A message must declare an interrupt level: note, steer or halt.',
      'note is queued for the next tool boundary; halt stops the run and asks; steer changes course mid-run.',
    );
  }

  const row = await readThread(db, project.id, threadId);
  if (!row) {
    throw new ApiError('thread_not_found', `No thread ${threadId} in "${project.slug}".`, {
      hint: 'That thread id does not belong to this project. Open it from the project it was created in.',
      retryable: false,
    });
  }
  if (row.state === 'closed') {
    throw new ApiError('thread_not_addressable', `Thread ${threadId} is closed.`, {
      hint: 'A closed thread is terminal. Start a new one to carry on this work.',
      retryable: false,
    });
  }

  assertInterruptDeliverable(request.interrupt, row.state);

  const kind = request.inReplyTo ? ('answer' as const) : ('human' as const);
  const appended = await appendMessage(db, {
    threadId,
    kind,
    author: UNIDENTIFIED_HUMAN,
    body: request.body,
    interrupt: request.interrupt,
    payload: request.payload ?? null,
    inReplyTo: request.inReplyTo ?? null,
  });

  return {
    message: {
      id: appended.id,
      seq: appended.seq,
      kind,
      interrupt: request.interrupt,
      createdAt: new Date().toISOString(),
    },
    // Read off the thread's own state rather than a second registry of live runs: `running`
    // *is* the fact that a run is in flight, and two places recording it is how the two
    // disagree. A halt does not move the state here — the run moves it when its drain reads
    // the halt, so this response says `running`, which is true until it stops.
    disposition: row.state === 'running' ? 'delivered-to-run' : 'queued',
    threadState: row.state,
  };
}

/** `GET /api/p/:project/thread/:id`. */
export async function readThreadDetail(
  db: DbClient,
  project: MountedProject,
  threadId: string,
): Promise<ThreadDetail> {
  const row = await readThread(db, project.id, threadId);
  if (!row) {
    throw new ApiError('thread_not_found', `No thread ${threadId} in "${project.slug}".`, {
      hint: 'That thread id does not belong to this project. Open it from the project it was created in.',
      retryable: false,
    });
  }
  const [messages, depth] = await Promise.all([
    readMessages(db, project.id, threadId),
    mailboxDepth(db, project.id, threadId),
  ]);
  return {
    thread: toSummary(row),
    messages: messages.map((m) => ({
      id: m.id,
      seq: m.seq,
      kind: m.kind,
      interrupt: m.interrupt,
      createdAt: m.createdAt,
      author: m.author,
      body: m.body,
      payload: m.payload,
      inReplyTo: m.inReplyTo,
      expiresAt: m.expiresAt,
      deliveredAt: m.deliveredAt,
    })),
    mailboxDepth: depth,
  };
}

/**
 * How many agents a thread's address resolves to — for the run path's fan-out refusal.
 *
 * Re-derived from the roster rather than stored on the thread, and that is deliberate: a
 * count frozen at creation time is a figure that silently goes stale the moment an agent is
 * added, and the whole point of `runsAreExact` is that the count is the one *real* number in
 * the preview. Cheap, because the roster is the same read `GET /api/agents` already does.
 */
export async function memberCountFor(
  config: RunnerConfig,
  project: MountedProject,
  thread: Pick<ThreadRow, 'kind' | 'addressedTo'>,
): Promise<number> {
  if (thread.kind !== 'department') return 0;
  const agents = await roster(config, project);
  return agents.filter((a) => a.department === thread.addressedTo).length;
}

/** Render an address back to what a person typed. Re-exported so routes need one import. */
export { formatThreadAddress, canonicalAddressedTo, DEFAULT_RECIPIENT };
