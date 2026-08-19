/**
 * Panel definitions — the code half of `comms/contracts/panel-schema.md`.
 *
 * Owner: `dashboards-engineer`. The prose contract is normative (ADR-002); this file is
 * hand-derived from it and `scripts/validate-panels.mjs` parity-checks its own enum copies
 * against the `as const` arrays below, so the three cannot drift silently.
 *
 * Deliberately zero imports. The web app, the runner and a dependency-free Node script all
 * consume these names; a dependency here would become a dependency everywhere.
 *
 * The governing rule (§2.5): dashboards are data, not code. Every shape below exists so
 * that adding a Command Center is adding a JSON file.
 */

/** Bumped when a change to these shapes is not backwards compatible. */
export const PANEL_SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ enums */

/**
 * The seven canonical widget types (§2.5.5). They cover every widget observed in the
 * video. **This array never grows** — ADR-028.
 */
export const CANONICAL_WIDGET_TYPES = [
  'bar-list',
  'source-bar-list',
  'area-chart',
  'cost-table',
  'data-table',
  'progress-table',
  'activity-feed',
] as const;

/**
 * ADR-028 — **exactly three new widget types, ever.** This is the whole allowance, and it
 * is a closed list of *names*, not a budget of slots: a fourth need does not spend a spare,
 * because there is none. Everything else composes from the seven above (`Plan §23.7`) —
 * an agent roster is a `data-table`, budget burn is a `progress-table`, a question queue is
 * an `activity-feed`.
 *
 * Widening this list is a reversal of ADR-028, not an application of it, and two gates say
 * so: `WIDGET_TYPE_EXTENSIONS_USED` below stops compiling, and `checkContractParity()` in
 * `scripts/validate-panels.mjs` rejects both a fourth entry and a name that is not one of
 * these three.
 */
export const EXTENSION_WIDGET_TYPES = ['thread-feed', 'board', 'calendar'] as const;

/**
 * The extensions that have a schema and a renderer. The rest are **named and reserved**:
 * `board` needs ADR-029's drag primitive, which is unwritten. A schema written for a
 * primitive that does not exist is a plausible spec, and a `WidgetView` arm for a type
 * nothing can render spends the `never` fallthrough — the compiler naming every render
 * site — on nothing. See ADR-028.
 *
 * `calendar` joined this list in M18, and only because the thing ADR-028 said it was
 * waiting for arrived: `ops.schedule` exists (`0011_scheduling.sql`,
 * `comms/contracts/scheduling.md`). The second of three, spent deliberately rather than
 * early. **One extension remains reserved and that is the whole remaining allowance.**
 */
export const BUILT_EXTENSION_WIDGET_TYPES = ['thread-feed', 'calendar'] as const;

/**
 * ADR-028's cap, enforced by the compiler rather than by a comment. A fourth entry in
 * `EXTENSION_WIDGET_TYPES` makes this `4`, which is not assignable, and `npm run typecheck`
 * goes red in this file. Falsified before it was claimed.
 */
export const WIDGET_TYPE_EXTENSION_BUDGET = 3;
export const WIDGET_TYPE_EXTENSIONS_USED: 0 | 1 | 2 | 3 = EXTENSION_WIDGET_TYPES.length;

/**
 * How many of the three are **built** — 1 in M16, 2 in M18.
 *
 * The same instrument as the line above, aimed one step in: a fourth *built* extension is
 * unassignable here even if someone widened `EXTENSION_WIDGET_TYPES` and its cap in the
 * same edit, and `checkContractParity()` reads this number out of the source and compares
 * it with the array, so a hand-edited count is red too. It is a separate constant rather
 * than a comment because "which extensions can actually be drawn" is the number that
 * decides how much of the `never` fallthrough is left.
 */
export const WIDGET_TYPE_EXTENSIONS_BUILT: 0 | 1 | 2 | 3 = BUILT_EXTENSION_WIDGET_TYPES.length;

