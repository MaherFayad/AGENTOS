import { DashboardDetail, DashboardsView } from '@/dashboards';
import { loadPanels } from '@/dashboards/data/load';

export const dynamic = 'force-dynamic';

/** `/dashboards/:id` — one dashboard (§2.5). Owner: `dashboards-engineer`. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { panels, error } = await loadPanels();
  const panel = panels.find((p) => p.id === id);
  if (!panel) {
    return (
      <DashboardsView
        panels={[]}
        error={
          error ??
          `No panel called “${id}”. Add panels/${id}.json and it appears here — dashboards are data, not a route table.`
        }
      />
    );
  }
  return <DashboardDetail panel={panel} panels={panels} />;
}
