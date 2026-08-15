import { ViewMount } from '../../../../components/shell';

/** `/dashboards/:id` — one dashboard (§2.5). Owner: `dashboards-engineer`. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <ViewMount title={id.replace(/-/g, ' ')} owner="dashboards-engineer" spec="§2.5">
      KPI tiles, signals strip and the seven widget types, all read from this panel&apos;s
      JSON definition. The shell&apos;s breadcrumb above says ALL DASHBOARDS here, not ALL
      DEPARTMENTS — same strip, view-aware label.
    </ViewMount>
  );
}
