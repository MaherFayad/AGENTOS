'use client';

import { useRef, useState } from 'react';
import type { AreaChartWidget } from '@agnetos/contracts';
import { areaPath, linePath, nearestIndex } from '../lib/geometry';
import { toSeries } from '../lib/rows';
import { formatValue } from '../lib/format';
import { TONE_TEXT } from '../lib/tone';
import { QueryGate, WidgetChrome } from './widget-chrome';

const W = 320;
const H = 140;

export function AreaChart({ widget }: { widget: AreaChartWidget }): React.JSX.Element {
  const tone = widget.tone ?? 'coral';
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={H}>
        {(data) => <Chart payload={data} tone={tone} format={widget.format} annotations={widget.annotations} />}
      </QueryGate>
    </WidgetChrome>
  );
}

function Chart({
  payload,
  tone,
  format,
  annotations,
}: {
  payload: unknown;
  tone: 'coral' | 'lavender';
  format?: AreaChartWidget['format'];
  annotations?: AreaChartWidget['annotations'];
}): React.JSX.Element {
  const series = toSeries(payload);
  const values = series.map((p) => p.v);
  const fill = areaPath(values, W, H);
  const stroke = linePath(values, W, H);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number>(-1);

  if (series.length === 0) return <p className="text-meta text-ink-2">No points in this series.</p>;

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    setHover(nearestIndex(series.length, (event.clientX - box.left) / box.width));
  };

  const point = hover >= 0 ? series[hover] : null;
  const annotation = point
    ? annotations?.find((a) => a.t === point.t)
    : undefined;
  const label = point
    ? `${point.t} · ${format && formatValue(point.v, format) ? formatValue(point.v, format) : point.v}${
        annotation ? ` · ${annotation.label}` : ''
      }`
    : null;

  return (
    <div
      ref={wrap}
      className={`relative ${TONE_TEXT[tone]}`}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(-1)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={widgetTitle(label)}>
        {fill ? <path d={fill} fill="currentColor" opacity={0.2} /> : null}
        {stroke ? <path d={stroke} fill="none" stroke="currentColor" strokeWidth={1.5} /> : null}
      </svg>
      {label ? (
        <p className="mt-2 text-meta tabular-nums text-ivory-2" aria-live="polite">
          {label}
        </p>
      ) : (
        // The only place the chart's interactivity is stated (tokens contract §9.2, last
        // bullet: a hint that appears nowhere else). It is also swapped out by the reading
        // the moment you hover, so it is never on screen while the pointer is over the card.
        <p className="mt-2 text-meta text-ink-2">Hover a spike for the reading.</p>
      )}
    </div>
  );
}

function widgetTitle(label: string | null): string {
  return label ?? 'Area chart';
}
