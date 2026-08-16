'use client';

import { COST_TICKER_ROUTE, type LedgerState } from '@agnetos/contracts';
import { useEndpoint } from './useEndpoint';
import { useShell } from './ShellContext';
import { NO_PROJECT_SENTENCE, projectApiUrl } from './useSearchIndex';

/**
 * §2.0 / §3.5: the cost ticker beside the status pill — `$12.40 today`, from
 * `GET /api/cost/today` (Langfuse + the run ledger, owned by `observability-engineer`
 * and `runner-engineer`).
 *
 * Same monochrome type style as the status pill. It is **not** a coloured badge: spend
 * is not a status, and turning it red at some threshold would be a colour we invented.
 *
 * ---
 *
 * **Three absences, three sentences.** This component's whole difficulty is that "no
 * number" has more than one cause, and until 2026-08-16 it had one sentence:
 *
 * > "Langfuse isn't reporting spend yet… This fills in the first time an agent run is
 * > traced."
 *
 * With Postgres stopped, `/api/cost/today` still answers **200** — the ticker is chrome
 * and must not error out — with `{usd:null, runs:null, ledger:{state:"unreachable"}}`.
 * `parseCost` read only `usd`, so the outage arrived as the same `null` as an honest
 * empty, and the shell told the reader, in the `title` *and* the `sr-only` text, that
 * nothing was wrong. That is not a plausible zero, it is a **plausible narrative**, and it
 * is worse: a wrong number invites doubt, a fluent explanation closes the question
 * (BOARD rule 9 / Part VII.3; `fidelity-qa-reviewer` FAIL 2026-08-16T22:30).
 *
 * So the reading is a value, not an absence, and `ledger.state` is what decides which
 * one — `unknown` is not `zero` (`contracts/api-contracts.md`):
 *
 * | `ledger.state` | body | reading | pill |
 * |---|---|---|---|
 * | `connected` | `usd` is a number | the number | `$12.40 today` |
 * | `connected` | `usd:null, runs:0` | nothing has been spent — a real zero | `$0.00 today` |
 * | `connected` | `usd:null, runs>0` | runs happened, none priced — unknown | `not priced` |
 * | `unreachable` | `usd:null, runs:null` | we cannot currently tell you | `spend unknown` |
 * | `absent` | `usd:null, runs:null` | no ledger configured (`--profile dev`) | `no ledger` |
 *
 * `absent` is a **configuration, not a fault**: `depends_on: postgres: {required:false}`
 * makes running without a database a legitimate dev profile, so this state must not shout
 * an outage at someone who deliberately started without one.
 *
 * **The visible label carries the distinction, not just the tooltip.** A phone has no
 * hover, so `title` reaches nobody on touch; `sr-only` reaches screen readers only. If the
 * five cases looked identical to a sighted touch user, the fix would only have moved the
 * false story somewhere quieter.
 *
 * ---
 *
 * ## M15 adds a sixth question, on a different axis: *whose* spend is this?
 *
 * The five states above answer **what the number is**. The project axis (`Plan §9`,
 * `Plan §23.10`) asks **what it is a number about** — *this project has spent nothing*
 * versus *we cannot read this project's spend* — and a project filter that gets it wrong
 * manufactures a confident **attribution** rather than a confident zero. Same disease,
 * different organ.
 *
 * The answer here is narrower than the one I first built, because the contract is
 * narrower. `COST_TICKER_ROUTE` is `/api/p/:project/cost/today` and the pre-project
 * spelling is still mounted, answering 400 `project_scope_missing`, with this attached to
 * it in as many words:
 *
 * > *"It is not a fallback and must not be used as one: the ticker is chrome and must not
 * > error out on an unknown value, but a missing project segment is a client fault with a
 * > one-line fix, and answering it with a plausible `usd: null` would hide the migration
 * > from the only people who can finish it."*
 *
 * So there is **no fallback and no `coordinator` scope**. Two states, not three:
 *
 * | `data-cost-scope` | when | shown |
 * |---|---|---|
 * | `project` | the URL names a project and the scoped route answered | the five readings above, unqualified |
 * | `unscoped` | the URL names no project | no figure at all, and the reason |
 *
 * The consequence is worth stating positively rather than as a caveat: **there is no
 * state in which this pill shows a real number about the wrong project.** A design with a
 * fallback would have had one, correctly labelled — and a correct label is a weaker
 * guarantee than an impossible state.
 */

