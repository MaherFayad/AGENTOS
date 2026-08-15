import { ViewMount } from '../../../../components/shell';

/** `/chart/:department` — one department's matrix (§2.6.1). Owner: `chart-matrix-engineer`. */
export default async function ChartDepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<React.JSX.Element> {
  const { department } = await params;
  return (
    <ViewMount title={`${department.replace(/-/g, ' ')} — the AI rollout`} owner="chart-matrix-engineer" spec="§2.6">
      The tier × phase grid for one department, with job cards in the cells and the right
      drawer behind &ldquo;More detail&rdquo;.
    </ViewMount>
  );
}
