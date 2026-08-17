import { ThreadsMount } from '../ThreadsMount';

/**
 * `/p/:project/threads/:id` — one thread (`Plan §23.8`). Owner of the view:
 * `sessions-relay-engineer`; owner of the route: `shell-navigation-engineer`.
 *
 * **`:id` is an `ops.thread` uuid** (`contracts/thread-model.md` §5.1) and nothing else.
 * A relay session id keeps its own path at `/p/:project/sessions/:id`, because §9.1 of
 * that contract — *do session threads get a mailbox* — is open, and until it is answered
 * there is no mapping from one namespace to the other. Accepting both here would give one
 * URL two readings, which is the defect this repo keeps paying for.
 *
 * The id is deliberately **not printed**. `parseShellRoute` puts it in `ShellRoute.thread`
 * for the breadcrumb, and the view that will read it is not built; echoing it into the
 * placeholder would put an unvalidated path segment on screen for no reader's benefit.
 */
export default function ThreadPage(): React.JSX.Element {
  return <ThreadsMount variant="one" />;
}
