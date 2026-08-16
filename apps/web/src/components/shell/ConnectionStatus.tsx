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
  /**
   * The runner's own sentence for whichever tailnet state it is in. `UNKNOWN` on its own
   * reads as "broken", and today it is not: the runner observes `100.64.0.0/10` on *its
   * own* interfaces, and a container cannot see a tailnet that lives on the host. The
   * hint says which case it is; a bare label cannot.
   */
  tailscaleHint: string;
  /** `null` ⇒ not reported. The count is simply not drawn — never drawn as `0`. */
  queueDepth: number | null;
}

const STATUS_INTERVAL_MS = 15_000;

function parseStatus(json: unknown): StatusReading | null {
  if (typeof json !== 'object' || json === null) return null;
  const record = json as Record<string, unknown>;
  const tailscale = typeof record.tailscale === 'string' ? record.tailscale : null;
  if (tailscale === null) return null;
  const queueDepth = typeof record.queueDepth === 'number' && Number.isFinite(record.queueDepth) ? record.queueDepth : null;
  const tailscaleHint = typeof record.tailscaleHint === 'string' ? record.tailscaleHint.trim() : '';
  return { tailscale, tailscaleHint, queueDepth };
}

export function ConnectionStatus(): React.JSX.Element {
  const status = useEndpoint<StatusReading>('/api/status', {
    intervalMs: STATUS_INTERVAL_MS,
    parse: parseStatus,
    notBuiltMessage:
      "The status endpoint isn't up yet, so this box can't tell you whether the runner is reachable.",
    malformedMessage:
      "The runner answered, but not with a status this build understands, so this box can't tell you whether the tailnet is up. That is a version mismatch here, not a connection problem.",
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

  const queue = status.state === 'ready' && status.data.queueDepth !== null ? status.data.queueDepth : null;

  // The runner's `tailscaleHint` is preferred over our one-liner whenever it is present:
  // it distinguishes "no Tailscale on this host" from "configured but invisible from
  // inside the container" from "down", and those three used to render the same word.
  const reachability =
    status.state === 'ready'
      ? status.data.tailscaleHint || `Tailscale is ${status.data.tailscale}.`
      : '';
  const sentence =
    status.state === 'unavailable'
      ? status.message
      : status.state === 'ready'
        ? `${reachability}${queue ? ` The runner has ${status.data.queueDepth} job${status.data.queueDepth === 1 ? '' : 's'} queued.` : ''}`
        : 'Checking the tailnet connection.';

  return (
    <div
      title={sentence}
      // `whitespace-nowrap`: at 375px the bottom-right cluster is narrow enough that
      // "0 QUEUED" breaks across two lines and the pill grows a second row. A status
      // readout that changes height as the number changes is worse than one that is
      // occasionally wide, so it stays on one line.
      className="pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-pill border border-line bg-card px-3 py-1.5 text-label-sm uppercase tracking-wider-1 text-ink-2"
    >
      <span
        aria-hidden="true"
        className={`h-[5px] w-[5px] shrink-0 rounded-pill ${online ? 'bg-ivory' : 'border border-line-2 bg-transparent'}`}
      />
      <span>{label}</span>
      {queue !== null && (
        <>
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          {/* The word is dropped below 420px so the two bottom-right pills fit a phone
              without wrapping or clipping. The count is the reading; "QUEUED" is the
              caption, and the `title`/sr-only sentence always carries the full wording. */}
          <span className="tabular-nums">
            {queue}
            <span className="hidden min-[420px]:inline"> QUEUED</span>
          </span>
        </>
      )}
      <span className="sr-only">{sentence}</span>
    </div>
  );
}
