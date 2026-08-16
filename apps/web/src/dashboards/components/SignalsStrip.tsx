'use client';

import { Clock } from 'lucide-react';
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
    ? renderSignal(signal, result.status, result.data, result.loading, result.message)
    : { tone: signal.tone, lead: signal.lead, detail: signal.detail };

  return (
    <p className="text-small text-ivory-2">
      <span
        className={cx('me-2 inline-flex translate-y-[2px] align-baseline', iconColor(rendered.tone))}
        aria-hidden="true"
      >
        <SignalIcon tone={rendered.tone} />
      </span>
      <strong className="font-semibold text-ivory">{rendered.lead}</strong>
      {rendered.detail ? <span> {rendered.detail}</span> : null}
    </p>
  );
}

/**
 * `pending` is the strip's copy for a source that answered with nothing — "No failed runs
 * in this window." That is a claim *about the data*, so it must not be printed when the
 * source could not be read at all: a route that never applied the status filter and a
 * window that genuinely holds no failures are different facts, and only one of them is
 * "no failed runs". So an `unavailable` result prefers the resolver's own sentence, and
 * falls back to `pending` only when there isn't one (every `sql` query, whose `pending`
 * is written for exactly that case).
 */
function renderSignal(
  signal: Signal,
  status?: string,
  data?: unknown,
  loading?: boolean,
  message?: string,
): { tone: SignalTone; lead: string; detail?: string } {
  if (!signal.query) return { tone: signal.tone, lead: signal.lead, detail: signal.detail };
  if (loading) return { tone: 'wait', lead: signal.pending ?? 'Waiting on a figure.', detail: signal.detail };

  if (status === 'unavailable' || status === 'error') {
    return message
      ? { tone: 'wait', lead: message }
      : { tone: 'wait', lead: signal.pending ?? 'No figure yet.', detail: signal.detail };
  }

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

/**
 * ⚠ and ✓ are text-presentation glyphs: they paint in `currentColor` and inherit the
 * amber and teal set beside them. `⏰` (U+23F0) has **no** text-presentation variant — no
 * platform will draw it as an outline, so it lands as a saturated red-orange emoji that no
 * CSS `color` can reach, which breaks "chrome is monochrome" (BOARD constraint 1, §1.3).
 * §2.5 names the glyph but names it *with a colour*, and an emoji that cannot be ivory is
 * not what it asked for. Lucide, at `currentColor`, is.
 * (`comms/inbox/_all/20260816-1235-orchestrator-clock-emoji-breaks-monochrome.md`)
 */
function SignalIcon({ tone }: { tone: SignalTone }): React.JSX.Element {
  switch (tone) {
    case 'warn':
      return <span className="text-label leading-none">⚠</span>;
    case 'ok':
      return <span className="text-label leading-none">✓</span>;
    case 'wait':
      return <Clock size={12} strokeWidth={1.5} />;
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
