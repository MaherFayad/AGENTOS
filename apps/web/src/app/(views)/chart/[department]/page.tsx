import { isDepartment } from '@agnetos/contracts';
import { redirect } from 'next/navigation';
import { DrawerHost } from '../../../../drawer';
import { ChartMount } from '../mount';

/** `/chart/:department` — one department's matrix (§2.6.1). Owner: `chart-matrix-engineer`. */
export const dynamic = 'force-dynamic';

export default async function ChartDepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<React.JSX.Element> {
  const { department } = await params;
  if (!isDepartment(department)) redirect('/chart');
  return (
    <>
      <ChartMount department={department} />
      <DrawerHost />
    </>
  );
}
