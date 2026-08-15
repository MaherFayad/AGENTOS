import { ViewMount } from '../../../../components/shell';

/**
 * `/map/:department` — the drill-in (§2.2). The shell reads the department straight from
 * the URL, which is what makes the breadcrumb strip and the `N OF 22 LIVE` counter work
 * on a link someone was handed.
 *
 * Owner: `map-galaxy-engineer`.
 */
export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<React.JSX.Element> {
  const { department } = await params;
  return (
    <ViewMount title={`${department.replace(/-/g, ' ')} — department view`} owner="map-galaxy-engineer" spec="§2.2">
      Zoomed into one branch: watermark department name, sub-cluster captions, rail labels
      for the neighbours. The camera move is driven by the `shell:flyTo` event the search
      pill already emits.
    </ViewMount>
  );
}
