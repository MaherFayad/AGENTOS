'use client';

import { useRouter } from 'next/navigation';
import { ChartPage, type ChartAgent } from '@/chart';
import { DEPARTMENTS, isDepartment } from '@/chart/data/contracts';
import { useShell, withProject } from '@/components/shell';

/**
 * Next adapter around `<ChartPage />`. Keeps `/p/:project/chart/:department` in sync with
 * the §2.6.1 tab bar so the shell breadcrumb and the back button match the active tab.
 *
 * The project prefix is read from the shell rather than from this component's own params
 * (M15): `withProject` is the single place that knows the segment's shape, so a route
 * built here cannot drift from a route built by the breadcrumb or the switcher.
 */
export function ChartRoute({
  agents,
  error,
  department,
}: {
  agents?: readonly ChartAgent[];
  error?: string;
  department?: string;
}) {
  const router = useRouter();
  const { route } = useShell();
  const fallback = DEPARTMENTS[0]?.slug ?? 'sales';
  const active = department && isDepartment(department) ? department : fallback;

  return (
    <ChartPage
      agents={agents}
      error={error}
      department={active}
      onDepartmentChange={(slug) => {
        router.push(withProject(`/chart/${slug}`, route.project));
      }}
    />
  );
}
