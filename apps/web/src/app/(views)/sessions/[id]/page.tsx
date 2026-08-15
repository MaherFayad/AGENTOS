import { ViewMount } from '../../../../components/shell';

/** `/sessions/:id` — one session, full screen (§3.1). Owner: `sessions-relay-engineer`. */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <ViewMount title={`Session ${id}`} owner="sessions-relay-engineer" spec="§3.1">
      Streaming transcript on a `--screen` panel, permission prompts as copper Allow /
      Deny cards, an input box to steer. This is the route a push notification opens.
    </ViewMount>
  );
}
