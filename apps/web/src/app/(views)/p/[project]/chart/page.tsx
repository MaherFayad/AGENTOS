import { DrawerHost } from '@/drawer';
import { ChartMount } from './mount';

/** `/p/:project/chart` — the AI rollout matrix (§2.6). Owner: `chart-matrix-engineer`. */
export const dynamic = 'force-dynamic';

export default async function ChartIndexPage(): Promise<React.JSX.Element> {
  return (
    <>
      <ChartMount />
      {/* drawer-engineer owns §2.6.5 — host listens for `openDrawer`, we do not render a second drawer. */}
      <DrawerHost />
    </>
  );
}
