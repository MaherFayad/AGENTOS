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

  // A resolver may attach a provenance caveat to an `ok` figure — today that is
  // "10 of 121 runs unpriced" on a spend tile, where the sum is a floor rather than a
  // total. It rides on the caption line rather than a new one, so a tile that acquires a
  // caveat does not change height and the KPI row does not reflow (§2.5 rule 2).
  const caveat = value.status === 'ok' && !value.loading ? value.message : undefined;

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
          {kpi.caption || caveat ? (
            /* Two weights, one line, no extra box — the §2.5 rule-2 no-reflow invariant
               above depends on this staying a single <p>.

               The caption is the panel's own descriptive label ("vs previous 7d") and sits
               at the tile's meta weight, --ink-2, matching the label above it.

               The caveat is not that. It is the sentence that says the --ivory numeral is a
               FLOOR, NOT A TOTAL, and tokens contract §9.4a puts a caveat exactly one rung
               below the value it qualifies. The value here is --ivory (KpiNumeral tone
               `default`), so one rung is --ivory-2 — the same shape design-system-guardian
               landed in the drawer as .runMeta --ivory / .runMetaAbsent --ivory-2. At
               --ink-2 the caveat would be two rungs down, which §9.4a calls out by name.

               §9.4's "an empty state at secondary weight out-shouts the tiles with real
               values" argument is about ABSENCE in a grid of peers — that case is
               `.emptyLine` below, and it stays --ink-2. A caveat rides a figure that is
               present, so it cannot out-shout it: the numeral is still a rung brighter and
               three times the size. The tile is not interactive, so §9.5 does not apply. */
            <p className="text-label text-ink-2">
              {kpi.caption}
              {kpi.caption && caveat ? ' · ' : null}
              {caveat ? <span className="text-ivory-2">{caveat}</span> : null}
            </p>
          ) : null}
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
