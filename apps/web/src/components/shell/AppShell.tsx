'use client';

import type { ReactNode } from 'react';
import { BottomBar } from './BottomBar';
import { BreadcrumbStrip } from './BreadcrumbStrip';
import { HelpSheet } from './HelpSheet';
import { PwaRegistrar } from './PwaRegistrar';
import { ShellProvider, useShell } from './ShellContext';
import { TopBar } from './TopBar';
import { viewSurface } from './route';
import { useShellInsets } from './useShellInsets';

/**
 * The §2.0 shell: one transparent overlay above whichever view is painting the canvas.
 *
 * Structure, and why:
 *  - `children` (the view) fills the frame absolutely; the chrome is a sibling overlay
 *    with `pointer-events-none`, re-enabled per control. A canvas you can drag from edge
 *    to edge *under* the bar is the difference between this and a dashboard with a
 *    header.
 *  - `100dvh`, not `100vh`: on a phone the URL bar collapses, and `vh` would leave the
 *    bottom pills under it (§3.6).
 *  - The skip link is the first tabbable thing on the page — the map is a canvas, so a
 *    keyboard user needs both a way in (search) and a way past.
 */
export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ShellProvider>
      <ShellFrame>{children}</ShellFrame>
    </ShellProvider>
  );
}

/**
 * Inside the provider, because the frame is route-aware: how much of the viewport the
 * view may use depends on whether the view paints under the chrome or flows beneath it
 * (`viewSurface`, route.ts).
 *
 * THE CONTRACT THIS ENFORCES. The bar floats over the canvas by design, so the top and
 * bottom bands of the viewport belong to the chrome. A `flow` view gets those bands
 * reserved for it here — one `padding` on one element, sourced from the same
 * `--shell-inset-*` the bar publishes about itself. No view has to know the bar's
 * height, and no view can be wrong about it. CHART printing its department tabs on the
 * same row as the search pill was this padding not existing.
 *
 * A `flow` view also scrolls here rather than at the document, because the shell root is
 * `overflow-hidden` (the bar must not scroll away) — so the scroll container has to be
 * the view, and the reserved bands have to be padding rather than a smaller box, so that
 * the first row starts clear of the bar and the last row can still travel up past it.
 */
function ShellFrame({ children }: { children: ReactNode }): React.JSX.Element {
  const { route } = useShell();
  const surface = viewSurface(route.view);
  const { rootRef, topRef, bottomRef } = useShellInsets();

  return (
    <div
      ref={rootRef}
      data-shell-root=""
      className="relative h-[100dvh] w-full overflow-hidden bg-bg text-ivory"
    >
      <a
        href="#view-canvas"
        className="sr-only left-4 top-4 z-toast rounded-pill border border-line-2 bg-bg-2 px-3 py-1.5 text-meta text-ivory focus:not-sr-only focus:absolute"
      >
        Skip to the view
      </a>

      <main
        id="view-canvas"
        tabIndex={-1}
        data-surface={surface}
        className={
          surface === 'flow'
            ? 'absolute inset-0 overflow-auto overscroll-contain pb-[var(--shell-inset-b)] pt-[var(--shell-inset-t)] focus:outline-none'
            : 'absolute inset-0 focus:outline-none'
        }
      >
        {children}
      </main>

      <div className="pointer-events-none absolute inset-0 z-chrome flex flex-col">
        <div ref={topRef}>
          <TopBar />
          <BreadcrumbStrip />
        </div>
        <div className="flex-1" />
        <div ref={bottomRef}>
          <BottomBar />
        </div>
      </div>

      <HelpSheet />
      <PwaRegistrar />
    </div>
  );
}
