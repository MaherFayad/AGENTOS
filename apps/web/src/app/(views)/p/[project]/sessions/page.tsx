import { SessionsTab } from '@/sessions';

/**
 * `/sessions` — §3.1's session list. Owner: `sessions-relay-engineer`.
 *
 * **No longer a tab, and deliberately not a redirect** (M16, `Plan §23.8`). THREADS took
 * the fourth slot; this path stays live as a sub-view under it, and `parseShellRoute`
 * lights THREADS while you are here.
 *
 * The alternative was `redirect('/p/:project/threads')`. It was rejected because
 * `/threads` is a `ViewMount` until `sessions-relay-engineer` builds it: redirecting would
 * take a screen that works — decrypting and listing real relay sessions — and send it to a
 * placeholder. Removing a working surface is not what "replaces" means while the
 * replacement is empty. When the thread list can list session threads, this becomes a
 * redirect; that step is theirs, and this comment is the note it is waiting on.
 *
 * `+ New session` in the top bar routes here with `?new=1`. Spawning a session
 * needs a machine with the Claude CLI attached to the relay, which the browser
 * cannot do on its own — the list's empty state says exactly that rather than
 * offering a button that would lie.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  return <SessionsTab spawnRequested={query.new === '1'} />;
}
