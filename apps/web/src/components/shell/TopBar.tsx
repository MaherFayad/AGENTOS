'use client';

import { FullscreenToggle } from './FullscreenToggle';
import { NewSessionAction } from './NewSessionAction';
import { ProjectSwitcher } from './ProjectSwitcher';
import { SearchPill } from './SearchPill';
import { ViewTabs } from './ViewTabs';

/**
 * §2.0 top bar — transparent over the canvas, three clusters:
 * left `[AGENTOS ▾] [⛶] [🔍 Search jobs]`, centre the segmented control, right
 * `NAVIGATION` + `+ New session`.
 *
 * `grid-cols-[1fr_auto_1fr]` is load-bearing, not stylistic: the centre column is sized
 * by its content and the two `1fr` columns split the rest, so the tab group sits on the
 * true centre line of the viewport whatever the side clusters weigh. That is the
 * mechanism by which our fourth tab (SESSIONS until M16, THREADS since) and the cost
 * ticker "don't disturb the layout" (§2.0). M16 spent the slot rather than adding one, so
 * the centre column's budget is unchanged — see `MAX_SEGMENTED_TABS` in `route.ts`.
 *
 * **M15 adds the project switcher and spends none of the centre column's budget.**
 * `Plan §23.10` puts it "before the fullscreen toggle" and calls it the highest-frequency
 * control in the app; `Plan §23.5` shows the segmented control is already at its width
 * limit — four wide-tracked labels measure ~400px and six will not fit, which is why
 * THREADS and CALENDAR are destined for the right cluster rather than a fifth and sixth
 * tab. The switcher joins the *left* cluster, inside an existing `1fr` column, so the
 * `auto` centre column is unchanged and the tabs do not move by a pixel. No tab is added
 * here and none should be: the two-level split is P2's, and pre-building it would be
 * carrying a design decision for a view that does not exist.
 *
 * The left cluster now holds three controls on a 375px phone, which is one more than the
 * row was designed for, so two things give in a stated order. **The fullscreen toggle
 * hides below `sm`** — it is a desktop affordance, the Fullscreen API does not exist on
 * iOS Safari at all (the control already renders nothing there), and an installed PWA is
 * running in `standalone` display mode, where a fullscreen button toggles nothing. **The
 * search pill flexes** into whatever room is left, capped at its old width. Neither the
 * switcher nor search is ever dropped: one answers "which project am I in" and the other
 * is the keyboard path onto a canvas, and a phone needs both.
 *
 * Below `sm` the three clusters cannot share a row — search + tabs + action measure well
 * past 375px — so the same grid becomes two rows: controls and action on the first, the
 * segmented control centred on its own second row. Nothing is hidden and no tab is
 * dropped; a phone gets the whole of §2.0, one row lower. The bar's extra height is
 * *measured*, not declared (useShellInsets), so every flow view moves down with it on its
 * own — the two-row bar needed no change anywhere else in the app.
 *
 * Padding carries `env(safe-area-inset-*)` for the notch (§3.6).
 */
export function TopBar(): React.JSX.Element {
  return (
    <header className="pointer-events-none grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 pl-[calc(20px+env(safe-area-inset-left))] pr-[calc(20px+env(safe-area-inset-right))] pt-[calc(14px+env(safe-area-inset-top))] sm:grid-cols-[1fr_auto_1fr]">
      <div className="pointer-events-auto col-start-1 row-start-1 flex min-w-0 items-center gap-2 justify-self-start max-sm:w-full">
        <ProjectSwitcher />
        <FullscreenToggle className="max-sm:hidden" />
        <SearchPill />
      </div>
      {/* `max-w-full overflow-x-auto` only ever engages on the narrowest phones: the four
          wide-tracked labels are ~400px and must stay reachable rather than clipped. The
          scrollbar is suppressed because it would be chrome inside chrome. */}
      <div className="pointer-events-auto col-span-2 col-start-1 row-start-2 max-w-full justify-self-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <ViewTabs />
      </div>
      <div className="pointer-events-auto col-start-2 row-start-1 justify-self-end sm:col-start-3">
        <NewSessionAction />
      </div>
    </header>
  );
}
