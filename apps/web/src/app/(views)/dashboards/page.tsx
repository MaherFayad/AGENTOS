import { ViewMount } from '../../../components/shell';

/** `/dashboards` — the 3D carousel of Command Centers (§2.4). Owner: `dashboards-engineer`. */
export default function DashboardsPage(): React.JSX.Element {
  return (
    <ViewMount title="Command Centers" owner="dashboards-engineer" spec="§2.4">
      A carousel of dashboards, one card per `panels/*.json`. Dashboards are data, not
      code — nothing appears here until a panel definition exists.
    </ViewMount>
  );
}
