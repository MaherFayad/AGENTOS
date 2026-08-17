/**
 * Threads — the code half of `comms/contracts/thread-model.md` (ADR-023).
 *
 * Owner: `thread-model-engineer`.
 * Source: `AGENTOS-V2-PLAN.md` Plan §12 · §23.7 · §23.8 — **a plan that amends the spec of
 * record, not spec** (ADR-013). Cite `Plan §12`, never `§12`.
 *
 * > A thread is the unit. A run is a thread with an agent on the other end. A session is a
 * > thread hosted by a CLI. A task is a thread with a due date. A schedule creates threads.
 *
 * Three ideas run through this file, and each one is here because getting it wrong costs
 * something specific:
 *
 * 1. **`#` costs one run and `@@` costs N.** So the delivery mode is a *stored value*, never
 *    an inference from the thread's shape, and the cost preview is a function in shared code
 *    rather than a string built in a composer.
 * 2. **The count is real; the money is not.** There are no completed runs to average, so
 *    `estimatedUsd` is typed `null` — the *type*, not a comment. A future author who wants a
 *    figure has to widen the type in a reviewable diff and say where the number came from.
 *    Same instrument as `ProjectSummary.budgetMonthlyUsd` (ADR-015 Q6), for the same reason.
 * 3. **A message body is the highest-PII surface in this repo** — free text a human typed. So
 *    the projection an observability span may carry is a *type with no body field*, not a
 *    convention about which fields to omit. `PendingApprovalRef` earned that pattern the hard
 *    way in M15.
 *
 * Nothing here consults the department list. `Plan §10` says seven departments in one
 * sentence and an eighth in the next, and BOARD forbids baking `7` into anything
 * project-shaped: the grammar validates the *shape* of a department slug and resolution —
 * which is project-scoped, and not this file's — answers whether it exists.
 */

/* -------------------------------------------------------------------------- *
 * 1. The addressing grammar
 * -------------------------------------------------------------------------- */

/**
 * Kebab, one segment. The same shape as a project slug and a department slug, deliberately:
 * one identifier shape across the whole product means an address is greppable.
 *
 * Mirrored by `thread_addressed_to_shape` in migration `0008_threads.sql`. The test
 * `thread-address.test.ts` reads that migration and asserts the two agree, because two
 * implementations of one identifier shape is how a foreign key silently stops matching.
 */
export const ADDRESS_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The four forms a human can type. Each is a different amount of money.
 *
 * | Typed | Form | Runs |
 * |---|---|---|
 * | `@sales/account-enrichment`, `@account-enrichment` | `direct` | 1, exactly |
 * | `#sales` | `dispatch` | **at least** 1 — see `addressCost` |
 * | `@@sales` | `fan-out` | N, exactly, where N is the resolved member count |
 * | *(nothing)* | `default` | at least 1 — the Chief of Staff routes |
 */
export type AddressForm = 'direct' | 'dispatch' | 'fan-out' | 'default';

/**
 * A parsed address. `department: null` on a `direct` address means the human typed
 * `@account-enrichment` with no department — legal to *type*, and not yet an address:
 * resolution against the project's roster either finds exactly one match or refuses with
 * `address_ambiguous`. The parser does not guess, because guessing here picks an agent the
 * human did not mean, which is `Plan §21.9`'s bug class with no error message.
 */
export type ThreadAddress =
  | { form: 'direct'; department: string | null; slug: string }
  | { form: 'dispatch'; department: string }
  | { form: 'fan-out'; department: string }
  | { form: 'default' };

/** An address after roster resolution: every department is known. */
export type ResolvedThreadAddress =
  | { form: 'direct'; department: string; slug: string }
  | { form: 'dispatch'; department: string }
  | { form: 'fan-out'; department: string }
  | { form: 'default' };

/**
 * Why an address was refused. Parse-time only — these are answerable from the characters
 * alone, with no project, no roster and no database.
 *
 * `address_ambiguous` and `address_unresolved` are deliberately **not** here: both need a
 * project's resolved roster, so they belong to the resolution step and to the API's error
 * codes. Putting them in this union would invite a parser that pretends to know.
 */
