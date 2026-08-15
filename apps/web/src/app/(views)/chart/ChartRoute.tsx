'use client';

import { useRouter } from 'next/navigation';
import { ChartPage, type ChartAgent } from '@/chart';
import { DEPARTMENTS, isDepartment } from '@/chart/data/contracts';

/**
 * Next adapter around `<ChartPage />`. Keeps `/chart/:department` in sync with the
 * §2.6.1 tab bar so the shell breadcrumb and the back button match the active tab.
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
  const fallback = DEPARTMENTS[0]?.slug ?? 'sales';
  const active = department && isDepartment(department) ? department : fallback;

  return (
    <ChartPage
      agents={agents}
      error={error}
      department={active}
      onDepartmentChange={(slug) => {
        router.push(`/chart/${slug}`);
      }}
    />
  );
}
