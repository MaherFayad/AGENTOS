'use client';

import { FullscreenToggle } from './FullscreenToggle';
import { NewSessionAction } from './NewSessionAction';
import { SearchPill } from './SearchPill';
import { ViewTabs } from './ViewTabs';

/**
 * §2.0 top bar — transparent over the canvas, three clusters:
 * left `[⛶] [🔍 Search jobs]`, centre the segmented control, right `NAVIGATION` +
 * `+ New session`.
 *
 * `grid-cols-[1fr_auto_1fr]` is load-bearing, not stylistic: the centre column is sized
 * by its content and the two `1fr` columns split the rest, so the tab group sits on the
 * true centre line of the viewport whatever the side clusters weigh. That is the
 * mechanism by which our fourth tab (SESSIONS) and the cost ticker "don't disturb the
 * layout" (§2.0).
 *
 * Padding carries `env(safe-area-inset-*)` for the notch (§3.6).
 */
export function TopBar(): React.JSX.Element {
  return (
    <header className="pointer-events-none grid grid-cols-[1fr_auto_1fr] items-center gap-3 pl-[calc(20px+env(safe-area-inset-left))] pr-[calc(20px+env(safe-area-inset-right))] pt-[calc(14px+env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2 justify-self-start">
        <FullscreenToggle />
        <SearchPill />
      </div>
      <div className="pointer-events-auto justify-self-center">
        <ViewTabs />
      </div>
      <div className="pointer-events-auto justify-self-end">
        <NewSessionAction />
      </div>
    </header>
  );
}
