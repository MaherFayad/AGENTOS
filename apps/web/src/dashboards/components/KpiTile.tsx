'use client';

import type { Kpi, Tone } from '@agnetos/contracts';
import { sparklinePath, SPARKLINE } from '../lib/geometry';
import { formatDelta, formatValue } from '../lib/format';
import { toScalar, toSeries } from '../lib/rows';
import { KpiIcon } from '../lib/icons';
import { TONE_TEXT } from '../lib/tone';
import { useResolved } from '../data/use-resolved';
import { Card, KpiNumeral, cx } from '../ui';
import { EmptyLine, SkeletonBlock } from './states';

export function KpiTile({ kpi }: { kpi: Kpi }): React.JSX.Element {
  const value = useResolved(kpi.query);
  const delta = useResolved(kpi.delta?.query ?? kpi.query);
  const spark = useResolved(kpi.sparkline?.query ?? kpi.query);

  return (
    <Card radius="sm" padded className="min-w-0">
      <p className="flex items-center gap-1.5 text-label uppercase tracking-wider-1 text-ink-2">
        <KpiIcon name={kpi.icon} />
        {kpi.label}
      </p>
      <div className="mt-2 min-h-[30px]">
        <KpiBody kpi={kpi} loading={value.loading} data={value.data} status={value.status} />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {kpi.delta && !value.loading && delta.status === 'ok' ? (
            <Delta kpi={kpi} change={toScalar(delta.data)} />
          ) : null}
          {kpi.caption ? <p className="text-label text-ink-3">{kpi.caption}</p> : null}
        </div>
        {kpi.sparkline && !spark.loading && spark.status === 'ok' ? (
          <Spark values={toSeries(spark.data).map((p) => p.v)} tone={kpi.sparkline.tone ?? 'teal'} />
        ) : null}
      </div>
    </Card>
  );
}

function KpiBody({
  kpi,
  loading,
  data,
  status,
}: {
  kpi: Kpi;
  loading: boolean;
  data: unknown;
  status: string;
}): React.JSX.Element {
  if (loading) return <SkeletonBlock height={30} />;
  const raw = toScalar(data);
  if (raw === null || status !== 'ok') {
    return <EmptyLine>No figure yet.</EmptyLine>;
  }
  return (
    <KpiNumeral
      value={raw}
      size="md"
      format={(n) => formatValue(n, kpi.format) ?? '—'}
    />
  );
}

function Delta({ kpi, change }: { kpi: Kpi; change: number | null }): React.JSX.Element | null {
  if (!kpi.delta) return null;
  const chip = formatDelta(change, kpi.delta.goodDirection);
  if (!chip) return null;
  const color =
    chip.good === null ? 'text-ink-2' : chip.good ? 'text-ink-teal' : 'text-ink-coral';
  return <p className={cx('text-label tabular-nums', color)}>{chip.text}</p>;
}

function Spark({ values, tone }: { values: number[]; tone: Tone }): React.JSX.Element | null {
  const d = sparklinePath(values);
  if (!d) return null;
  return (
    <svg
      width={SPARKLINE.w}
      height={SPARKLINE.h}
      viewBox={`0 0 ${SPARKLINE.w} ${SPARKLINE.h}`}
      className={TONE_TEXT[tone]}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={SPARKLINE.stroke} />
    </svg>
  );
}
