/**
 * Panel query → `QueryResult`, given a bag of already-fetched responses.
 *
 * Pure. Widgets never talk to transport and this module never fetches — `use-resolved.tsx`
 * owns the network, this owns the meaning. That split is what makes the interesting parts
 * (the receipt check, the completeness check, the zero-vs-null grammar) testable under
 * `node --test` without a browser or a server.
 *
 * THE EMPTY-STATE GRAMMAR, which is the load-bearing rule in here:
 *
 *   `value: 0`    → `ok` → the tile prints `0`.  A `count(*)` of zero is a measurement.
 *   `value: null` → `empty` → the tile prints "No figure yet."  The median latency of no
 *                   runs is not a measurement, and `0ms` would be a claim nobody made.
 *
 * `observability-engineer` was deliberate about that distinction on the server
 * (Part VII.3); collapsing it here would throw away the honesty it was built for. Nothing
 * in this file coalesces `null` to `0`, in either direction.
 *
 * `$range` is bound before anything leaves the browser.
 *
 * Owner: dashboards-engineer · Spec §2.5 · contracts/panel-schema.md
 */

import type { LangfuseQuery, PanelQuery, QueryResult, ResolveContext } from '@agnetos/contracts';
import { labelFromSlug, normalizeRuns } from '../lib/runs';
import { bindRange } from './bind';
import {
  FILTER_NOT_APPLIED,
  planLangfuse,
  urlsOf,
  type AppliedFilter,
  type Plan,
  type PlanOptions,
} from './endpoints';

export { bindRange, planLangfuse, urlsOf };

/* ---------------------------------------------------------------- transport */

/** One fetched URL, as `use-resolved.tsx` records it. */
export type Entry =
  | { state: 'loading' }
  | { state: 'ready'; json: unknown }
  | { state: 'unavailable'; message: string };

export type ReadEntry = (url: string) => Entry;

export type ResolvedState = QueryResult & { loading: boolean };

export const METRICS_NOT_BUILT =
  'The runner has not exposed the metrics API yet, so there is no history to read. Ops KPIs stay empty rather than guessed.';

export const METRICS_OFFLINE =
  'Cannot reach the runner, so ledger-backed numbers are unavailable. This box may be off the tailnet.';

/**
 * Deliberately carries **no message**. A `sql` widget's `emptyState` is mandatory
 * (`scripts/validate-panels.mjs`) and names the agent that will fill it — "the
 * cost-tracker agent writes this table on its first run" — which is a better sentence
 * than any generic one this module could write. A resolver message only wins where the
 * panel could not have known the reason, i.e. a langfuse shape with no route behind it.
 */
const SQL_UNAVAILABLE: QueryResult = { status: 'unavailable' };

const ok = (data: unknown, message?: string): ResolvedState => ({
  status: 'ok',
  data,
  ...(message ? { message } : {}),
  loading: false,
});
const empty = (): ResolvedState => ({ status: 'empty', loading: false });
const loading = (): ResolvedState => ({ status: 'empty', loading: true });
const unavailable = (message: string): ResolvedState => ({ status: 'unavailable', message, loading: false });

/* ------------------------------------------------------------------ helpers */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const rowsOf = (json: unknown): unknown[] => {
  if (!isObj(json)) return [];
  return Array.isArray(json.rows) ? json.rows : [];
};

/**
 * Resolve a plan's URLs to a single verdict before any of them is read for content.
 * Loading wins over unavailable: a half-loaded widget is still loading, and flipping it
 * to an error sentence for one tick is a flicker that reads as a failure.
 */
function gate(plan: Plan, read: ReadEntry): ResolvedState | null {
  const entries = urlsOf(plan).map(read);
  if (entries.some((e) => e.state === 'loading')) return loading();
  const broken = entries.find((e): e is { state: 'unavailable'; message: string } => e.state === 'unavailable');
  return broken ? unavailable(broken.message) : null;
}

const bodyOf = (entry: Entry): Record<string, unknown> | null =>
  entry.state === 'ready' && isObj(entry.json) ? entry.json : null;

/**
 * Did the route apply the filter we asked for?
 *
 * `/api/metrics/query` echoes `filter` in its response. A filter it silently dropped —
 * `status` is dropped today — would otherwise come back as an unfiltered aggregate under
 * a filtered label, which is the exact shape of a number that is wrong and looks right.
 * So the echo is treated as a receipt, and a missing receipt withholds the figure.
 */
function receiptMatches(body: Record<string, unknown>, want: AppliedFilter): boolean {
  const echoed = isObj(body.filter) ? body.filter : {};
  return Object.entries(want).every(([key, value]) => echoed[key] === value);
}