export type AddressRefusalCode =
  /** A leading character that looks like a sigil and is not one of ours: `&sales`, `!sales`. */
  | 'unknown_sigil'
  /** A sigil with nothing after it: `@`, `#`, `@@`. */
  | 'empty_address'
  /** Right sigil, wrong shape: `@Sales`, `@sales/`, `@a/b/c`, `@sales//x`. */
  | 'malformed_address'
  /** `#sales/account-enrichment` — dispatch goes to a department, never to one agent. */
  | 'dispatch_needs_department'
  /** `@@sales/account-enrichment` — fan-out addresses a department, never one agent. */
  | 'fanout_needs_department';

export interface AddressRefusal {
  code: AddressRefusalCode;
  /** The token that was refused, verbatim, so a UI can point at it. */
  token: string;
  /**
   * Written to the person, not to a log — `api-contracts.md`'s rule for `hint`, applied to
   * the one refusal a human sees while typing. Never a stack trace.
   */
  hint: string;
}

export type AddressParse =
  | { ok: true; address: ThreadAddress; body: string }
  | { ok: false; refusal: AddressRefusal };

/** Characters that start an address. Anything else leading a line is body text. */
const SIGILS = ['@@', '@', '#'] as const;

/**
 * Characters that *look* like a sigil to a person and are not ours. Refusing them by name
 * beats treating them as body text: `&sales hello` silently sent to the Chief of Staff is a
 * message the human believes went to Sales.
 */
const SIGIL_LOOKALIKES = ['&', '!', '~', '%', '^', '*', '+', '/'] as const;

const segmentsOk = (parts: string[]): boolean =>
  parts.length > 0 && parts.every((p) => ADDRESS_SEGMENT_RE.test(p));

/**
 * Parse the leading address off a composed line. Total: it never throws, and every rejection
 * carries a code and a sentence a person can act on.
 *
 * A line with no sigil is **not** an error — it is the `default` address, which is the
 * Chief of Staff (`Plan §12`). `parseThreadAddress('')` is therefore `ok` with an empty body:
 * the address is well-formed and the message is empty, which is the caller's problem and a
 * different refusal.
 */
export function parseThreadAddress(input: string): AddressParse {
  const line = input.trimStart();
  const [token = '', ...restParts] = line.split(/\s+/);
  const body = line.slice(token.length).trim();

  const sigil = SIGILS.find((s) => token.startsWith(s));
  if (!sigil) {
    if (SIGIL_LOOKALIKES.some((c) => token.startsWith(c))) {
      return {
        ok: false,
        refusal: {
          code: 'unknown_sigil',
          token,
          hint: 'Addresses start with @ for one agent, # for a department lead, or @@ for every member of a department. Leave it off to reach the Chief of Staff.',
        },
      };
    }
    // No sigil at all: the whole line is the body and the recipient is the project default.
    void restParts;
    return { ok: true, address: { form: 'default' }, body: line.trim() };
  }

  const rest = token.slice(sigil.length);
  if (rest.length === 0) {
    return {
      ok: false,
      refusal: {
        code: 'empty_address',
        token,
        hint: `"${sigil}" needs a name after it, for example ${sigil === '#' ? '#sales' : sigil === '@@' ? '@@sales' : '@sales/account-enrichment'}.`,
      },
    };
  }

  const parts = rest.split('/');

  if (sigil === '#' || sigil === '@@') {
    if (parts.length > 1) {
      return {
        ok: false,
        refusal: {
          code: sigil === '#' ? 'dispatch_needs_department' : 'fanout_needs_department',
          token,
          hint:
            sigil === '#'
              ? `# goes to a department lead. Write "#${parts[0]}" to reach the lead, or "@${rest}" to reach that agent directly.`
              : `@@ asks every member of a department. Write "@@${parts[0]}" for the whole department, or "@${rest}" to reach that agent directly.`,
        },
      };
    }
    if (!segmentsOk(parts)) {
      return { ok: false, refusal: malformed(token) };
    }
    return {
      ok: true,
      address: sigil === '#'
        ? { form: 'dispatch', department: parts[0]! }
        : { form: 'fan-out', department: parts[0]! },
      body,
    };
  }

  // `@` — one agent, with or without its department.
  if (parts.length > 2 || !segmentsOk(parts)) {
    return { ok: false, refusal: malformed(token) };
  }
  return {
    ok: true,
    address:
      parts.length === 2
        ? { form: 'direct', department: parts[0]!, slug: parts[1]! }
        : { form: 'direct', department: null, slug: parts[0]! },
    body,
  };
}

