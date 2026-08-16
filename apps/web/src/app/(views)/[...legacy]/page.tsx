import { LegacyRouteResolver } from '@/components/shell';

/**
 * Every view path that does **not** start with `/p/:project` — i.e. every link written
 * before M15 put the project in the URL (`Plan §9`, `Plan §23.10`).
 *
 * A catch-all is the lowest-priority match in the App Router, so the four real view trees
 * under `p/[project]/` and the static `offline/` route win before this file is ever
 * consulted. That ordering is why the compatibility path costs one file instead of a
 * duplicate of the whole tree.
 *
 * It renders nothing about any project's data. It asks the coordinator which project it
 * mounts, rewrites the URL to say so, and — when it cannot ask — says that rather than
 * choosing. See `components/shell/LegacyRouteResolver.tsx` for why that last clause is
 * the load-bearing one.
 */
export default function LegacyRoutePage(): React.JSX.Element {
  return <LegacyRouteResolver />;
}
