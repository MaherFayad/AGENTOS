import { ThreadsView } from '@/threads/ThreadsView';

/**
 * `/p/:project/threads` — the fourth tab (`Plan §23.5`, `Plan §23.8`), project-scoped like
 * every other view (ADR-015). There is no unscoped `/threads` page; an unscoped link lands
 * on `LegacyRouteResolver`, which asks the coordinator rather than picking.
 *
 * `shell-navigation-engineer` owns the tab bar and this route; `sessions-relay-engineer`
 * owns what mounts here. The `ViewMount` placeholder they left is gone — this is the view.
 *
 * `?new=1` focuses the addressing composer. It arrives here from two places: the top bar's
 * `+ New` action, and the redirect at `/p/:project/sessions`, which forwards the query so a
 * home-screen shortcut saved before M16 still lands on something that composes.
 */
export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  return <ThreadsView composeRequested={query.new === '1'} />;
}