const malformed = (token: string): AddressRefusal => ({
  code: 'malformed_address',
  token,
  hint: 'Names are lower-case words joined by hyphens, and an agent is at most "department/agent" — for example @sales/account-enrichment.',
});

/** Render an address back to what a person would type. The inverse of the parser. */
export function formatThreadAddress(address: ThreadAddress): string {
  switch (address.form) {
    case 'direct':
      return address.department ? `@${address.department}/${address.slug}` : `@${address.slug}`;
    case 'dispatch':
      return `#${address.department}`;
    case 'fan-out':
      return `@@${address.department}`;
    case 'default':
      // Deliberately empty: the bare address is what a person types by typing nothing. A
      // label for it ("Chief of Staff") is user-visible copy, which belongs in the RTL
      // catalogue and not in a contract module.
      return '';
  }
}

/* -------------------------------------------------------------------------- *
 * 2. The thread row
 * -------------------------------------------------------------------------- */

/** `Plan §12`'s four kinds, verbatim. Mirrored by `thread_kind_known` in 0008. */
export type ThreadKind = 'agent' | 'department' | 'project' | 'session';
export const THREAD_KINDS: readonly ThreadKind[] = ['agent', 'department', 'project', 'session'];

/**
 * How this thread's turns are delivered — the column `Plan §12` does not name and the schema
 * cannot do without.
 *
 * `#sales` and `@@sales` both produce a thread of kind `department`. They differ in exactly
 * one fact — one costs a run and the other costs N — and a schema that cannot represent the
 * difference between a $1 action and a $6 action has lost the thing the plan spends a
 * paragraph insisting on. So it is a stored value with a CHECK pinning it to `kind`, in the
 * shape of 0005's `account_provenance`.
 */
export type ThreadDelivery = AddressForm | 'session';
export const THREAD_DELIVERIES: readonly ThreadDelivery[] = [
  'direct',
  'dispatch',
  'fan-out',
  'default',
  'session',
];

/** The legal `(delivery, kind)` pairs. Mirrored by `thread_delivery_matches_kind` in 0008. */
export const DELIVERY_KIND: Readonly<Record<ThreadDelivery, ThreadKind>> = {
  direct: 'agent',
  dispatch: 'department',
  'fan-out': 'department',
  default: 'project',
  session: 'session',
};

export const threadDeliveryFor = (address: ThreadAddress): ThreadDelivery => address.form;
export const threadKindFor = (address: ThreadAddress): ThreadKind => DELIVERY_KIND[address.form];

/**
 * The project's default recipient (`Plan §12`: *"(no address) → Chief of Staff"*).
 *
 * **This is an address, not an agent.** M16 defines where a bare message is sent; the router
 * that would answer it is M22's (`Plan §17`). Until then a `default` thread is created and
 * its dispatch is refused with a stated reason — an address that resolves to nothing and says
 * so beats an address that quietly becomes something else.
 */
export const DEFAULT_RECIPIENT = 'chief-of-staff';

/**
 * The value stored in `ops.thread.addressed_to`: **project-relative**, because the project is
 * already the row's own column and `agent_ref`'s `{project}/…` prefix here would be a second
 * copy of one fact. 0005 kept both and pinned them with a CHECK; that is not available across
 * tables, so the redundancy is removed instead.
 *
 * | kind | stored | example |
 * |---|---|---|
 * | `agent` | `{department}/{slug}` — the same string as `ops.agent_runs.agent` | `sales/account-enrichment` |
 * | `department` | `{department}` | `sales` |
 * | `project` | `chief-of-staff` | `chief-of-staff` |
 * | `session` | the session id, opaque to this table | — |
 */
export function canonicalAddressedTo(address: ResolvedThreadAddress): string {
  switch (address.form) {
    case 'direct':
      return `${address.department}/${address.slug}`;
    case 'dispatch':
    case 'fan-out':
      return address.department;
    case 'default':
      return DEFAULT_RECIPIENT;
  }
}

