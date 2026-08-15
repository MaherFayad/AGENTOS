/**
 * Payload → row shapes.
 *
 * Everything a widget renders arrives as `unknown`: from the runner, from Langfuse, from
 * a `panels/*.json` a human edited by hand. These normalisers are the boundary. Each one
 * takes anything and returns a well-formed array — dropping rows it cannot understand
 * rather than rendering `undefined`, and returning `[]` rather than throwing.
 *
 * That is not defensiveness for its own sake: contract rule 1 says an unknown widget type
 * renders a placeholder and never crashes a dashboard, and the same has to be true of an
 * unknown *row*. One malformed row from one agent must not take down the five widgets
 * beside it.
 *
 * Owner: dashboards-engineer · Spec §2.5.5
 */

import type {
  ActivityRow,
  BarRow,
  ChipValue,
  CostRow,
  ProgressRow,
  SeriesPoint,
  TableCell,
  TableRow,
} from '@agnetos/contracts';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

const arr = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  // A resolver may hand back `{rows: [...]}` or `{data: [...]}`; both are common enough
  // to accept, and neither is worth a round trip to fix.
  if (isObj(v)) {
    for (const key of ['rows', 'data', 'items', 'series', 'points']) {
      if (Array.isArray(v[key])) return v[key] as unknown[];
    }
  }
  return [];
};

/* -------------------------------------------------------------------- bars */

/** `bar-list` and `source-bar-list` rows: a label, a value, an optional sub-label. */
export function toBarRows(payload: unknown): BarRow[] {
  return arr(payload)
    .map((row) => {
      if (!isObj(row)) return null;
      const label = str(row.label) ?? str(row.name) ?? str(row.key) ?? str(row.stage) ?? str(row.source);
      const value = num(row.value) ?? num(row.count) ?? num(row.total) ?? num(row.amount);
      if (label === null || value === null) return null;
      const sub = str(row.sub) ?? str(row.subtitle);
      return sub ? { label, value, sub } : { label, value };
    })
    .filter((r): r is BarRow => r !== null);
}

/** `cost-table` rows. Same shape as a bar row; kept separate because the widgets are. */
export function toCostRows(payload: unknown): CostRow[] {
  return toBarRows(payload).map((r) => ({ label: r.label, value: r.value, ...(r.sub ? { sub: r.sub } : {}) }));
}

export const sumOf = (rows: readonly { value: number }[]): number =>
  rows.reduce((total, r) => total + (Number.isFinite(r.value) ? r.value : 0), 0);

/* ------------------------------------------------------------------ series */

/** `area-chart` points. Sorted by time, because a series out of order draws a scribble. */
export function toSeries(payload: unknown): SeriesPoint[] {
  return arr(payload)
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const t = str(point[0]);
        const v = num(point[1]);
        return t !== null && v !== null ? { t, v } : null;
      }
      if (!isObj(point)) return null;
      const t = str(point.t) ?? str(point.date) ?? str(point.day) ?? str(point.at);
      const v = num(point.v) ?? num(point.value) ?? num(point.count) ?? num(point.total);
      return t !== null && v !== null ? { t, v } : null;
    })
    .filter((p): p is SeriesPoint => p !== null)
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

/* ------------------------------------------------------------------ tables */

const CHIP_TONES = ['ok', 'alert', 'neutral'] as const;

function toCell(value: unknown): TableCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (isObj(value) && typeof value.chip === 'string') {
    const tone = CHIP_TONES.includes(value.tone as never) ? (value.tone as ChipValue['tone']) : 'neutral';
    return { chip: value.chip, tone };
  }
  return null;
}

/**
 * `data-table` rows, projected onto the columns the panel declared.
 *
 * Columns are the contract; a payload key the panel did not ask for is dropped, and a
 * column the payload did not supply becomes `null` and renders as an em-dash. Neither is
 * an error — the panel and the query are versioned separately by definition.
 */
