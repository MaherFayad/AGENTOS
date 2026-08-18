import { ThreadView } from '@/threads/ThreadView';

/**
 * `/p/:project/threads/:id` — one thread (`Plan §23.8`). Owner of the view:
 * `sessions-relay-engineer`; owner of the route: `shell-navigation-engineer`.
 *
 * **`:id` is an `ops.thread` uuid** (`contracts/thread-model.md` §5.1) and nothing else.
 * A relay session id keeps its own path at `/p/:project/sessions/:id`. §9.1 of that
 * contract is now **answered — no** (ADR-037): a session thread holds no `ops.message`
 * rows, so there is still no mapping from one namespace to the other and there never will
 * be one in v1. Accepting both here would give one URL two readings.
 *
 * The id is passed to the view rather than printed. `parseShellRoute` puts it in
 * `ShellRoute.thread` for the breadcrumb; the view uses it to build one scoped request and
 * renders whatever the runner returns for it — including, honestly, `thread_not_found`.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ThreadView threadId={id} />;
}
