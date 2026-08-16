'use client';

import type { BarListWidget, Format, SourceBarListWidget, Tone } from '@agnetos/contracts';
import { barWidths } from '../lib/geometry';
import { toBarRows } from '../lib/rows';
import { TONE_FILL } from '../lib/tone';
import { Formatted, QueryGate, WidgetChrome } from './widget-chrome';

function Bars({
  payload,
  tone,
  format,
  valueAlign,
}: {
  payload: unknown;
  tone: Tone;
  format?: Format;
  valueAlign: 'right' | 'left';
}): React.JSX.Element {
  const rows = toBarRows(payload);
  if (rows.length === 0) return <p className="text-meta text-ink-2">No rows.</p>;
  const widths = barWidths(rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-meta text-ivory-2">{row.label}</span>
              {valueAlign === 'right' ? (
                <Formatted value={row.value} format={format} className="text-meta" />
              ) : null}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-line">
              <div
                className={`h-full rounded-pill ${TONE_FILL[tone]}`}
                style={{ width: `${widths[i]}%` }}
              />
            </div>
            {/* `row.sub` is usually the only place a bar's qualifier appears — "of 121 runs",
                "excludes unpriced". Required reading under §9.2, so --ink-2, one rung below
                the --ivory-2 label it hangs off. The row does not hover, so §9.5 does not bite. */}
            {row.sub ? <p className="mt-0.5 text-meta text-ink-2">{row.sub}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BarList({ widget }: { widget: BarListWidget | SourceBarListWidget }): React.JSX.Element {
  const tone: Tone = widget.type === 'source-bar-list' ? 'grey' : (widget.tone ?? 'coral');
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={160}>
        {(data) => (
          <Bars payload={data} tone={tone} format={widget.format} valueAlign="right" />
        )}
      </QueryGate>
    </WidgetChrome>
  );
}