export function toTableRows(payload: unknown, columnKeys: readonly string[]): TableRow[] {
  return arr(payload)
    .map((row, i): TableRow | null => {
      if (!isObj(row)) return null;
      const source = isObj(row.cells) ? row.cells : row;
      const cells: Record<string, TableCell> = {};
      for (const key of columnKeys) cells[key] = toCell(source[key]);
      if (columnKeys.every((k) => cells[k] === null)) return null;
      const id = str(row.id) ?? str(row.runId) ?? `row-${i}`;
      const href = str(row.href) ?? str(row.traceUrl);
      return { id, cells, ...(href ? { href } : {}) };
    })
    .filter((r): r is TableRow => r !== null);
}

/**
 * Sorts a table by one column. Numbers numerically, chips and text lexically, `null`
 * always last regardless of direction — an empty cell is not "the smallest value", it is
 * the absence of one, and sorting it to the top of an ascending column reads as data.
 */
export function sortTableRows(rows: readonly TableRow[], key: string, dir: 'asc' | 'desc'): TableRow[] {
  const weight = (cell: TableCell): number | string | null => {
    if (cell === null) return null;
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'string') return cell.toLowerCase();
    return cell.chip.toLowerCase();
  };
  return [...rows].sort((a, b) => {
    const x = weight(a.cells[key] ?? null);
    const y = weight(b.cells[key] ?? null);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return dir === 'asc' ? cmp : -cmp;
  });
}

/* --------------------------------------------------------------- progress */

const PROGRESS_STATUSES = ['on-track', 'at-risk'] as const;

/** `progress-table` rows (§2.5.5.6). A row without a real progress fraction is dropped. */
export function toProgressRows(payload: unknown): ProgressRow[] {
  return arr(payload)
    .map((row) => {
      if (!isObj(row)) return null;
      const label = str(row.label) ?? str(row.client) ?? str(row.name);
      const phase = str(row.phase) ?? str(row.stage);
      const progress = num(row.progress);
      if (label === null || phase === null || progress === null) return null;
      const status = PROGRESS_STATUSES.includes(row.status as never)
        ? (row.status as ProgressRow['status'])
        : 'on-track';
      const sub = str(row.sub);
      return { label, phase, progress: Math.max(0, Math.min(1, progress)), status, ...(sub ? { sub } : {}) };
    })
    .filter((r): r is ProgressRow => r !== null);
}

/* --------------------------------------------------------------- activity */

const RUN_STATUSES = ['ok', 'error', 'running'] as const;

/**
 * `activity-feed` rows (§2.5.5.7). Newest first — the feed is read from the top.
 *
 * A row with no timestamp is dropped rather than stamped with "now": the timestamp is
 * the gutter, and a feed where one row's time is fabricated is a feed you cannot trust
 * to order itself.
 */
export function toActivityRows(payload: unknown): ActivityRow[] {
  return arr(payload)
    .map((row) => {
      if (!isObj(row)) return null;
      const at = str(row.at) ?? str(row.startedAt) ?? str(row.timestamp);
      const event = str(row.event) ?? str(row.name) ?? str(row.agent);
      const attribution = str(row.attribution) ?? str(row.agent) ?? str(row.actor);
      if (at === null || event === null || attribution === null) return null;
      const status = RUN_STATUSES.includes(row.status as never) ? (row.status as ActivityRow['status']) : undefined;
      const detail = str(row.detail);
      const traceUrl = str(row.traceUrl);
      return {
        at,
        event,
        attribution,
        ...(detail ? { detail } : {}),
        ...(status ? { status } : {}),
        ...(traceUrl ? { traceUrl } : {}),
      };
    })
    .filter((r): r is ActivityRow => r !== null)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/* ------------------------------------------------------------------ scalar */

/** A KPI's single number. Anything non-numeric is `null`, never `0` (standing rule 9). */
export function toScalar(payload: unknown): number | null {
  if (typeof payload === 'number') return Number.isFinite(payload) ? payload : null;
  if (isObj(payload)) {
    for (const key of ['value', 'total', 'count', 'usd', 'ms']) {
      const v = num(payload[key]);
      if (v !== null) return v;
    }
  }
  return num(payload);
}
