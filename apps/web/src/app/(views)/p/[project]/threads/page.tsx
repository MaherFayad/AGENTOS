import { ThreadsMount } from './ThreadsMount';

/**
 * `/p/:project/threads` — the fourth tab (`Plan §23.5`, `Plan §23.8`), project-scoped like
 * every other view (ADR-015). There is no unscoped `/threads` page; an unscoped link lands
 * on `LegacyRouteResolver`, which asks the coordinator rather than picking.
 *
 * **This file is the slot, not the view.** `shell-navigation-engineer` owns the tab bar and
 * this route; `sessions-relay-engineer` owns what mounts here — the thread list grouped by
 * project and kind, and the addressing composer whose autocomplete has to make the cost
 * difference between `#sales` (1 run) and `@@sales` (N runs) visible before the key is
 * pressed (`Plan §12`, `contracts/thread-model.md` §6).
 *
 * Replacing a `ViewMount` is the documented handover: swap the element for the component
 * and nothing in the shell changes.
 */
export default function ThreadsPage(): React.JSX.Element {
  return <ThreadsMount variant="list" />;
}
