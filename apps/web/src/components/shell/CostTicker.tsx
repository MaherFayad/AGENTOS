'use client';

import { useEndpoint } from './useEndpoint';

/**
 * §2.0 / §3.5: the cost ticker beside the status pill — `$12.40 today`, from
 * `GET /api/cost/today` (Langfuse, owned by `observability-engineer`).
 *
 * Same monochrome type style as the status pill. It is **not** a coloured badge: spend
 * is not a status, and turning it red at some threshold would be a colour we invented.
 *
 * `$0.00 today` is only shown when the endpoint actually answers zero — a real zero is
 * information ("nothing ran today"). A missing endpoint says it is missing.
 */

const COST_INTERVAL_MS = 60_000;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseCost(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null;
  const { usd } = json as Record<string, unknown>;
  return typeof usd === 'number' && Number.isFinite(usd) ? usd : null;
}

export function CostTicker(): React.JSX.Element {
  const cost = useEndpoint<number>('/api/cost/today', {
    intervalMs: COST_INTERVAL_MS,
    parse: parseCost,
    notBuiltMessage:
      "Langfuse isn't reporting spend yet, so there is no number to show here. This fills in the first time an agent run is traced.",
    offlineMessage: "Couldn't reach Langfuse for today's spend. This box may be off the tailnet.",
  });

  const text =
    cost.state === 'ready'
      ? `${money.format(cost.data)} today`
      : cost.state === 'loading'
        ? '…'
        : 'no cost data';

  const sentence = cost.state === 'unavailable' ? cost.message : `Agent spend so far today: ${text}.`;

  return (
    <div
      title={sentence}
      className="pointer-events-auto rounded-full border border-line bg-card px-3 py-1.5 text-[10px] uppercase leading-none tracking-[0.25em] text-ink-2 tabular-nums"
    >
      <span>{text}</span>
      <span className="sr-only">{sentence}</span>
    </div>
  );
}
