'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { neighbours, type Panel } from '@agnetos/contracts';
import { ProviderGlyph } from '../lib/icons';
import { buildPromptFor } from '../lib/prompt';
import { DashboardQueryProvider } from '../data/use-resolved';
import { Eyebrow, Pill, RailLabel, SegmentedControl, cx } from '../ui';
import { KpiTile } from './KpiTile';
import { SignalsStrip } from './SignalsStrip';
import { WidgetView } from './WidgetView';
import s from '../dashboards.module.css';

export function DashboardDetail({
  panel,
  panels,
}: {
  panel: Panel;
  panels: readonly Panel[];
}): React.JSX.Element {
  const router = useRouter();
  const ring = neighbours([...panels], panel);
  const filter = panel.filters;
  const [selected, setSelected] = useState(filter?.default ?? filter?.options[0] ?? '');
  const [copied, setCopied] = useState(false);

  const range = filter?.type === 'range' ? selected : undefined;
  const segment = filter?.type === 'segmented' ? selected : undefined;

  const prompt = useMemo(() => buildPromptFor(panel), [panel]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DashboardQueryProvider panel={panel} range={range} segment={segment}>
      <div className={cx(s.view)}>
        <button
          type="button"
          className={cx(s.rail, s.railPrev)}
          onClick={() => router.push(`/dashboards/${ring.prev.id}`)}
          aria-label={`Previous: ${ring.prev.railTitle}`}
        >
          {/* `tone="muted"` (--ink-2), not the primitive's `faint` default. §9.3 blesses
              --ink-3 for "a rail cap that repeats the heading beside it" — that is the MAP's
              rail. This one names a DIFFERENT dashboard and is the only visible thing saying
              the edge is navigation at all, so the carve-out does not reach it (§2.5.6). */}
          <span className={s.railDot} aria-hidden="true" />
          <RailLabel orientation="up" tone="muted">
            {ring.prev.railTitle}
          </RailLabel>
        </button>
        <button
          type="button"
          className={cx(s.rail, s.railNext)}
          onClick={() => router.push(`/dashboards/${ring.next.id}`)}
          aria-label={`Next: ${ring.next.railTitle}`}
        >
          <span className={s.railDot} aria-hidden="true" />
          <RailLabel orientation="down" tone="muted">
            {ring.next.railTitle}
          </RailLabel>
        </button>

        <div className={s.detail}>
          <div className={s.detailInner}>
            <header className={s.titleRow}>
              <ProviderGlyph provider={panel.provider} className="h-6 w-6 text-ivory" />
              <h1 className={s.detailTitle}>{panel.title}</h1>
              <Pill variant="ghost" onClick={() => void copyPrompt()}>
                {copied ? 'Copied the one-shot prompt' : '⌨ Build guide + one-shot prompt'}
              </Pill>
            </header>

            {filter ? (
              <div className={s.filterRow}>
                <SegmentedControl
                  label={filter.type === 'range' ? 'Time range' : 'Filter'}
                  value={selected}
                  onChange={setSelected}
                  options={filter.options.map((option) => ({ value: option, label: option }))}
                />
              </div>
            ) : null}

            <div
              className={s.kpiRow}
              style={{ gridTemplateColumns: `repeat(${panel.kpis.length}, minmax(0, 1fr))` }}
            >
              {panel.kpis.map((kpi) => (
                <KpiTile key={kpi.label} kpi={kpi} />
              ))}
            </div>

            <SignalsStrip signals={panel.signals} />

            <div className={s.grid}>
              {panel.widgets.map((widget) => (
                <WidgetView key={widget.id} widget={widget} />
              ))}
            </div>

            {panel.footer ? (
              <footer className={s.footer}>
                <Eyebrow size="sm">Mission Control</Eyebrow>
                <p className={cx(s.footerLead, 'text-small font-semibold')}>{panel.footer.lead}</p>
                <p className={cx(s.footerDetail, 'text-small')}>{panel.footer.detail}</p>
                {panel.footer.cta ? (
                  <a
                    href={panel.footer.cta.href}
                    className="text-small text-ivory-2 underline decoration-line underline-offset-4 hover:text-ivory"
                  >
                    {panel.footer.cta.label}
                  </a>
                ) : null}
              </footer>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardQueryProvider>
  );
}
