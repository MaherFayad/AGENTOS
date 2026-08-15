'use client';

/**
 * Chart-side mount. CHART never renders a drawer of its own (Part IV, chart-matrix
 * Decision 9); it emits `commandcenter:open-drawer` from `src/chart/events.ts`. This
 * host is the only listener. Do not fork that event.
 *
 * Owner: drawer-engineer · Consumes: `apps/web/src/chart/events.ts`
 */

import { useCallback, useEffect, useState } from 'react';
import { OPEN_DRAWER_EVENT, type OpenDrawerDetail } from '@/chart/events';
import { JobDrawer, type DrawerSide } from './JobDrawer';
import { onDrawerOpen } from './events';

export function DrawerHost() {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [side, setSide] = useState<DrawerSide>('right');

  const show = useCallback((nextSlug: string, nextSide: DrawerSide) => {
    setSlug(nextSlug);
    setSide(nextSide);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onChart = (event: Event): void => {
      const detail = (event as CustomEvent<OpenDrawerDetail>).detail;
      if (!detail?.agentSlug) return;
      show(detail.agentSlug, detail.side === 'left' ? 'left' : 'right');
    };
    document.addEventListener(OPEN_DRAWER_EVENT, onChart);
    return () => document.removeEventListener(OPEN_DRAWER_EVENT, onChart);
  }, [show]);

  useEffect(() => {
    return onDrawerOpen((detail) => {
      if (detail.view !== 'chart') return;
      show(detail.slug, 'right');
    });
  }, [show]);

  return <JobDrawer slug={slug} side={side} open={open} onClose={() => setOpen(false)} />;
}
