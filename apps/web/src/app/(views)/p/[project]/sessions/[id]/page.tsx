import { SessionView } from '@/sessions';

/**
 * `/sessions/:id` — one session, full screen (§3.1). This is the route a push
 * notification deep-links into (§3.6), so it renders from the id alone: no
 * server-side lookup, because the server has nothing readable to look up.
 *
 * **Kept verbatim through M16's tab change, and this one is not up for redirection at
 * all.** `:id` is a relay session id; `/threads/:id` takes an `ops.thread` uuid
 * (`contracts/thread-model.md` §5.1, §9.1 open). Rewriting one to the other would send
 * every notification already sitting on a home screen to a thread that does not exist —
 * a dead route that still resolves, which is worse than one that 404s.
 *
 * Owner: `sessions-relay-engineer`.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <SessionView sessionId={id} />;
}
