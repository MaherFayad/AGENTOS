'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedControl } from './ui';
import { VIEWS, VIEW_LABELS, viewHref, type ShellView } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 top-center: the segmented control. Three tabs are theirs (MAP · DASHBOARDS ·
 * CHART); `SESSIONS` is our fourth (§3.1) and §2.0 is explicit that adding it must not
 * disturb the layout — which is why the top bar is a
 * `grid-cols-[1fr_auto_1fr]` and this control is the `auto` column. It stays optically
 * centred no matter how wide the search pill or the right-hand cluster get.
 *
 * The visual grammar (ivory pill for active, `--ink-2` for inactive, 11px uppercase
 * +0.25em) belongs to `SegmentedControl` — the shell only supplies items and routing.
 */
export function ViewTabs(): React.JSX.Element {
  const router = useRouter();
  const { route, reducedMotion } = useShell();
  const host = useRef<HTMLDivElement>(null);

  // The project travels with the tab (M15): switching MAP → CHART must not silently leave
  // the project you were in, and `viewHref` degrades to the unscoped path when the URL
  // never named one, so this call site has no `null` case of its own to get wrong.
  const onChange = useCallback(
    (value: ShellView) => {
      router.push(viewHref(value, route.project));
    },
    [router, route.project],
  );

  /**
   * Keep the active tab on screen.
   *
   * The four labels are ~400px of wide-tracked caps, so on a 375px phone `TopBar`'s
   * `overflow-x-auto` engages and the strip scrolls. Left alone, opening `/sessions`
   * directly — which is exactly what a push notification link does (§3.6) — parks the
   * one selected tab past the right edge, at `scrollLeft: 0`, and the shell looks like
   * nothing is selected. Verified at 375×812 before this existed.
   *
   * `inline: 'nearest'` scrolls the minimum needed and does nothing when the tab is
   * already visible, so the 1440px layout never moves. `scrollIntoView` is feature-tested
   * because jsdom does not implement it.
   */
  useEffect(() => {
    const active = host.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (typeof active?.scrollIntoView !== 'function') return;
    active.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [route.view, reducedMotion]);

  return (
    // `display: contents` — a handle for the effect above, with no box of its own, so the
    // control stays the direct child of the centring grid column.
    <div ref={host} className="contents">
      <SegmentedControl<ShellView>
        label="Views"
        value={route.view}
        onChange={onChange}
        options={VIEWS.map((view) => ({ value: view, label: VIEW_LABELS[view] }))}
      />
    </div>
  );
}