/**
 * What a panel may declare and `WidgetView` renders: the canonical seven plus the built
 * extensions. A reserved-but-unbuilt type is deliberately **not** here, so it never enters
 * `WidgetType` and the exhaustive switch stays exhaustive over things that can be drawn.
 */
export const WIDGET_TYPES = [...CANONICAL_WIDGET_TYPES, ...BUILT_EXTENSION_WIDGET_TYPES] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Named by ADR-028, no schema yet. A panel declaring one is refused with that sentence. */
export const RESERVED_WIDGET_TYPES = EXTENSION_WIDGET_TYPES.filter(
  (t): t is Exclude<(typeof EXTENSION_WIDGET_TYPES)[number], WidgetType> =>
    !(WIDGET_TYPES as readonly string[]).includes(t),
);
export type ReservedWidgetType = (typeof RESERVED_WIDGET_TYPES)[number];

/** Where a value comes from. Phase 1 *resolves* `langfuse` and `static` only (§2.5). */
export const QUERY_SOURCES = ['langfuse', 'sql', 'static'] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

/** Langfuse metrics over agent runs (§3.5). */
export const LANGFUSE_METRICS = ['runs', 'cost', 'latency_p50', 'error_rate'] as const;
export type LangfuseMetric = (typeof LANGFUSE_METRICS)[number];

/** What a Langfuse metric is grouped by when it returns a list. */
export const LANGFUSE_GROUPINGS = ['agent', 'department', 'model', 'day'] as const;
export type LangfuseGrouping = (typeof LANGFUSE_GROUPINGS)[number];

/** Result cardinality. `scalar` for KPI numerals, `series` for charts, `list` for tables. */
export const QUERY_SHAPES = ['scalar', 'series', 'list'] as const;
export type QueryShape = (typeof QUERY_SHAPES)[number];

/**
 * How a delta query expresses change. `previous-period` returns the fractional change
 * against the immediately preceding window of the same length, so a delta chip is one
 * query rather than two subtracted in the browser.
 */
export const COMPARISONS = ['previous-period'] as const;
export type Comparison = (typeof COMPARISONS)[number];

/** The shared formatters (§2.5 rule 3). Every number on a dashboard goes through one. */
export const FORMATS = ['currency', 'number', 'percent', 'duration', 'relative-time'] as const;
export type Format = (typeof FORMATS)[number];

/** Data-ink tones (`contracts/design-tokens.md` §3). `grey` is the monochrome chrome tone. */
export const TONES = ['coral', 'lavender', 'teal', 'copper', 'amber', 'grey'] as const;
export type Tone = (typeof TONES)[number];

/** Signal status icons: ⚠ amber · ✓ teal · ⏰ ivory (§2.5.4). */
export const SIGNAL_TONES = ['warn', 'ok', 'wait'] as const;
export type SignalTone = (typeof SIGNAL_TONES)[number];

/** Chip column tones: ✓ teal outline · `! Stalled` coral · `⏱` neutral (§2.5.5). */
export const CHIP_TONES = ['ok', 'alert', 'neutral'] as const;
export type ChipTone = (typeof CHIP_TONES)[number];

