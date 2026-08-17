'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedControl } from './ui';
import { VIEWS, VIEW_LABELS, viewHref, type ShellView } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 top-center: the segmented control. Three tabs are theirs (MAP · DASHBOARDS ·
 * CHART); the fourth is ours — `SESSIONS` (§3.1) until M16, `THREADS` since
 * (`Plan §23.8`). §2.0 is explicit that our addition must not disturb the layout, which is
 * why the top bar is a `grid-cols-[1fr_auto_1fr]` and this control is the `auto` column.
 * It stays optically centred no matter how wide the search pill or the right-hand cluster
 * get, and `Plan §23.5` names that mechanism as the load-bearing part not to touch.
 *
 * **The rename is a replacement and the count is fixed at four** — `MAX_SEGMENTED_TABS`,
 * gated in `route.test.ts`. THREADS is one glyph shorter than SESSIONS, so the strip is
 * marginally narrower than the arrangement §23.5 measured; nothing reflows.
 *
 * The visual grammar (ivory pill for active, `--ink-2` for inactive, 11px uppercase
 * +0.25em) belongs to `SegmentedControl` — the shell only supplies items and routing.
 * Chrome is monochrome (§1.3): a tab is chrome, so THREADS carries no colour of its own
 * and no unread badge tinted to mean something. Counts, when they arrive, are §23.5's
 * top-right pair, not a dot on a tab.
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
   * `overflow-x-auto` engages and the strip scrolls. Left alone, opening `/sessions/:id`
   * directly — which is exactly what a push notification link does (§3.6) — parks the
   * one selected tab past the right edge, at `scrollLeft: 0`, and the shell looks like
   * nothing is selected. Verified at 375×812 before this existed. It still applies after
   * M16: a session path selects THREADS, which is the fourth tab and the one that
   * overflows.
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
