import { ViewMount } from '../../../components/shell';

/**
 * `/sessions` — the fourth tab (§3.1). Owner: `sessions-relay-engineer`.
 *
 * `+ New session` in the top bar routes here with `?new=1`; that query param is the
 * relay's to handle, not the shell's.
 */
export default function SessionsPage(): React.JSX.Element {
  return (
    <ViewMount title="Sessions" owner="sessions-relay-engineer" spec="§3.1">
      Live and recent Claude Code sessions from the Happy relay — name, repo, model,
      state, elapsed, cost. Transcripts stay end-to-end encrypted; they are decrypted in
      this browser and nowhere else.
    </ViewMount>
  );
}
