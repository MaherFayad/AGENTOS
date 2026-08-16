'use client';

import { useMemo, useState } from 'react';
import type { ChipValue, DataTableWidget, TableRow } from '@agnetos/contracts';
import { isChipValue } from '@agnetos/contracts';
import { sortTableRows, toTableRows } from '../lib/rows';
import { formatClock, formatValue } from '../lib/format';
import { labelFromSlug, normalizeRuns, type RunRecord } from '../lib/runs';
import { chipTone } from '../lib/tone';
import { Chip } from '../ui';
import { Formatted, QueryGate, WidgetChrome } from './widget-chrome';

export function DataTable({ widget }: { widget: DataTableWidget }): React.JSX.Element {
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={180}>
        {(data) => <Table widget={widget} payload={data} />}
      </QueryGate>
    </WidgetChrome>
  );
}

function Table({ widget, payload }: { widget: DataTableWidget; payload: unknown }): React.JSX.Element {
  const initial = useMemo(() => {
    const keys = widget.columns.map((c) => c.key);
    const mapped = runsAsTable(payload);
    return toTableRows(mapped ?? payload, keys);
  }, [payload, widget.columns]);

  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const rows = sort ? sortTableRows(initial, sort.key, sort.dir) : initial;

  if (rows.length === 0) return <p className="text-meta text-ink-2">No rows.</p>;

  const sortable = widget.sortable !== false;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-meta">
        <thead>
          <tr className="border-b border-line text-left text-ink-2">
            {widget.columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'py-2 text-right font-medium' : 'py-2 font-medium'}>
                {sortable ? (
                  <button
                    type="button"
                    className="uppercase tracking-wider-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-line-2"
                    onClick={() =>
                      setSort((prev) =>
                        prev?.key === col.key
                          ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                          : { key: col.key, dir: 'asc' },
                      )
                    }
                  >
                    {col.label}
                  </button>
                ) : (
                  <span className="uppercase tracking-wider-1">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Row key={row.id ?? i} row={row} widget={widget} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, widget }: { row: TableRow; widget: DataTableWidget }): React.JSX.Element {
  const href = widget.rowAction === 'peek' ? row.href : undefined;
  const open = () => {
    if (href) window.open(href, '_blank', 'noopener');
  };
  return (
    <tr
      className={
        href
          ? 'cursor-pointer border-b border-line last:border-0 hover:bg-card-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-line-2'
          : 'border-b border-line last:border-0'
      }
      tabIndex={href ? 0 : undefined}
      role={href ? 'link' : undefined}
      onClick={href ? open : undefined}
      onKeyDown={
        href
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
              }
            }
          : undefined
      }
    >
      {widget.columns.map((col) => (
        <td key={col.key} className={col.align === 'right' ? 'py-2 text-right' : 'py-2'}>
          <Cell value={row.cells[col.key] ?? null} type={col.type} format={col.format} />
        </td>
      ))}
    </tr>
  );
}

function Cell({
  value,
  type,
  format,
}: {
  value: string | number | ChipValue | null;
  type: 'text' | 'chip' | 'number';
  format?: DataTableWidget['columns'][number]['format'];
}): React.JSX.Element {
  // One absent-reading treatment for the whole module — colour, glyph and accessible name
  // are all decided in `Formatted`. This branch used to be a second, quieter copy of it.
  if (value === null) return <Formatted value={null} format={format} />;
  if (type === 'chip' || isChipValue(value)) {
    const chip = isChipValue(value) ? value : { chip: String(value), tone: 'neutral' as const };
    return (
      <Chip tone={chipTone(chip.tone)} caps>
        {chip.chip}
      </Chip>
    );
  }
  if (type === 'number' || typeof value === 'number') {
    return <Formatted value={value} format={format} />;
  }
  if (format === 'relative-time') {
    return <span className="text-ivory-2">{formatValue(value, 'relative-time') ?? String(value)}</span>;
  }
  const clock = formatClock(value);
  if (clock && /^\d{4}-/.test(String(value))) return <span className="tabular-nums text-ivory-2">{clock}</span>;
  return <span className="text-ivory-2">{String(value)}</span>;
}

/** Last-runs payloads are RunRecords; project them onto the columns the panel declared. */
function runsAsTable(payload: unknown): unknown[] | null {
  const runs = normalizeRuns(payload);
  if (runs.length === 0) return null;
  return runs.map(runToCells);
}

function runToCells(run: RunRecord): Record<string, unknown> {
  const tone = run.status === 'error' ? 'alert' : run.status === 'running' ? 'neutral' : 'ok';
  const chip =
    run.status === 'error' ? '! Failed' : run.status === 'running' ? '⏱ Running' : '✓ Done';
  return {
    id: run.runId,
    agent: labelFromSlug(run.agent),
    status: { chip, tone },
    cost: run.costUsd,
    duration: run.durationMs,
    at: run.startedAt,
    href: run.traceUrl,
  };
}
