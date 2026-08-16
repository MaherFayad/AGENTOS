import { SessionView } from '@/sessions';

/**
 * `/sessions/:id` — one session, full screen (§3.1). This is the route a push
 * notification deep-links into (§3.6), so it renders from the id alone: no
 * server-side lookup, because the server has nothing readable to look up.
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
