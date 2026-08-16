'use client';

import type { ActivityFeedWidget, ActivityRow } from '@agnetos/contracts';
import { formatClock, formatCurrency, formatDurationMs } from '../lib/format';
import { toActivityRows } from '../lib/rows';
import { normalizeRuns, runToActivityRow } from '../lib/runs';
import { QueryGate, WidgetChrome } from './widget-chrome';

export function ActivityFeed({ widget }: { widget: ActivityFeedWidget }): React.JSX.Element {
  const limit = widget.limit ?? 12;
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={220}>
        {(data) => {
          const rows = activityFrom(data).slice(0, limit);
          // Empty state and clock are both required reading (tokens contract §9.2): the
          // sentence appears *instead of* a run count, and a feed whose stamps cannot be
          // read is a list, not a feed. Neither is decorative, so neither is --ink-3.
          if (rows.length === 0) return <p className="text-meta text-ink-2">No runs in this window.</p>;
          return (
            <ol className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <li key={`${row.at}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <time className="text-meta tabular-nums text-ink-2" dateTime={row.at}>
                    {formatClock(row.at) ?? '—'}
                  </time>
                  <p className="text-small text-ivory">
                    <span className="font-semibold">{row.event}</span>
                    {row.detail ? <span className="font-normal text-ivory-2"> · {row.detail}</span> : null}
                    <span className="text-ink-2"> — {row.attribution}</span>
                  </p>
                </li>
              ))}
            </ol>
          );
        }}
      </QueryGate>
    </WidgetChrome>
  );
}

function activityFrom(payload: unknown): ActivityRow[] {
  const rows = toActivityRows(payload);
  if (rows.length > 0) return rows;
  return normalizeRuns(payload).map((run) =>
    runToActivityRow(run, { duration: formatDurationMs, currency: formatCurrency }),
  );
}
