'use client';

import type { ProgressTableWidget } from '@agnetos/contracts';
import { progressWidth } from '../lib/geometry';
import { toProgressRows } from '../lib/rows';
import { Chip } from '../ui';
import { QueryGate, WidgetChrome } from './widget-chrome';

export function ProgressTable({ widget }: { widget: ProgressTableWidget }): React.JSX.Element {
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={160}>
        {(data) => {
          const rows = toProgressRows(data);
          if (rows.length === 0) return <p className="text-meta text-ink-2">No rows.</p>;
          return (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium text-ivory">{row.label}</p>
                      <p className="text-meta text-ink-2">{row.phase}</p>
                    </div>
                    <Chip tone={row.status === 'at-risk' ? 'risk' : 'success'} caps>
                      {row.status === 'at-risk' ? '! At risk' : '✓ On track'}
                    </Chip>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-line">
                    <div
                      className="h-full rounded-pill bg-ink-teal"
                      style={{ width: `${progressWidth(row.progress)}%` }}
                    />
                  </div>
                  {row.sub ? <p className="mt-1 text-meta text-ink-2">{row.sub}</p> : null}
                </li>
              ))}
            </ul>
          );
        }}
      </QueryGate>
    </WidgetChrome>
  );
}