/**
 * `open` is where a thread waits for its next turn; `closed` is the only terminal state.
 *
 * `failed` is deliberately **not** terminal. `Plan §12`: *continuing a thread starts a new run
 * seeded with the thread's history* — so retrying a failed thread is the ordinary path, and a
 * terminal `failed` would force every retry to be a new thread and lose the history that made
 * the retry worth doing.
 */
export type ThreadState = 'open' | 'running' | 'waiting' | 'closed' | 'failed';
export const THREAD_STATES: readonly ThreadState[] = [
  'open',
  'running',
  'waiting',
  'closed',
  'failed',
];

/**
 * The transition table. **This is the mechanism, and the database is not a second copy of
 * it** — 0008 constrains the *set* of legal values and says nothing about the order, because
 * two implementations of one rule drift and the drift is invisible until a thread is stuck.
 *
 * `waiting → failed` is the expiry path: a question nobody answered by `expires_at` fails the
 * thread loudly with `question_unanswered`. A run blocked forever on a question nobody saw
 * looks idle, holds a slot, and delivers nothing.
 */
export const THREAD_TRANSITIONS: Readonly<Record<ThreadState, readonly ThreadState[]>> = {
  open: ['running', 'closed'],
  running: ['open', 'waiting', 'failed', 'closed'],
  waiting: ['running', 'failed', 'closed'],
  failed: ['open', 'closed'],
  closed: [],
};

export function threadTransitionAllowed(from: ThreadState, to: ThreadState): boolean {
  return THREAD_TRANSITIONS[from].includes(to);
}

/** Throws with a sentence naming both states. Callers: the thread writer, and nothing else. */
export function assertThreadTransition(from: ThreadState, to: ThreadState): void {
  if (threadTransitionAllowed(from, to)) return;
  throw Object.assign(
    new Error(
      `A thread cannot go from "${from}" to "${to}". Legal from "${from}": ` +
        `${THREAD_TRANSITIONS[from].join(', ') || 'nothing — closed is terminal'}.`,
    ),
    { code: 'thread_transition_refused' },
  );
}

/* -------------------------------------------------------------------------- *
 * 3. Messages and the mailbox
 * -------------------------------------------------------------------------- */

/**
 * `Plan §19`: *a question **is** a message kind.* `ops.question` is not built as a standalone
 * entity, and neither is `ops.task` — a task is a thread with `due_at`.
 */
export type MessageKind = 'human' | 'agent' | 'question' | 'answer' | 'system';
export const MESSAGE_KINDS: readonly MessageKind[] = [
  'human',
  'agent',
  'question',
  'answer',
  'system',
];

/** `Plan §12`'s three interrupt levels, in increasing disruption. Declared by the sender. */
export type InterruptLevel = 'note' | 'steer' | 'halt';
export const INTERRUPT_LEVELS: readonly InterruptLevel[] = ['note', 'steer', 'halt'];

/**
 * Which kinds carry an interrupt level. A person's message always declares one — `note` is
 * the default and it is still a declaration. An agent's own output declares none.
 *
 * Mirrored by `message_interrupt_matches_kind` in 0008, which makes it an equality rather
 * than a convention: the level is present exactly when the kind is one of these.
 */
export const messageCarriesInterrupt = (kind: MessageKind): boolean =>
  kind === 'human' || kind === 'answer';

/**
 * `expires_at` is **mandatory on a question** — Part One's reasoning, unchanged and correct
 * (`Plan §12`). Mirrored by `message_question_expires` in 0008.
 */
export const messageRequiresExpiry = (kind: MessageKind): boolean => kind === 'question';

/**
 * A `steer` reaches a run that is in flight. Sent to a thread with no run running, it is
 * **refused**, never quietly downgraded to a note: a human who steered and was silently
 * queued believes they changed course, and nothing did.
 */
export const interruptRequiresRunningThread = (level: InterruptLevel): boolean => level === 'steer';