/** Progress-table row status (§2.5.5.6). */
export const PROGRESS_STATUSES = ['on-track', 'at-risk'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/** Column kinds a `data-table` may declare. */
export const COLUMN_TYPES = ['text', 'chip', 'number'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

/** Filter controls above the grid (§2.5.2). */
export const FILTER_TYPES = ['segmented', 'range'] as const;
export type FilterType = (typeof FILTER_TYPES)[number];

/* ---------------------------------------------------------------- patterns */

/** A relative window: `7d`, `28d`, `12h`, `4w`. */
export const RANGE_PATTERN = /^\d{1,3}[hdw]$/;

/**
 * The token a query writes instead of a literal range to bind itself to the panel's
 * time-range pills (§2.5.2). Resolved client-side before the query leaves the browser.
 */
export const RANGE_BINDING = '$range';

/**
 * A registered SQL query name. The runner owns the SQL; the panel owns the *name*.
 * Lowercase snake_case, 3–64 chars — narrow on purpose: it is an identifier, not text.
 */
export const SQL_QUERY_NAME_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

/** Panel and widget ids. */
export const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;

/* ----------------------------------------------------------------- queries */

export interface LangfuseQuery {
  source: 'langfuse';
  metric: LangfuseMetric;
  /** Defaults to `scalar`. */
  shape?: QueryShape;
  /** Required when `shape` is `list` and the metric is not inherently a list. */
  groupBy?: LangfuseGrouping;
  filter?: {
    agent?: string;
    department?: string;
    status?: 'ok' | 'error';
  };
  /** `7d` | `28d` | … | `$range` to follow the panel's pills. */
  range?: string;
  /** Row cap for `list` shapes — the activity feed's `limit: 12`. */
  limit?: number;
  /** Set on a delta query: return the fractional change vs the previous window. */
  compare?: Comparison;
}

/**
 * A **named, registered, parameterized** query owned by the runner.
 *
 * A panel file may never contain SQL. `panels/*.json` is user-editable data; the moment it
 * can carry a query string it is an injection surface with a text editor in front of it.
 * `scripts/validate-panels.mjs` rejects SQL-shaped content anywhere in a panel file.
 */
export interface SqlQuery {
  source: 'sql';
  /** Key into the runner's query registry. Not SQL. Never SQL. */
  name: string;
  /** Scalar params only — no objects, no arrays, no strings that could carry a payload. */
  params?: Record<string, string | number | boolean>;
  shape?: QueryShape;
  range?: string;
  limit?: number;
}

/**
 * A literal, for values that are genuinely constant (a target, a cap, a label) — never a
 * stand-in for data we don't have yet. `note` is mandatory and says where the number came
 * from, because standing rule 9 makes an unsourced literal indistinguishable from a fake.
 */
export interface StaticQuery {
  source: 'static';
  value: number | string | readonly unknown[];
  /** Provenance, in a sentence. Enforced by the validator. */
  note: string;
}

export type PanelQuery = LangfuseQuery | SqlQuery | StaticQuery;

/* ------------------------------------------------------------------ result */

/**
 * `unavailable` is not an error: it is a source that is correct but not wired in this
 * phase (every `sql` query today). It renders the widget's `emptyState`, which names the
 * agent that will eventually fill it. `empty` is a wired source that returned no rows.
 */
export const QUERY_STATUSES = ['ok', 'empty', 'unavailable', 'error'] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];

export interface QueryResult<T = unknown> {
  status: QueryStatus;
  data?: T;
  /** Shown verbatim on `error`; written for a human on a phone (api-contracts.md). */
  message?: string;
}

/** Resolves a panel query to data. Injected, so widgets never know about transport. */
export type QueryResolver = <T>(query: PanelQuery, ctx?: ResolveContext) => Promise<QueryResult<T>>;

export interface ResolveContext {
  /** Current value of the panel's range pills, substituted for `$range`. */
  range?: string;
  /** Current value of a segmented filter. */
  segment?: string;
  signal?: AbortSignal;
}

/* -------------------------------------------------------------- data shapes */

export interface SeriesPoint {
  /** ISO-8601 instant or date. */
  t: string;
  v: number;
}

export interface Annotation {
  t: string;
  label: string;
}

export interface BarRow {
  label: string;
  value: number;
  sub?: string;
}

export interface CostRow {
  label: string;
  sub?: string;
  value: number;
}

export interface ChipValue {
  chip: string;
  tone: ChipTone;
}

export type TableCell = string | number | ChipValue | null;

export interface TableRow {
  /** Stable row identity for the peek interaction. */
  id?: string;
  cells: Record<string, TableCell>;
  /** Optional destination for "click a row to peek inside" (§2.5.5.5). */
  href?: string;
}

export interface ProgressRow {
  label: string;
  phase: string;
  /** 0..1. */
  progress: number;
  status: ProgressStatus;
  sub?: string;
}

export interface ActivityRow {
  /** ISO-8601. Rendered `HH:mm` in the feed's left gutter. */
  at: string;
  /** Bold lead of the two-line row. */
  event: string;
  /** Plain continuation on the same line. */
  detail?: string;
  /** `--ink-2` agent attribution — "— Follow-Up Coordinator" (§2.5.5.7). */
  attribution: string;
  status?: 'ok' | 'error' | 'running';
  traceUrl?: string;
  /**
   * The thread this run belongs to, when it belongs to one. **Attribution, not a row
   * source** — the feed is still agent runs, and a thread with no run has nothing to
   * report (`observability-engineer`, 2026-08-17).
   *
   * Absent on every row today: `ops.agent_runs.thread_id` is nullable, nothing writes it,
   * and the table is empty (`thread-model.md` §5.3). `thread-feed` groups on it and says
   * so out loud rather than inventing a thread for a run that names none.
   */
  threadId?: string;
}

/**
 * One thread's rows, as `thread-feed` renders them. Built by `groupByThread`, which drops
 * rows carrying no `threadId` — a run that names no thread is not a thread of one.
 */
export interface ThreadGroup {
  threadId: string;
  /** Newest first, same row shape the activity feed renders. */
  rows: ActivityRow[];
  /** The newest `at` in the group; the group ordering key. */
  latestAt: string;
}

/* ---------------------------------------------------------------- calendar */

/**
 * One row of the week grid: **one `ops.schedule` row**, labelled by the address it stores.
 *
 * The lane label is `kind` + `addressed_to` as written — `#sales`, `@sales/digest`, or the
 * project default — because those are columns the table actually has
 * (`scheduling.md` §3.4). A department lane would need a join from an agent-addressed
 * schedule through the library to a department, and for a project-addressed schedule there
 * is no answer at all; two thirds of a lane axis is not a lane axis. See `CALENDAR_INK`.
 */
export interface CalendarLane {
  /** `ops.schedule.id`. Identity for keying, never rendered as a name. */
  id: string;
  /** The address as stored. Supplied by the source; never composed here. */
  label: string;
  /** `ops.schedule.trigger_kind`, verbatim, as a wide-tracked sub-label. */
  trigger?: string;
  /**
   * `false` ⇒ every count in this lane is a **lower bound** (`scheduling.md` §6: only
   * `cron` and `interval` have a count derivable from the trigger). Absent means `false`:
   * the renderer never promotes a bound it was not told is exact.
   */
  firesAreExact?: boolean;
}

/**
 * One placed occurrence bucket: a lane, a day of the week, and how many times it fires.
 *
 * `day` is an **offset from `weekStart`, 0..6, computed by the source in the schedule's own
 * zone**. The widget performs no timezone arithmetic and parses no cron: nothing in this
 * repo computes an occurrence (`scheduling.md` §6), and a browser that computed one would
 * be a second occurrence engine disagreeing with the coordinator's — the same argument
 * ADR-023 used to keep one run and one trace.
 */
export interface CalendarCell {
  laneId: string;
  /** 0..6 from `weekStart`. */
  day: number;
  /** Occurrences on that day. Counted, never averaged. */
  fires: number;
}

/**
 * What a `calendar` query returns. **`ops.schedule` + occurrences the coordinator computed**
 * — never a run, never a cost.
 *
 * A lane that arrives with no cell is not drawn as an empty row: it is counted into
 * `unplaceableState`. An empty row would say *this schedule fires nothing this week*, and
 * the true statement is *nobody has computed when this schedule fires*. Unknown is not zero.
 */
export interface CalendarWeek {
  /** ISO calendar date (`YYYY-MM-DD`) of the grid's first column, as the source computed it. */
  weekStart: string;
  lanes: CalendarLane[];
  cells: CalendarCell[];
}

/**
 * `Plan §14` asks for the week grid *"annotated with projected cost"*. This is that
 * annotation, and it carries **no money**.
 *
 * `estimatedUsd` is typed `null`, exactly as `ScheduleCostProjection.estimatedUsd` is
 * (`scheduling.md` §6) and `TurnCost.estimatedUsd` before it. Zero runs have completed, so
 * there is nothing to average — and a calendar is the surface that multiplies a guessed
 * per-run figure by every cell on screen. The day a real figure exists, widening this type
 * is the diff that has to say where it came from.
 *
 * The count is the honest half and it is what the grid prints: occurrences, observed from
 * the cells that were placed.
 */
export interface CalendarProjection {
  /** Occurrences placed in the grid. Real — summed from `cells`. */
  fires: number;
  /** `false` ⇒ a lower bound, because at least one lane said its own count was. */
  firesAreExact: boolean;
  /** No completed run exists to average. Typed `null`, not commented `null`. */
  estimatedUsd: null;
  estimateBasis: 'no-completed-runs';
}

/**
 * **The colour ruling for the calendar, as a value rather than a paragraph.**
 *
 * `Plan §14` asks for a week grid *"coloured by department"*. It does not get one.
 * CLAUDE.md rule 1 — chrome is monochrome, colour is data ink — is §1.3's *"90% of why it
 * looks expensive"*, and `scheduling.md` §10 says where it dies first: seven departments
 * against a data-ink palette of seven hues, tiled across a dense grid, is a chart legend
 * wearing a product.
 *
 * So three things are decided here, and the third is the one that makes the first two hold:
 *
 * 1. **Department is not a hue.** `byDepartment: false`, and it is a literal type: turning
 *    it on is a diff that argues in public rather than a class name someone adds.
 * 2. **Department is not the lane axis either**, so this is not hue-avoidance dressed as
 *    position. A schedule addresses a thread, and `ops.schedule` stores `kind` /
 *    `addressed_to` (`scheduling.md` §3.4) — `#sales` names its department, `@sales/digest`
 *    would need a library join, and a project-default schedule has no department to name.
 *    The lane is the address the row actually holds. Department is a **filter** on the
 *    query, which is selection, not decoration.
 * 3. **Colour carries nothing today**, because the only value in this widget that would
 *    earn data ink is an *outcome* — an occurrence that failed or was missed — and
 *    `ops.schedule_fire` has never held a row (`scheduling.md` §4). One hue is reserved for
 *    that and it is off. A grid whose cells are counts of things that have not happened yet
 *    has no value to colour, and colouring the axis instead is exactly the mistake.
 *
 * `Calendar.test.tsx` reads the component's source and fails on any data-ink class, so this
 * is enforced where it can actually be broken.
 */
export interface CalendarInkRule {
  byDepartment: false;
  huesUsed: 0;
  /** What the one reserved hue would mean, named so "which value?" is not a research task. */
  reservedFor: 'a fire that failed or was missed — ops.schedule_fire.state';
  liveToday: false;
  unblockedBy: 'one recorded fire outcome';
}

export const CALENDAR_INK: CalendarInkRule = {
  byDepartment: false,
  huesUsed: 0,
  reservedFor: 'a fire that failed or was missed — ops.schedule_fire.state',
  liveToday: false,
  unblockedBy: 'one recorded fire outcome',
};

/* ------------------------------------------------------------------- panel */

export interface Sparkline {
  query: PanelQuery;
  tone?: Tone;
}

export interface Delta {
  query: PanelQuery;
  /** Which direction is good, so the chip colours a *value*, not a sign (§1.3). */
  goodDirection: 'up' | 'down';
}

/** §2.5.3 — icon+label → 30px numeral → delta chip → caption → 40×16 sparkline. */
export interface Kpi {
  label: string;
  icon?: string;
  format: Format;
  query: PanelQuery;
  delta?: Delta;
  caption?: string;
  sparkline?: Sparkline;
}

/**
 * §2.5.4 — status icon + **bold lead** + plain continuation.
 *
 * `lead` may contain `{value}`, substituted with the formatted query result. A lead that
 * contains a digit and no query is a validation error: that is how a fabricated number
 * gets into a dashboard.
 */
export interface Signal {
  tone: SignalTone;
  lead: string;
  detail?: string;
  query?: PanelQuery;
  format?: Format;
  /**
   * Rendered instead of `lead` when the query has no data yet — and, with `hideWhenZero`,
   * when it resolves to nothing to report. Required whenever a signal has a query, because
   * a signal with no fallback sentence is a blank line in the strip.
   */
  pending?: string;
  /**
   * A ⚠ that reads "0 runs failed" is noise. When the value resolves to zero the signal
   * renders `pending` with the `ok` tone instead.
   */
  hideWhenZero?: boolean;
}

interface WidgetBase {
  id: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  /** Grid columns occupied. Default 1. */
  span?: 1 | 2;
  query: PanelQuery;
  /** One honest line shown when the query has nothing. Names the agent that will fill it. */
  emptyState?: string;
}

export interface BarListWidget extends WidgetBase {
  type: 'bar-list';
  tone?: Tone;
  format?: Format;
}

export interface SourceBarListWidget extends WidgetBase {
  type: 'source-bar-list';
  tone?: Tone;
  format?: Format;
}

export interface AreaChartWidget extends WidgetBase {
  type: 'area-chart';
  tone?: 'coral' | 'lavender';
  format?: Format;
  annotations?: Annotation[];
}

export interface CostTableWidget extends WidgetBase {
  type: 'cost-table';
  format?: Format;
  showTotal?: boolean;
  totalLabel?: string;
}

export interface DataTableColumn {
  key: string;
  label: string;
  type: ColumnType;
  format?: Format;
  align?: 'left' | 'right';
}

export interface DataTableWidget extends WidgetBase {
  type: 'data-table';
  columns: DataTableColumn[];
  sortable?: boolean;
  /** "click a row to peek inside" (§2.5.5.5). */
  rowAction?: 'peek' | 'none';
}

export interface ProgressTableWidget extends WidgetBase {
  type: 'progress-table';
}

export interface ActivityFeedWidget extends WidgetBase {
  type: 'activity-feed';
  limit?: number;
}

/**
 * ADR-028 · `Plan §23.7` — *"thread stream on a dashboard"*. The activity feed's row is a
 * run; this widget's unit is a **thread**, and it groups the run rows it receives by
 * `threadId`. That grouping is why it is a type rather than a composition — no arrangement
 * of the seven can group.
 *
 * It reads the **existing** activity plane (`/metrics/activity`, `intent: 'activity'`).
 * There is no thread source and no `filter.thread`: a thread is a filter on the run plane,
 * not a plane of its own, and a panel file cannot honestly name a thread id that is created
 * at runtime. See ADR-028 for both refusals.
 *
 * Both sentences are **required** because the widget can render neither today
 * (`thread-model.md` §5.3 — `thread_id` is nullable and no writer sets it) and the two
 * emptinesses are different claims.
 */
export interface ThreadFeedWidget extends WidgetBase {
  type: 'thread-feed';
  /** Rows read before grouping, 1..50. The group cap follows from the rows. */
  limit?: number;
  /** Required: nothing at all arrived. */
  emptyState: string;
  /**
   * Required: events arrived, **none of them belongs to a thread**. Carries `{value}`, the
   * count observed in the payload — the same substitution grammar a signal's `lead` uses.
   * A digit outside that token is a fabricated number and the validator refuses it.
   */
  unthreadedState: string;
}

/**
 * ADR-028 · `Plan §14` — *"a week grid of what will run"*. The second of the three
 * extensions, built in M18 because `ops.schedule` finally exists. A week of *future*
 * occurrences is the one thing no arrangement of the canonical seven can draw: every one of
 * them reports something that has already happened.
 *
 * **Its query is `sql` and nothing else.** `langfuse` is an aggregate over the agent-run
 * ledger (§3.5) and a run is a thing that ran; a schedule is a thing that has not. Reading
 * a future from the past plane would be the wrong table dressed as the right number, so the
 * validator refuses any other source. The registered query is the runner's — a panel names
 * it and never contains SQL.
 *
 * **It renders nothing today, and which nothing is the point.** `ops.schedule` has never
 * held a row, no `source: 'library'` row is even *writable* (`AgentFrontmatter.schedule` is
 * a bare cron that cannot satisfy the mandatory policy columns — ADR-024,
 * `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday: false`), and nothing computes an
 * occurrence. So all three sentences below are required and they are three different
 * claims — see `unplaceableState`, which is the true one for the foreseeable future.
 *
 * Deliberately absent: **drag-to-reschedule.** `Plan §14` mentions it; ADR-029's drag
 * primitive is unwritten, which is exactly why `board` is still reserved. Adding a pointer
 * interaction here would decide that ADR by accident, so the test suite fails on one.
 */
export interface CalendarWidget extends WidgetBase {
  type: 'calendar';
  /**
   * No `limit`, deliberately. Every lane the source returns is drawn: a truncation rule
   * would silently hide schedules, and *"which schedules are worth showing"* is a policy
   * invented for a table that has never held a row. The day one has too many lanes, the
   * fix is a `params` filter in the panel file — data, not a renderer default.
   *
   * Required: the source answered and there are no schedules at all.
   */
  emptyState: string;
  /**
   * Required: schedules exist, and **none of them arrived with an occurrence in this
   * week**, so nothing can be placed on a day. Carries `{value}`, the count observed in the
   * payload — the same substitution grammar `unthreadedState` and a signal's `lead` use.
   *
   * This is the true state today for every row that could ever exist, because nothing in
   * this repo parses a cron or computes a next occurrence (`scheduling.md` §6). It is also
   * rendered *under a drawn grid* whenever some lanes placed and others did not: a hidden
   * lane is an undercount that looks like data.
   */
  unplaceableState: string;
  /**
   * Required: `Plan §14`'s *"annotated with projected cost"*, answered with the half that
   * is real. Carries `{value}` — the occurrence count summed from the placed cells — and
   * must say what the figure is not. A digit outside the token is a fabricated number and
   * **a currency symbol or code is refused outright**: `CalendarProjection.estimatedUsd` is
   * typed `null` so a money figure cannot compile, and this is the same refusal one layer
   * out, where the copy lives.
   */
  projectionState: string;
}

export type Widget =
  | BarListWidget
  | SourceBarListWidget
  | AreaChartWidget
  | CostTableWidget
  | DataTableWidget
  | ProgressTableWidget
  | ActivityFeedWidget
  | ThreadFeedWidget
  | CalendarWidget;

export interface PanelFilters {
  type: FilterType;
  options: string[];
  default?: string;
}

/**
 * §2.5.7 — the Mission Control easter egg: *"This is the actual product."*
 *
 * ## The CTA's two states, and why the second one exists
 *
 * `href` is an **app-internal view path with no project segment** — `/approvals`, never
 * `/p/agentos/approvals` and never an absolute URL. The renderer prefixes the project the
 * reader is currently in. A panel file must not name a project: panels are mounted per
 * project (`project-scoping.md` §5.1 Q8), so a slug baked into one would be a second copy
 * of the mount, and the copy is the one that goes stale.
 *
 * `href` is **optional**, and omitting it is a supported, honest state rather than a
 * degenerate one. A CTA whose destination is not built yet must render as text, not as a
 * link, and must say why — `note` is required in that case and carries the sentence. The
 * spec asks for `Get this deployed →` to reach the approvals queue; **that view does not
 * exist in any project today**, and a link to it is not merely a 404: the unscoped-route
 * resolver re-prefixes any path it does not recognise, so `/approvals` walks
 * `/p/x/approvals` → `/p/x/p/x/approvals` → … A dead link that grows the URL is worse than
 * no link, and "the button is here but does nothing" is worse than a label that says so.
 *
 * The day §2.5.7's view lands this is a one-line JSON edit — add `href`, drop `note` — with
 * no renderer change. Dashboards are data.
 */
export interface PanelFooter {
  lead: string;
  detail: string;
  cta?: PanelFooterCta;
}

export interface PanelFooterCta {
  label: string;
  /** In-app view path, no project segment, no origin. Absent ⇒ renders as text + `note`. */
  href?: string;
  /** Why this is not a link. Required exactly when `href` is absent. */
  note?: string;
}

export interface Panel {
  schemaVersion: number;
  id: string;
  /** 26px/700 title row (§2.5.1). */
  title: string;
  /** One-liner under the carousel caption (§2.4). */
  caption: string;
  /** Rotated rail label — wide-tracked caps (§2.5.6). */
  railTitle: string;
  /** Abstract monochrome glyph key, not a vendor logo (ADR-004). */
  provider: string;
  /** Departments this center covers (ADR-001 slugs). `pipeline` covers two. */
  department: string[];
  /** Carousel position, 1-based, unique across `panels/`. */
  order: number;
  /** Intent line; the full one-shot prompt is composed from it plus the JSON (§2.5.1). */
  buildPrompt: string;
  filters?: PanelFilters;
  kpis: Kpi[];
  signals: Signal[];
  widgets: Widget[];
  footer?: PanelFooter;
}

/** Carousel card projection — the fields the carousel needs without the widget payload. */
export type PanelSummary = Pick<
  Panel,
  'id' | 'title' | 'caption' | 'railTitle' | 'provider' | 'department' | 'order'
> & { kpiCount: number; widgetCount: number };

/* ------------------------------------------------------------------ guards */

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && (WIDGET_TYPES as readonly string[]).includes(value);
}

