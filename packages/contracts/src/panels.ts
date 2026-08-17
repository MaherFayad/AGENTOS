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
 * video. An eighth requires an ADR — see `.claude/skills/cc-panels`.
 */
export const WIDGET_TYPES = [
  'bar-list',
  'source-bar-list',
  'area-chart',
  'cost-table',
  'data-table',
  'progress-table',
  'activity-feed',
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

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
}

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

export type Widget =
  | BarListWidget
  | SourceBarListWidget
  | AreaChartWidget
  | CostTableWidget
  | DataTableWidget
  | ProgressTableWidget
  | ActivityFeedWidget;

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
