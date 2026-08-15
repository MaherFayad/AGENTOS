'use client';

import { useShell } from '../components/shell';
import { MapView } from './MapView';

/**
 * Mountable MAP page. Reads the drill-in from the shell route so `/map`,
 * `/map/:department` and `/map/:department/:agent` share one canvas instance
 * (the layout keeps this mounted across those URLs).
 */
export function MapPage(): React.JSX.Element {
  const { route, yourTree } = useShell();
  return <MapView department={route.department} agent={route.agent} yourTree={yourTree} />;
}
