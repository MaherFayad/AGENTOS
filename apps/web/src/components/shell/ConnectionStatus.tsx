'use client';

import { useEndpoint } from './useEndpoint';

/**
 * §2.0 bottom-right: their Feedback pill becomes **connection status** — Tailscale
 * ● online plus the runner queue depth, from `GET /api/status`
 * (contracts/api-contracts.md).
 *
 * Monochrome on purpose. A green dot here would be the easiest fidelity break in the
 * whole shell: connection state is chrome, and chrome is ivory/ink/line (§1.3). Online
 * is a filled ivory dot; anything else is a dim `--ink-3` dot. The distinction is
 * legible without colour, which is also the accessible outcome.
 *
 * When the endpoint is missing the pill says so in a sentence — it never renders a
 * cheerful "online" it cannot prove (standing rule 9).
 */

interface StatusReading {
  tailscale: string;
  queueDepth: number | null;
}

const STATUS_INTERVAL_MS = 15_000;

function parseStatus(json: unknown): StatusReading | null {
  if (typeof json !== 'object' || json === null) return null;
  const record = json as Record<string, unknown>;
  const tailscale = typeof record.tailscale === 'string' ? record.tailscale : null;
  if (tailscale === null) return null;
  const queueDepth = typeof record.queueDepth === 'number' && Number.isFinite(record.queueDepth) ? record.queueDepth : null;
  return { tailscale, queueDepth };
}

export function ConnectionStatus(): React.JSX.Element {
  const status = useEndpoint<StatusReading>('/api/status', {
    intervalMs: STATUS_INTERVAL_MS,
    parse: parseStatus,
    notBuiltMessage:
      "The status endpoint isn't up yet, so this box can't tell you whether the runner is reachable.",
    offlineMessage:
      "No answer from the runner. You're probably off the tailnet — reconnect Tailscale and this comes back on its own.",
  });

  const online = status.state === 'ready' && status.data.tailscale === 'online';
  const label =
    status.state === 'loading'
      ? 'CHECKING'
      : status.state === 'unavailable'
        ? 'NO READING'
        : online
          ? 'ONLINE'
          : status.data.tailscale.toUpperCase();

  const queue =
    status.state === 'ready' && status.data.queueDepth !== null
      ? `${status.data.queueDepth} QUEUED`
      : null;

  const sentence =
    status.state === 'unavailable'
      ? status.message
      : status.state === 'ready'
        ? `Tailscale is ${status.data.tailscale}.${queue ? ` The runner has ${status.data.queueDepth} job${status.data.queueDepth === 1 ? '' : 's'} queued.` : ''}`
        : 'Checking the tailnet connection.';

  return (
    <div
      title={sentence}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[10px] uppercase leading-none tracking-[0.25em] text-ink-2"
    >
      <span
        aria-hidden="true"
        className={`h-[5px] w-[5px] shrink-0 rounded-full ${online ? 'bg-ivory' : 'border border-line-2 bg-transparent'}`}
      />
      <span>{label}</span>
      {queue !== null && (
        <>
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          <span className="tabular-nums">{queue}</span>
        </>
      )}
      <span className="sr-only">{sentence}</span>
    </div>
  );
}