/**
 * Named by ADR-028, not built. Separate from `isWidgetType` on purpose: a reserved type
 * must **not** widen `WidgetType`, or `WidgetView`'s `never` fallthrough would demand an
 * arm for something nothing can render. It renders the unsupported placeholder — the same
 * path as a typo — and the validator refuses it with a sentence naming the ADR.
 */
export function isReservedWidgetType(value: unknown): value is ReservedWidgetType {
  return typeof value === 'string' && (RESERVED_WIDGET_TYPES as readonly string[]).includes(value);
}

export function isQuerySource(value: unknown): value is QuerySource {
  return typeof value === 'string' && (QUERY_SOURCES as readonly string[]).includes(value);
}

export function isChipValue(value: unknown): value is ChipValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ChipValue).chip === 'string' &&
    (CHIP_TONES as readonly string[]).includes((value as ChipValue).tone)
  );
}

/** `true` when the query cannot resolve in the current phase (§2.5 data note). */
export function isPhaseOneResolvable(query: PanelQuery): boolean {
  return query.source === 'langfuse' || query.source === 'static';
}

/** Previous/next panel for the §2.5.6 rails. Wraps, so the ring has no dead ends. */
export function neighbours<T extends { order: number }>(panels: T[], current: T): { prev: T; next: T } {
  const ring = [...panels].sort((a, b) => a.order - b.order);
  const i = ring.findIndex((p) => p.order === current.order);
  const len = ring.length;
  return {
    prev: ring[(i - 1 + len) % len],
    next: ring[(i + 1) % len],
  };
}
