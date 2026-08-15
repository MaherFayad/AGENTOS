'use client';

import type { Signal, SignalTone } from '@agnetos/contracts';
import { formatValue, interpolate } from '../lib/format';
import { toScalar } from '../lib/rows';
import { useResolved } from '../data/use-resolved';
import { cx } from '../ui';

export function SignalsStrip({ signals }: { signals: Signal[] }): React.JSX.Element {
  return (
    <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {signals.map((signal, i) => (
        <li key={`${signal.lead}-${i}`}>
          <SignalItem signal={signal} />
        </li>
      ))}
    </ul>
  );
}

function SignalItem({ signal }: { signal: Signal }): React.JSX.Element {
  // Hooks must run unconditionally. A query-less signal ignores this result.
  const result = useResolved(
    signal.query ?? { source: 'static', value: 0, note: 'placeholder for a signal with no query' },
  );
  const rendered = signal.query
    ? renderSignal(signal, result.status, result.data, result.loading)
    : { tone: signal.tone, lead: signal.lead, detail: signal.detail };

  return (
    <p className="text-small text-ivory-2">
      <span className={cx('me-2 inline-block', iconColor(rendered.tone))} aria-hidden="true">
        {icon(rendered.tone)}
      </span>
      <strong className="font-semibold text-ivory">{rendered.lead}</strong>
      {rendered.detail ? <span> {rendered.detail}</span> : null}
    </p>
  );
}

function renderSignal(
  signal: Signal,
  status?: string,
  data?: unknown,
  loading?: boolean,
): { tone: SignalTone; lead: string; detail?: string } {
  if (!signal.query) return { tone: signal.tone, lead: signal.lead, detail: signal.detail };
  if (loading) return { tone: 'wait', lead: signal.pending ?? 'Waiting on a figure.', detail: signal.detail };

  const value = toScalar(data);
  if (status !== 'ok' || value === null) {
    return { tone: 'wait', lead: signal.pending ?? 'No figure yet.', detail: signal.detail };
  }
  if (signal.hideWhenZero && value === 0) {
    return { tone: 'ok', lead: signal.pending ?? signal.lead, detail: signal.detail };
  }
  const formatted = signal.format ? formatValue(value, signal.format) : formatValue(value, 'number');
  const lead = interpolate(signal.lead, formatted);
  if (lead === null) return { tone: 'wait', lead: signal.pending ?? 'No figure yet.', detail: signal.detail };
  return { tone: signal.tone, lead, detail: signal.detail };
}

function icon(tone: SignalTone): string {
  switch (tone) {
    case 'warn':
      return '⚠';
    case 'ok':
      return '✓';
    case 'wait':
      return '⏰';
    default: {
      const _never: never = tone;
      return _never;
    }
  }
}

function iconColor(tone: SignalTone): string {
  switch (tone) {
    case 'warn':
      return 'text-ink-amber';
    case 'ok':
      return 'text-ink-teal';
    case 'wait':
      return 'text-ivory';
    default: {
      const _never: never = tone;
      return _never;
    }
  }
}
