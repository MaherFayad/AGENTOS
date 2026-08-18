import { redirect } from 'next/navigation';

/**
 * `/p/:project/sessions` — **redirected to `/p/:project/threads`** (M16, `Plan §23.8`).
 *
 * `shell-navigation-engineer` deliberately left this un-redirected and wrote the condition
 * on it: *"when your thread list can list session threads, this becomes a redirect; that
 * step is theirs."* It can now. `ThreadsView` mounts `SessionsTab` unchanged as its session
 * group — same rows, same key gate, same client-side decryption boundary, same push
 * settings — so nothing that worked here has been sent to a placeholder.
 *
 * Redirecting is not cosmetic tidying. THREADS took the fourth tab slot, so after the
 * rename **no navigation control in the product pointed at this path at all**: the session
 * list was reachable only by typing the URL or following a push deep link saved on a home
 * screen. This route existing but being unreachable is worse than either of the two honest
 * options, and the honest option is the one where the tab that replaced SESSIONS contains
 * them.
 *
 * `?new=1` is forwarded, because that is exactly the home-screen shortcut case above:
 * `+ New session` used to land here, and it now lands on the addressing composer.
 *
 * **`/p/:project/sessions/:id` is NOT redirected and must never be.** A relay session id is
 * not an `ops.thread` uuid (`thread-model.md` §5.1), §9.1 is answered *no* (ADR-037) so no
 * mapping exists to redirect through, and every push notification already on a home screen
 * points at that path (`sessions/push/payload.ts`). `ShellRoute` keeps `.thread` and
 * `.session` as separate fields with a test that neither ever holds the other's value.
 */
export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ new?: string }>;
}): Promise<never> {
  const [{ project }, query] = await Promise.all([params, searchParams]);
  const suffix = query.new === '1' ? '?new=1' : '';
  redirect(`/p/${encodeURIComponent(project)}/threads${suffix}`);
}