export interface ThreadMessage {
  id: string;
  threadId: string;
  projectId: string;
  /** Monotonic within a thread. `UNIQUE (thread_id, seq)` — a concurrent append fails loudly. */
  seq: number;
  kind: MessageKind;
  /** Present exactly when `messageCarriesInterrupt(kind)`. */
  interrupt: InterruptLevel | null;
  /** `human:{identity-slug}` · `agent:{department}/{slug}` · `system:{component}`. */
  author: string;
  /** **Free text a person typed. The highest-PII value in this repo.** See §4. */
  body: string;
  /**
   * Structured payload — a question's options, a halt's checkpoint reference.
   *
   * **An object, never a pre-flattened string,** and that is a PDPL requirement rather than a
   * style preference: key-based redaction walks object keys, and a string has none. Flattening
   * `{client_name, address, date_of_birth, salary}` into prose leaks four of five (found three
   * times in one night during M15 — the approvals summary, the plan span, and the redactor
   * itself). Compose the prose at the point of display, never before the point of storage.
   */
  payload: Record<string, unknown> | null;
  /** Set exactly when `kind === 'answer'`. */
  inReplyTo: string | null;
  /** Mandatory when `kind === 'question'`; null otherwise. */
  expiresAt: string | null;
  /** When a running agent drained it at a tool boundary. `null` ⇒ still in the mailbox. */
  deliveredAt: string | null;
  createdAt: string;
}

/**
 * The mailbox is not a table. It is `ops.message WHERE delivered_at IS NULL`, ordered by
 * `seq` — one place the messages live, one place the agent reads them, and no second entity
 * to keep in step with the first.
 */
export const isUndelivered = (m: Pick<ThreadMessage, 'deliveredAt'>): boolean =>
  m.deliveredAt === null;

/* -------------------------------------------------------------------------- *
 * 4. The observability projection — a type with no body field
 * -------------------------------------------------------------------------- */

/**
 * What a span may carry about a message.
 *
 * **There is no `body` field to add back.** That is the mechanism; a comment asking the next
 * author to omit it is not. M15 proved the difference twice — `lib/graph.ts` stopped importing
 * `RunnerConfig`, and `PendingApprovalRef` lost its `inputs` field — and in both cases the
 * wrong thing stopped compiling instead of stopping a reviewer.
 *
 * `bodyChars` is a length, and a length is not content. It is here because "the human sent
 * something and the agent read nothing" and "the human sent nothing" must be different rows on
 * a trace, and a boolean would collapse them.
 */
export interface MessageSpanAttributes {
  messageId: string;
  threadId: string;
  kind: MessageKind;
  interrupt: InterruptLevel | null;
  bodyChars: number;
  hasPayload: boolean;
  payloadKeys: number;
}

/**
 * Project a message down to what may leave the process as observability data.
 *
 * Redaction at instrumentation, not after (Part VII.4). This is the instrumentation point for
 * `ops.message`, and it redacts by **construction**: the body never enters the object, so
 * there is nothing downstream to redact and nothing to forget to redact.
 */
export function messageSpanAttributes(message: ThreadMessage): MessageSpanAttributes {
  return {
    messageId: message.id,
    threadId: message.threadId,
    kind: message.kind,
    interrupt: message.interrupt,
    bodyChars: message.body.length,
    hasPayload: message.payload !== null,
    payloadKeys: message.payload ? Object.keys(message.payload).length : 0,
  };
}

/* -------------------------------------------------------------------------- *
 * 5. What a turn costs — the count is real, the money is not
 * -------------------------------------------------------------------------- */

/**
 * The composer's preview (`Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`).
 *
 * **The `4` is knowable exactly. The `$0.40` has no source** — zero runs have ever executed,
 * so there is nothing to average, and a cost preview is precisely the surface where a
 * plausible number gets believed (BOARD rule 9). `estimatedUsd` is therefore typed as the only
 * value it may hold. The day real runs exist, making it a number **stops this file
 * compiling**, and the diff that widens it is the diff that has to say where the figure came
 * from.
 */
export interface TurnCost {
  /** How many runs this turn starts. */
  runs: number;
  /**
   * `false` ⇒ `runs` is a **lower bound**.
   *
   * `Plan §23.8` says `#sales` "says 1 run". That is the lead's own run; if the lead delegates
   * — which is what dispatch is *for* — the delegate's run is a second one. Printing a flat
   * "1 run" beside a mechanism that routinely costs two is the same defect as a plausible
   * zero, one decimal place up.
   */
  runsAreExact: boolean;
  /** No completed run exists to average. Typed `null`, not commented `null`. */
  estimatedUsd: null;
  estimateBasis: 'no-completed-runs';
}

