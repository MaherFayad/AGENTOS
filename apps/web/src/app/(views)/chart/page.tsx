import { ViewMount } from '../../../components/shell';

/** `/chart` — the AI rollout matrix (§2.6). Owner: `chart-matrix-engineer`. */
export default function ChartPage(): React.JSX.Element {
  return (
    <ViewMount title="The AI rollout" owner="chart-matrix-engineer" spec="§2.6">
      Autonomy tiers down the side, rollout phases across the top, the same frontmatter
      the map projects — a different projection, not a second copy of the data.
    </ViewMount>
  );
}
