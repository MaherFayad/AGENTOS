import { isDepartment } from '@agnetos/contracts';
import { redirect } from 'next/navigation';
import { DrawerHost } from '@/drawer';
import { ChartMount } from '../mount';

/**
 * `/p/:project/chart/:department` — one department's matrix (§2.6.1).
 * Owner: `chart-matrix-engineer`.
 */
export const dynamic = 'force-dynamic';

export default async function ChartDepartmentPage({
  params,
}: {
  params: Promise<{ project: string; department: string }>;
}): Promise<React.JSX.Element> {
  const { project, department } = await params;
  // Stays inside the project it was asked about. Redirecting to a bare `/chart` would
  // drop the project segment and land on the legacy resolver, which would then have to
  // pick one — the ambient default the whole axis exists to avoid.
  if (!isDepartment(department)) redirect(`/p/${project}/chart`);
  return (
    <>
      <ChartMount department={department} />
      <DrawerHost />
    </>
  );
}
