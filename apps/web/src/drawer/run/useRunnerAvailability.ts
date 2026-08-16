'use client';

/**
 * Is the runner actually there?
 *
 * §3.2 gives the drawer ▶ Run now and Schedule, and the rule for M2 is blunt: don't
 * ship a fake ▶ that does nothing. So the buttons ask `GET /api/status` once, and until
 * they get an answer they are disabled with a tooltip that says which of the three states
 * they are in. A disabled button with an honest reason is a feature; an enabled button
 * that silently fails is a bug we would only find in a demo.
 *
 * Owner: drawer-engineer
 */

import { useEffect, useState } from 'react';
import { DOWNLOAD_ROUTE_AGREED, fetchRunnerStatus } from '../data/client';

export type RunnerState = 'checking' | 'ready' | 'unreachable' | 'unconfigured';

export interface Capabilities {
  runner: RunnerState;
  /** `GET /api/agents/:slug/download` is not in the contract yet — see data/client.ts. */
  download: boolean;
  /** The sentence shown on a disabled control. Written for a human, per the contract. */
  reason: string | null;
}

const REASON: Record<RunnerState, string | null> = {
  checking: 'Checking whether the runner is up…',
  ready: null,
  unreachable: 'The runner is not reachable from here, so nothing can be started. Nothing was sent.',
  unconfigured: 'The runner is up but has no API key, so nothing can be started. Nothing was sent.',
};

export function useRunnerAvailability(): Capabilities {
  const [runner, setRunner] = useState<RunnerState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchRunnerStatus(controller.signal)
      .then((status) => {
        if (cancelled) return;
        setRunner(status.runnerConfigured === false ? 'unconfigured' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setRunner('unreachable');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { runner, download: DOWNLOAD_ROUTE_AGREED, reason: REASON[runner] };
}
