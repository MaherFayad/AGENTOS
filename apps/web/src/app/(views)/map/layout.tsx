import type { ReactNode } from 'react';
import { MapPage } from '@/map/MapPage';

/**
 * Persist the galaxy across `/map` → `/map/:department` → `/map/:department/:agent`
 * so the 700ms camera move (§1.6) actually plays. The page files under this layout
 * are empty slots: department pages return null; the agent page is drawer-engineer's.
 */
export default function MapLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <>
      <MapPage />
      {children}
    </>
  );
}
