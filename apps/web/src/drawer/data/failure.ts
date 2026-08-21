/**
 * What went wrong, in the only four shapes the drawer can honestly tell apart.
 *
 * ## The defect this file exists to stop
 *
 * `LAST RUNS` and `WORK PRODUCTS` both led with *"Could not reach the runner"* for every
 * failure. On this stack the runner **answers**: `503 metrics_unavailable` ("This runner has
 * no run ledger configured") and `503 thread_store_unavailable` ("This runner has no thread
 * store"). So the drawer printed a sentence about the network, and then printed the runner's
 * own words underneath it, contradicting itself in two consecutive clauses — and it sent a
 * reader to look at a network that was working.
 *
 * The cost is bigger than the wording. Because *every* failure took the "unreachable" branch,
 * and because a 503 is not an empty list, the two honest empty states — *"No runs yet. The
 * first ▶ Run now writes the first row here."* and `work.empty` — have never been on a screen
 * in this build. They are reachable only with Postgres up, and nothing here says so.
 *
 * ## The rule
 *
 * **A 503 is never an empty list.** `metrics_unavailable` says the ledger could not be read;
 * rendering it as "no runs yet" is a plausible zero, which is the exact accident
 * `api-contracts.md` records (the runner lost a boot race with `initdb`, latched, and reported
 * "nothing has run" for a session). So this file changes *which sentence* is chosen, never
 * whether a failure becomes an empty list.
 *
 * ## Why `reach` and not just `code`
 *
 * `code` answers "what did the runner say" and is `undefined` for **two different events** —
 * a request that never left the browser (no project in the address, `scopedPath` refuses) and
 * one that left and got nothing back. Those are different news and the old code could not tell
 * them apart without matching on a message string, which is the failure family this repo keeps
 * paying for. `reach` is set at each of the three construction sites and has no default, so a
 * new one cannot be added without stating which it is.
 *
 * Owner: drawer-engineer
 */

/**
 * How far a request got. Set explicitly at every `ApiCallError` construction site; there is
 * deliberately **no default**, because the whole point is that the three used to be one.
 */
export type Reach =
  /** Nothing left the browser. The drawer refused to ask — there is no fault out there. */
  | 'not-sent'
  /** It left and nothing came back. `fetch` threw: offline, off the tailnet, no listener. */
  | 'no-answer'
  /** Something answered with a status line. The far end is up and it said no. */
  | 'answered';

export class ApiCallError extends Error {
  readonly hint?: string;
  /**
   * The runner's own `ApiErrorCode`, when it sent one.
   *
   * Added for M17: the diff screen has to tell `work_product_moved` (409) from
   * `work_product_unavailable` (410), and those are two completely different pieces of
   * news for the reader — *the tree changed under you, load it again* versus *the tree is
   * gone and there is nothing left to read*. Deciding that from the message string would
   * be a substring claim, which is the failure family this repo keeps paying for; the code
   * is the field the contract put there for it.
   *
   * `undefined` when the runner sent no JSON body (a proxy 502, a transport failure). That
   * is not a code and must not be turned into one — which is why `reach` exists beside it.
   */
  readonly code?: string;
  readonly reach: Reach;
  constructor(message: string, hint: string | undefined, code: string | undefined, reach: Reach) {
    super(message);
    this.name = 'ApiCallError';
    this.hint = hint;
    this.code = code;
    this.reach = reach;
  }
}

/**
 * One failure, one sentence-shape. `detail` is the far end's own words when there were any,
 * and `null` when the lead-in is the whole of what we know — appending a generic
 * "Could not reach the runner." after a lead-in that already says so is how the old branch
 * read as two contradictory sentences.
 */
export interface DrawerFailure {
  kind: 'not-sent' | 'unreachable' | 'refused' | 'unreadable';
  detail: string | null;
}

/**
 * A thrown thing, as news a person can act on.
 *
 * **Non-`ApiCallError` maps to `unreadable`, and that is a claim, so here is its warrant:**
 * the only way one reaches this function from either caller is a *normalizer* throwing on a
 * body that already arrived (`normalizeRuns`, `readList`'s array check). A response arrived
 * and this build could not read it — which is what `unreadable` says. A future call site that
 * can throw for some other reason must build its own `DrawerFailure` rather than fall through
 * here; falling through would put a sentence about the runner over a fault in this app.
 */
export function failureOf(error: unknown): DrawerFailure {
  if (!(error instanceof ApiCallError)) return { kind: 'unreadable', detail: null };
  switch (error.reach) {
    case 'not-sent':
      // The client's own refusal is the entire sentence and it names the fix. No lead-in
      // is added over it: nothing out there failed, so nothing out there may be blamed.
      return { kind: 'not-sent', detail: error.message };
    case 'no-answer':
      return { kind: 'unreachable', detail: null };
    case 'answered':
      return { kind: 'refused', detail: [error.message, error.hint].filter(Boolean).join(' ') };
  }
}
