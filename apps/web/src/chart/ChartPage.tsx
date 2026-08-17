'use client';

import { useEffect, useState } from 'react';
import { useProjectSegment } from '@/components/shell';
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
 *
 * **The project comes from the URL, not from a prop** (M15, ADR-015). `useProjectSegment()`
 * reads the same segment the shell parses, needs no provider — so the bare-render tests of
 * every view keep working, which `useShell()` would have broken — and, the part that
 * matters here, cannot be *omitted*. A `project` prop threaded from the route adapter would
 * have been one more thing a caller can forget, and forgetting it is exactly how this view
 * ended up asking an unscoped route in the first place.
 */
export function ChartPage({ agents: provided, error: providedError, ...viewProps }: ChartPageProps) {
  const skipFetch = provided !== undefined;
  const project = useProjectSegment();
  const [agents, setAgents] = useState<readonly ChartAgent[]>(provided ?? []);
  const [error, setError] = useState<string | undefined>(providedError);

  useEffect(() => {
    if (skipFetch) return;
    let cancelled = false;
    loadChartAgents(project).then((result) => {
      if (cancelled) return;
      setAgents(result.agents);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [skipFetch, project]);

  return <ChartView {...viewProps} agents={provided ?? agents} error={providedError ?? error} />;
}
