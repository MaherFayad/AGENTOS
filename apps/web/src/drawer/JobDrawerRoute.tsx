'use client';

/**
 * Map-route mount. `/map/:department/:agent` is the drawer, so it can be linked and
 * closed with the back button (shell `route.ts`). The canvas underneath is
 * `map-galaxy-engineer`'s.
 *
 * Owner: drawer-engineer
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onDrawerOpen } from './events';
import { JobDrawer, type DrawerSide } from './JobDrawer';

export function JobDrawerRoute({ slug, side = 'left' }: { slug: string; side?: DrawerSide }) {
  const router = useRouter();
  const [current, setCurrent] = useState(slug);

  useEffect(() => {
    setCurrent(slug);
  }, [slug]);

  useEffect(() => {
    return onDrawerOpen((detail) => {
      if (detail.view === 'chart') return;
      setCurrent(detail.slug);
    });
  }, []);

  return (
    <JobDrawer
      slug={current}
      side={side}
      open
      onClose={() => {
        const department = current.split('/')[0];
        router.push(department ? `/map/${department}` : '/map');
      }}
    />
  );
}