/* --------------------------------------------------------------- resolution */

/**
 * The whole resolution: bind `$range`, pick a plan, read the responses it needs, and
 * shape them for the widget. `plan` may be supplied by the provider (which knows the
 * widget type and can therefore route an `activity-feed` to the activity route).
 */
export function resolveQuery(
  query: PanelQuery,
  read: ReadEntry,
  ctx: ResolveContext = {},
  plan?: Plan,
  options: PlanOptions = {},
): ResolvedState {
  const bound = ctx.range ? bindRange(query, ctx.range) : query;

  if (bound.source === 'sql') return { ...SQL_UNAVAILABLE, loading: false };
  if (bound.source === 'static') return ok(bound.value);

  const langfuse = bound as LangfuseQuery;
  const chosen = plan ?? planLangfuse(langfuse, options);

  if (chosen.kind === 'unsupported') return unavailable(chosen.message);

  const blocked = gate(chosen, read);
  if (blocked) return blocked;

  switch (chosen.kind) {
    case 'scalar':
      return resolveScalar(chosen, read);
    case 'runs-series':
      return resolveRunsSeries(chosen, read);
    case 'cost-by-agent':
      return resolveCostByAgent(chosen, read);
    case 'runs-by-department':
      return resolveRunsByDepartment(chosen, read);
    case 'runs-list':
      return resolveRunsList(chosen, read);
    case 'activity':
      return resolveActivity(chosen, read);
    default: {
      const never: never = chosen;
      return never;
    }
  }
}

/* ------------------------------------------------------------------ scalars */

function resolveScalar(plan: Extract<Plan, { kind: 'scalar' }>, read: ReadEntry): ResolvedState {
  const body = bodyOf(read(plan.url));
  if (!body) return unavailable(METRICS_NOT_BUILT);
  if (!receiptMatches(body, plan.want)) return unavailable(FILTER_NOT_APPLIED);

  if (plan.delta) {
    // The chip compares against the server's own previous window. Computing it here from
    // two numbers would be a second opinion nobody asked for, and `delta: null` already
    // means "no honest comparison to draw" — no previous window, or a previous zero.
    const delta = numOrNull(body.delta);
    return delta === null ? empty() : ok(delta);
  }

  const value = numOrNull(body.value);
  if (value === null) return empty();
  return ok(value, unpricedNote(body));
}

/**
 * "10 of 121 runs unpriced" — appended to the spend tile's caption.
 *
 * A run whose cost was never recorded is not a free run, so a spend figure standing over
 * unpriced runs is a floor, not a total. `/api/metrics/query` returns the count precisely
 * so a caller can say that out loud; saying nothing would round the caveat to zero.
 */
function unpricedNote(body: Record<string, unknown>): string | undefined {
  if (body.metric !== 'cost') return undefined;
  const unpriced = numOrNull(body.unpricedRuns) ?? 0;
  if (unpriced <= 0) return undefined;
  const runs = numOrNull(body.runs);
  return runs === null ? `${unpriced} unpriced` : `${unpriced} of ${runs} unpriced`;
}

/* ------------------------------------------------------------------- series */

function resolveRunsSeries(plan: Extract<Plan, { kind: 'runs-series' }>, read: ReadEntry): ResolvedState {
  const entry = read(plan.url);
  const points = rowsOf(entry.state === 'ready' ? entry.json : null)
    .map((row) => {
      if (!isObj(row)) return null;
      const t = typeof row.t === 'string' ? row.t : null;
      const v = numOrNull(row.v);
      return t === null || v === null ? null : { t, v };
    })
    .filter((p): p is { t: string; v: number } => p !== null);
  return points.length === 0 ? empty() : ok(points);
}

/* --------------------------------------------------------------- breakdowns */

function resolveCostByAgent(plan: Extract<Plan, { kind: 'cost-by-agent' }>, read: ReadEntry): ResolvedState {
  const entry = read(plan.url);
  const rows = rowsOf(entry.state === 'ready' ? entry.json : null);
  const out = rows
    .map((row) => {
      if (!isObj(row)) return null;
      const label = typeof row.label === 'string' ? row.label : null;
      const value = numOrNull(row.value);
      // An agent whose every run went unpriced has `value: null`. It contributes nothing
      // to the total either way, and printing `$0.00` beside its name would read as a
      // free agent rather than an unmeasured one — so the row is dropped, and the agents
      // that *are* priced carry the unpriced count in their sub-label.
      if (label === null || value === null) return null;
      const runs = numOrNull(row.runs);
      const unpriced = numOrNull(row.unpriced) ?? 0;
      const ran = runs === null ? null : `${runs} ${runs === 1 ? 'run' : 'runs'}`;
      const sub = ran === null ? undefined : unpriced > 0 ? `${ran} · ${unpriced} unpriced` : ran;
      return { label: labelFromSlug(label), value, ...(sub ? { sub } : {}) };
    })
    .filter((r): r is { label: string; value: number; sub?: string } => r !== null);
  return out.length === 0 ? empty() : ok(out);
}

