import { SessionsTab } from '@/sessions';

/**
 * `/sessions` — the fourth tab (§3.1). Owner: `sessions-relay-engineer`.
 *
 * `+ New session` in the top bar routes here with `?new=1`. Spawning a session
 * needs a machine with the Claude CLI attached to the relay, which the browser
 * cannot do on its own — the list's empty state says exactly that rather than
 * offering a button that would lie.
 */
export default function SessionsPage(): React.JSX.Element {
  return <SessionsTab />;
}
