import { ViewMount } from '../../../../../components/shell';

/**
 * `/map/:department/:agent` — the job drawer open over the department view (§2.3).
 *
 * The drawer is a *route*, not a piece of component state, so it can be linked, shared
 * to a phone, and closed with the back button. Owner of the drawer itself:
 * `drawer-engineer`; owner of the canvas underneath: `map-galaxy-engineer`.
 */
export default async function AgentDrawerPage({
  params,
}: {
  params: Promise<{ department: string; agent: string }>;
}): Promise<React.JSX.Element> {
  const { department, agent } = await params;
  return (
    <ViewMount title={agent.replace(/-/g, ' ')} owner="drawer-engineer" spec="§2.3">
      The left drawer for <code>{`${department}/${agent}`}</code>: autonomy eyebrow, skill
      file, BREAKS INTO / WIRED INTO / BUILDS ON, the ladder, plus our Run now and LAST
      RUNS. It reads the agent&apos;s frontmatter — the drawer keeps no copy of its own.
    </ViewMount>
  );
}
