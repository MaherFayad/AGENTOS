import { JobDrawerRoute } from '@/drawer';

/**
 * `/map/:department/:agent` — the job drawer open over the department view (§2.3).
 *
 * The galaxy underneath is mounted by `map/layout.tsx` (owner: map-galaxy-engineer).
 * This page only mounts the left drawer from the route params.
 */
export default async function AgentDrawerPage({
  params,
}: {
  params: Promise<{ department: string; agent: string }>;
}): Promise<React.JSX.Element> {
  const { department, agent } = await params;
  return <JobDrawerRoute slug={`${department}/${agent}`} side="left" />;
}
