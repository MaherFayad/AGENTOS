import { ViewMount } from '../../../components/shell';

/** `/map` — the galaxy view (§2.1). Owner: `map-galaxy-engineer`. */
export default function MapPage(): React.JSX.Element {
  return (
    <ViewMount title="The galaxy" owner="map-galaxy-engineer" spec="§2.1">
      Seven department branches around the company core, drawn from `agents/**/SKILL.md`.
      Nothing is rendered here yet — the graph payload has to exist before there is a map
      to draw.
    </ViewMount>
  );
}
