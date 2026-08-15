import { ViewMount } from '../../../components/shell';

/**
 * The service worker's navigation fallback (§3.6). Reached only when a page load fails
 * while the app is installed.
 *
 * It deliberately shows *nothing* about your agents. The app shell is cached; the data
 * is not, because a cached KPI is a lie with a timestamp. This page says what happened
 * and what to do about it, in a sentence.
 */
export default function OfflinePage(): React.JSX.Element {
  return (
    <ViewMount title="No tailnet" owner="shell-navigation-engineer" spec="§3.6">
      This app is only reachable over your Tailscale network, and right now this device
      can&apos;t see it. Reconnect Tailscale and reload — nothing has been lost, and no
      numbers are shown here because none of them would be current.
    </ViewMount>
  );
}