/**
 * Runs per department, assembled from one server-side `count(*)` per department.
 *
 * The completeness check is the point: the parts must sum to the ungrouped count over the
 * identical window. If they do not, some runs sit in a department this list does not know
 * about, and a bar list that quietly omits them is an undercount that looks like data.
 * So it refuses instead — the same instinct as the truncation guard it replaces.
 */
function resolveRunsByDepartment(
  plan: Extract<Plan, { kind: 'runs-by-department' }>,
  read: ReadEntry,
): ResolvedState {
  const totalBody = bodyOf(read(plan.totalUrl));
  if (!totalBody || !receiptMatches(totalBody, {})) return unavailable(METRICS_NOT_BUILT);
  const total = numOrNull(totalBody.value);
  if (total === null) return empty();

  const rows: { label: string; value: number }[] = [];
  let counted = 0;
  for (const part of plan.parts) {
    const body = bodyOf(read(part.url));
    if (!body || !receiptMatches(body, { department: part.slug })) return unavailable(FILTER_NOT_APPLIED);
    const value = numOrNull(body.value) ?? 0;
    counted += value;
    // A department with no runs in the window is not a bar; it is an absence. Its zero
    // still counts toward the completeness check above.
    if (value > 0) rows.push({ label: labelFromSlug(part.slug), value });
  }

  if (counted !== total) {
    return unavailable(
      `${total} runs ran in this window but only ${counted} fall in a known department, so this split is withheld.`,
    );
  }
  return rows.length === 0 ? empty() : ok(rows.sort((a, b) => b.value - a.value));
}

/* -------------------------------------------------------------------- lists */

function resolveRunsList(plan: Extract<Plan, { kind: 'runs-list' }>, read: ReadEntry): ResolvedState {
  const entry = read(plan.url);
  const runs = normalizeRuns(entry.state === 'ready' ? entry.json : null);
  const since = plan.sinceHours === null ? null : Date.now() - plan.sinceHours * 3_600_000;
  const rows = (since === null ? runs : runs.filter((r) => Date.parse(r.startedAt) >= since)).slice(0, plan.limit);
  return rows.length === 0 ? empty() : ok(rows);
}

/**
 * The activity feed. Agent runs ARE the activity (§2.5 data note), and the runner already
 * writes the human sentence — `activity_event` / `activity_detail` on the run row — so
 * this maps rather than composes. Composing it here would give the same run two different
 * sentences depending on which view you read it in.
 */
function resolveActivity(plan: Extract<Plan, { kind: 'activity' }>, read: ReadEntry): ResolvedState {
  const entry = read(plan.url);
  const json = entry.state === 'ready' ? entry.json : null;
  const items = isObj(json) && Array.isArray(json.items) ? json.items : [];
  const rows = items
    .map((item) => {
      if (!isObj(item)) return null;
      const at = typeof item.at === 'string' ? item.at : null;
      const event = typeof item.event === 'string' ? item.event : null;
      const agent = typeof item.agent === 'string' ? item.agent : null;
      if (at === null || event === null) return null;
      const attribution =
        typeof item.agentName === 'string' && item.agentName.trim() !== ''
          ? item.agentName
          : agent === null
            ? null
            : labelFromSlug(agent);
      if (attribution === null) return null;
      const detail = typeof item.detail === 'string' ? stripAttribution(item.detail, attribution) : undefined;
      const status = item.status === 'error' || item.status === 'running' ? item.status : 'ok';
      const traceUrl = typeof item.traceUrl === 'string' ? item.traceUrl : undefined;
      return {
        at,
        event,
        attribution,
        ...(detail ? { detail } : {}),
        status,
        ...(traceUrl ? { traceUrl } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, plan.limit);
  return rows.length === 0 ? empty() : ok(rows);
}

/**
 * The ledger's `activity_detail` already ends with "— Agent Name", and the feed row
 * renders the attribution itself. Left alone the row reads "… — Agent Auditor — Agent
 * Auditor", which looks like a bug because it is one.
 */
export function stripAttribution(detail: string, attribution: string): string {
  const suffix = `— ${attribution}`;
  const trimmed = detail.trimEnd();
  return trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length).trimEnd() : trimmed;
}
