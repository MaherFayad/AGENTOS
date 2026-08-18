/* =============================================================================
 * threads/lib/detail.ts — reading `GET /api/p/:project/thread/:id` defensively
 *
 * `parse` returning `null` means **"the route answered and it is not what we
 * agreed"**, which `useEndpoint` reports with its own sentence — never with the
 * not-built one. That distinction is not pedantry: collapsing the two is how the
 * cost ticker came to explain a database outage as *"this fills in the first time
 * an agent run is traced"*, a fluent and false story that closes the question.
 *
 * `null` is reserved for that and for nothing else. A thread that exists and has
 * no turns is a legitimate answer and is modelled as an empty `messages` array —
 * putting it in the failure bucket would report a real state as a bug.
 *
 * NODE-LOADABLE LEAF: `import type` only.
 * ========================================================================== */

import type {
  InterruptLevel,
  MessageKind,
  ThreadAddress,
  ThreadKind,
  ThreadState,
} from '@agnetos/contracts';

/** The runner's `ThreadSummary`, narrowed to what this view draws. */
export interface ThreadHeader {
  id: string;
  kind: ThreadKind;
  delivery: 'direct' | 'dispatch' | 'fan-out' | 'default' | 'session';
  /** `{department}/{slug}` · `{department}` · `chief-of-staff` · a session id. */
  addressedTo: string;
  state: ThreadState;
}

export interface ThreadTurn {
  id: string;
  seq: number;
  kind: MessageKind;
  /** Present exactly when a person sent it (`human` / `answer`). */
  interrupt: InterruptLevel | null;
  author: string;
  /** **Free text a person typed.** Rendered, never traced, never pushed. */
  body: string;
  /** `null` ⇒ still in the mailbox — the run has not drained it at a tool boundary. */
  deliveredAt: string | null;
}

export interface ThreadFeed {
  thread: ThreadHeader;
  /** Oldest first, as the route serves them. */
  messages: ThreadTurn[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const KINDS = ['agent', 'department', 'project', 'session'] as const;
const DELIVERIES = ['direct', 'dispatch', 'fan-out', 'default', 'session'] as const;
const STATES = ['open', 'running', 'waiting', 'closed', 'failed'] as const;
const MESSAGE_KINDS = ['human', 'agent', 'question', 'answer', 'system'] as const;
const LEVELS = ['note', 'steer', 'halt'] as const;

export function parseThreadDetail(json: unknown): ThreadFeed | null {
  if (!isRecord(json) || !isRecord(json.thread)) return null;
  const raw = json.thread;

  const id = str(raw.id);
  const kind = oneOf(raw.kind, KINDS);
  const delivery = oneOf(raw.delivery, DELIVERIES);
  const state = oneOf(raw.state, STATES);
  // `addressedTo` is `NOT NULL` in the schema and may not be empty, so a missing
  // one is drift rather than a state — the whole row is refused.
  const addressedTo = str(raw.addressedTo);
  if (id === null || kind === null || delivery === null || state === null || addressedTo === null) {
    return null;
  }

  const rawMessages = Array.isArray(json.messages) ? json.messages : null;
  if (rawMessages === null) return null;

  const messages: ThreadTurn[] = [];
  for (const entry of rawMessages) {
    if (!isRecord(entry)) return null;
    const messageId = str(entry.id);
    const messageKind = oneOf(entry.kind, MESSAGE_KINDS);
    const author = str(entry.author);
    const seq = typeof entry.seq === 'number' && Number.isFinite(entry.seq) ? entry.seq : null;
    if (messageId === null || messageKind === null || author === null || seq === null) return null;
    messages.push({
      id: messageId,
      seq,
      kind: messageKind,
      interrupt: oneOf(entry.interrupt, LEVELS),
      author,
      // A turn with an empty body is legal — a `question` can carry its options in
      // `payload` and say nothing in prose — so `''` is a value, not a failure.
      body: typeof entry.body === 'string' ? entry.body : '',
      deliveredAt: str(entry.deliveredAt),
    });
  }

  return { thread: { id, kind, delivery, addressedTo, state }, messages };
}

/**
 * The address this thread was opened with, reconstructed from the stored row.
 *
 * **`null` for a session thread**, and that is the answer to thread-model §9.1
 * rather than an omission: a session thread's `addressedTo` is an opaque relay
 * session id, the addressing grammar cannot express one (there is no sigil for it,
 * by design), and `AddressBadge` has no form to draw it with. Inventing a fifth
 * form so the badge always renders would put a session id into the vocabulary
 * `@` / `#` / `@@` reserves for agents and departments.
 */
export function addressOfSummary(thread: ThreadHeader): ThreadAddress | null {
  switch (thread.delivery) {
    case 'direct': {
      const [department, slug] = thread.addressedTo.split('/');
      return slug === undefined
        ? { form: 'direct', department: null, slug: department ?? '' }
        : { form: 'direct', department: department ?? '', slug };
    }
    case 'dispatch':
      return { form: 'dispatch', department: thread.addressedTo };
    case 'fan-out':
      return { form: 'fan-out', department: thread.addressedTo };
    case 'default':
      return { form: 'default' };
    case 'session':
      return null;
  }
}
