import { DashboardsView } from '@/dashboards';
import { loadPanels } from '@/dashboards/data/load';

export const dynamic = 'force-dynamic';

/** `/dashboards` — the 3D carousel of Command Centers (§2.4). Owner: `dashboards-engineer`. */
export default async function DashboardsPage(): Promise<React.JSX.Element> {
  const { panels, error } = await loadPanels();
  return <DashboardsView panels={panels} error={error} />;
}