const COST_INTERVAL_MS = 60_000;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * What the endpoint told us, as a value.
 *
 * `outage` and `noLedger` are **readings, not failures** — the request succeeded and the
 * answer was "unknown". Keeping them out of the hook's `unavailable` state is what lets
 * each one carry its own label and its own sentence.
 *
 * `Plan §23.10` adds an account split (`work $12.40 · personal $3.10`). That lands as a
 * field on `amount`, not as a second component: the formatter, the plural-free copy and
 * the four unknown-shaped cases are all reusable as they stand.
 */
type CostReading =
  | { kind: 'amount'; usd: number }
  | { kind: 'zero' }
  | { kind: 'unpriced' }
  | { kind: 'outage'; hint: string }
  | { kind: 'noLedger'; hint: string };

const LEDGER_STATES: readonly LedgerState[] = ['connected', 'unreachable', 'absent'];

function readLedgerState(value: unknown): LedgerState | null {
  if (typeof value !== 'object' || value === null) return null;
  const { state } = value as Record<string, unknown>;
  return LEDGER_STATES.find((known) => known === state) ?? null;
}

/** The runner's own sentence, written for a phone. Empty string ⇒ use ours. */
function readLedgerHint(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const { hint } = value as Record<string, unknown>;
  return typeof hint === 'string' ? hint.trim() : '';
}

/**
 * `null` here means only "this body is not the one the contract describes" — which is
 * now its own sentence, not the not-built one.
 *
 * A body carrying `usd: null` and **no** readable `ledger.state` is exactly that case: it
 * is unreadable *precisely because* it cannot distinguish a real zero from an outage, so
 * guessing either would be inventing the answer this component exists to stop inventing.
 */
export function parseCost(json: unknown): CostReading | null {
  if (typeof json !== 'object' || json === null) return null;
  const body = json as Record<string, unknown>;

  const { usd, runs } = body;
  // A number is a number whatever the ledger says — it was read from somewhere.
  if (typeof usd === 'number' && Number.isFinite(usd)) return { kind: 'amount', usd };
  if (usd !== null && usd !== undefined) return null;

  const state = readLedgerState(body.ledger);
  if (state === null) return null;
  const hint = readLedgerHint(body.ledger);
  if (state === 'unreachable') return { kind: 'outage', hint };
  if (state === 'absent') return { kind: 'noLedger', hint };

  // Connected: `runs` is the machine-readable half of the distinction. `0` is zero runs;
  // anything we cannot read as a count is not a licence to draw a zero.
  if (runs === 0) return { kind: 'zero' };
  if (typeof runs === 'number' && Number.isFinite(runs) && runs > 0) return { kind: 'unpriced' };
  return null;
}

/**
 * Copy. Held in a const map so the five cases sit side by side and can be read as a set —
 * which is how the missing one got noticed.
 *
 * NOTE for `rtl-arabic-pdpl-specialist`: these are literal English and `check-rtl.mjs`
 * cannot see them (it matches JSX text nodes and a fixed list of JSX attributes; a string
 * in an object literal is invisible to it). They are **not** silently absent from your
 * count — proposed keys `shell.cost.*` are listed in the handoff. Two of the five
 * sentences are only fallbacks: the runner ships a written `ledger.hint` for `unreachable`
 * and `absent`, and that hint is English-only server copy, so under `lang=ar` the
 * catalogue sentence should win over the hint rather than the other way round.
 */
/**
 * The five pill labels that are not a figure. `amount` and `zero` are formatted from the
 * reading itself, so they are not in here. Lower case on purpose: the caps are
 * `text-transform` (§1.4), which is a no-op in Arabic — a SHOUTED string in source would
 * arrive in Arabic as nothing at all.
 */
const LABEL = {
  unpriced: 'not priced',
  outage: 'spend unknown',
  noLedger: 'no ledger',
  loading: '…',
  unavailable: 'no cost data',
} as const;

