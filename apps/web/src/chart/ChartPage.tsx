'use client';

import { useEffect, useState } from 'react';
import { ChartView, type ChartViewProps } from './components/ChartView';
import { loadChartAgents } from './data/agents';
import type { ChartAgent } from './types';

export type ChartPageProps = Omit<ChartViewProps, 'agents'> & {
  /** Pass agents in (e.g. from a server component) to skip the client fetch. */
  agents?: readonly ChartAgent[];
};

/**
 * The mountable CHART page. Routes under `src/app/(views)/chart/**` mount this
 * (or `ChartRoute`, which wraps it with the department URL). The shell still owns
 * the routing skeleton; CHART owns what the page renders (§2.6).
 *
 * Loading shows nothing rather than skeleton cards: a fake grid that resolves into a real
 * one teaches the eye to distrust the real one (Part VII.3).
 */
export function ChartPage({ agents: provided, error: providedError, ...viewProps }: ChartPageProps) {
  const skipFetch = provided !== undefined;
  const [agents, setAgents] = useState<readonly ChartAgent[]>(provided ?? []);
  const [error, setError] = useState<string | undefined>(providedError);

  useEffect(() => {
    if (skipFetch) return;
    let cancelled = false;
    loadChartAgents().then((result) => {
      if (cancelled) return;
      setAgents(result.agents);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [skipFetch]);

  return <ChartView {...viewProps} agents={provided ?? agents} error={providedError ?? error} />;
}
