import { ChartRoute } from './ChartRoute';
import { loadChartAgentsFromDisk } from '@/chart/data/fromDisk';

/**
 * Server mount for `/chart` and `/chart/:department`. Reads each agent's SKILL.md
 * at request time (the same frontmatter every view projects) and hands the
 * projection to the client page. `dynamic = 'force-dynamic'` on the route files
 * so this is never baked empty at image-build time — the web image does not
 * COPY `agents/`; Docker mounts it at `/agents`.
 */
export async function ChartMount({ department }: { department?: string }) {
  const result = await loadChartAgentsFromDisk();
  return (
    <ChartRoute
      department={department}
      agents={result.ok ? result.agents : undefined}
      error={result.ok ? undefined : result.error}
    />
  );
}