const COPY = {
  loading: "Checking today's agent spend.",
  zero:
    'No agent run has been recorded today, so nothing has been spent. The run ledger is ' +
    'connected, so this zero is a reading rather than a guess.',
  unpriced:
    "Runs were recorded today but none of them carries a price yet, so today's spend is " +
    'not known. This is not zero.',
  outageFallback:
    "The run ledger is not answering, so today's spend is unknown — not zero. Runs still " +
    'work and will be recorded once the database is back.',
  noLedgerFallback:
    'This runner has no run ledger configured, so there is no spend to read. That is ' +
    'normal on the dev profile, not a fault.',
  /**
   * 404 on `/api/p/:project/cost/today`. Two causes and one honest sentence: either
   * Langfuse has never been asked for this project, or this runner predates the project
   * axis and only answers the old spelling. Both are "this runner does not answer the
   * question", and neither is a fact about your spend.
   */
  notBuilt:
    "This runner doesn't answer today's spend for this project yet, so there is no number to show here. It fills in the first time a run in this project is traced.",
  malformed:
    "Today's spend came back in a shape this build does not understand — without it, a " +
    'real zero and a ledger outage look identical, so no number is shown. That is a bug ' +
    'here, not a fact about your spend.',
  offline: "Couldn't reach Langfuse for today's spend. This box may be off the tailnet.",
} as const;

/** Which spend this is. `unscoped` ⇒ the URL named no project, so nothing was asked. */
type CostScope = 'project' | 'unscoped';

function labelFor(reading: CostReading): string {
  if (reading.kind === 'amount') return `${money.format(reading.usd)} today`;
  // A confirmed-connected ledger with no runs today is a real zero, and a real zero is
  // information. It is drawn only here — never as a stand-in for a number we lack.
  if (reading.kind === 'zero') return `${money.format(0)} today`;
  return LABEL[reading.kind];
}

function sentenceFor(reading: CostReading): string {
  switch (reading.kind) {
    case 'amount':
      return `Agent spend so far today: ${money.format(reading.usd)}.`;
    case 'zero':
      return COPY.zero;
    case 'unpriced':
      return COPY.unpriced;
    case 'outage':
      return reading.hint || COPY.outageFallback;
    case 'noLedger':
      return reading.hint || COPY.noLedgerFallback;
  }
}

export function CostTicker(): React.JSX.Element {
  const { route } = useShell();
  // `null` when the URL names no project — and `null` means *do not ask*, not *ask the
  // pre-project route*. See the header: that route is now a deliberate 400.
  const url = projectApiUrl(COST_TICKER_ROUTE.path, route.project);
  const scope: CostScope = url === null ? 'unscoped' : 'project';

  const cost = useEndpoint<CostReading>(url, {
    intervalMs: COST_INTERVAL_MS,
    noTargetMessage: NO_PROJECT_SENTENCE,
    parse: parseCost,
    notBuiltMessage: COPY.notBuilt,
    malformedMessage: COPY.malformed,
    offlineMessage: COPY.offline,
  });

  const text =
    cost.state === 'ready'
      ? labelFor(cost.data)
      : cost.state === 'loading'
        ? LABEL.loading
        : LABEL.unavailable;

  const sentence =
    cost.state === 'ready'
      ? sentenceFor(cost.data)
      : cost.state === 'loading'
        ? COPY.loading
        : cost.message;

  return (
    <div
      title={sentence}
      // The reading, in one word, for anyone auditing the standing acceptance case
      // ("stop Postgres, confirm no surface shows a plausible zero") without reading copy.
      data-cost-state={cost.state === 'ready' ? cost.data.kind : cost.state}
      // The second axis, asserted the same way: "is this figure about the project the URL
      // names?" is a separate question from "is this figure real", and a test that can
      // only see the first would pass on a correctly-drawn number about the wrong thing.
      //
      // Printed in every state, not only `ready`: scope is decided by the URL before any
      // request is made, so "we asked about nothing" is exactly the case an auditor most
      // needs to be able to read off the DOM.
      data-cost-scope={scope}
      className="pointer-events-auto whitespace-nowrap rounded-pill border border-line bg-card px-3 py-1.5 text-label-sm uppercase tracking-wider-1 text-ink-2 tabular-nums"
    >
      <span>{text}</span>
      <span className="sr-only">{sentence}</span>
    </div>
  );
}