/**
 * @param memberCount the **resolved** member count of the addressed department. Only read for
 *   `fan-out`; pass `0` for any other form. A caller that guesses this number has invented the
 *   one figure in the preview that was supposed to be real.
 *
 * **The parameter has no default, and that is the whole point of it.** It used to default to
 * `0`, which meant `addressCost(fanOutAddress)` returned `{ runs: 0, runsAreExact: true }` — an
 * *exactly zero* claim assembled out of a caller forgetting an argument. Two different states
 * collapsed into one number: a department that resolved and has no members, and a caller that
 * has not resolved a roster at all. That is this repo's house defect (a declared value read as
 * an observed one) sitting on the one figure in the composer that `Plan §23.8` requires to be
 * real. Raised by `design-system-guardian` while building `AddressBadge`, and fixed here rather
 * than in the badge, because a default is available to every caller and a badge protects one.
 *
 * Callers with nothing measured must not call this: the absence of a figure is the signal, and
 * `AddressBadge`'s `cost` prop takes `TurnCost | 'unresolved'` for exactly that.
 */
export function addressCost(address: ResolvedThreadAddress, memberCount: number): TurnCost {
  const base = { estimatedUsd: null, estimateBasis: 'no-completed-runs' } as const;
  switch (address.form) {
    case 'direct':
      return { runs: 1, runsAreExact: true, ...base };
    case 'fan-out':
      return { runs: memberCount, runsAreExact: true, ...base };
    case 'dispatch':
      // The lead answers *or delegates*, and a delegation is a second run.
      return { runs: 1, runsAreExact: false, ...base };
    case 'default':
      // The Chief of Staff triages, answers or routes. Routing costs a second run.
      return { runs: 1, runsAreExact: false, ...base };
  }
}

/**
 * Whether fan-out may actually **spawn** its N runs.
 *
 * Grammar, parser, composer and preview all ship in M16. The path that spends N× money does
 * not, and the reason is specific rather than cautious: `ops.project.budget_monthly` is
 * declared and unenforced (ADR-015 Q6), Part V's workspace cap is the only enforced ceiling,
 * and **it has never once refused anything, because zero runs have executed.** Fan-out would
 * be the first feature in this product whose first validation run costs N× money against an
 * enforcement point that has never fired.
 *
 * `allowed` is typed `false`. Flipping it is a type-level, reviewable act in the same commit
 * as whatever proves the cap refuses — not a config edit at 2am.
 */
export interface FanOutDispatchPolicy {
  allowed: false;
  /** Named, so "which cap?" is not a research task. */
  enforcementPoint: 'runner workspace cap (Part V)';
  /** It has never fired. Stated, not implied. */
  enforcementProven: false;
  unblockedBy: 'RUNNER_ANTHROPIC_API_KEY + one proven cap refusal';
}

export const FAN_OUT_DISPATCH: FanOutDispatchPolicy = {
  allowed: false,
  enforcementPoint: 'runner workspace cap (Part V)',
  enforcementProven: false,
  unblockedBy: 'RUNNER_ANTHROPIC_API_KEY + one proven cap refusal',
};

/**
 * The one branch that keeps `@@` from spending money in M16. Called by whatever would spawn
 * the N runs — `runner-engineer`'s dispatch path — and by nothing else.
 *
 * Deliberately a single reversible branch: the day the cap has proven a refusal, this function
 * and the type above are deleted in one diff. Grammar, parser, composer and preview all ship
 * now; only the spending does not.
 */
export function assertFanOutDispatchable(memberCount: number): never {
  throw Object.assign(
    new Error(
      `Fan-out would start ${memberCount} runs, and dispatch is refused until the monthly cap ` +
        'has proven it can refuse one. Zero runs have ever executed, so no enforcement point ' +
        'in this product has ever fired. The grammar, the preview and the thread all work; ' +
        'only the spending is held.',
    ),
    {
      code: 'fanout_dispatch_refused',
      hint: `Address one agent with @, or the department lead with #, which costs one run. Unblocked by: ${FAN_OUT_DISPATCH.unblockedBy}.`,
    },
  );
}
