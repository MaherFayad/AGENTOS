'use client';

import { useEffect, useState } from 'react';
import { ChartView, type ChartViewProps } from './components/ChartView';
import { loadChartAgents } from './data/agents';
import type { ChartAgent } from './types';

export type ChartPageProps = Omit<ChartViewProps, 'agents' | 'error'> & {
  /** Pass agents in (e.g. from a server component) to skip the client fetch. */
  agents?: readonly ChartAgent[];
};

/**
 * The mountable CHART page. `shell-navigation-engineer` owns `src/app/(views)/**` routing
 * (BOARD.md §2.0), so this exports a component for them to mount rather than defining a
 * route here — see the handoff.
 *
 * Loading shows nothing rather than skeleton cards: a fake grid that resolves into a real
 * one teaches the eye to distrust the real one (Part VII.3).
 */
export function ChartPage({ agents: provided, ...viewProps }: ChartPageProps) {
  const [agents, setAgents] = useState<readonly ChartAgent[]>(provided ?? []);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (provided) return;
    let cancelled = false;
    loadChartAgents().then((result) => {
      if (cancelled) return;
      setAgents(result.agents);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [provided]);

  return <ChartView {...viewProps} agents={provided ?? agents} error={error} />;
}
