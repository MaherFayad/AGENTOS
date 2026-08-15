'use client';

import type { ReactNode } from 'react';
import { BottomBar } from './BottomBar';
import { BreadcrumbStrip } from './BreadcrumbStrip';
import { HelpSheet } from './HelpSheet';
import { PwaRegistrar } from './PwaRegistrar';
import { ShellProvider } from './ShellContext';
import { TopBar } from './TopBar';

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
      <div className="relative h-[100dvh] w-full overflow-hidden bg-bg text-ivory">
        <a
          href="#view-canvas"
          className="sr-only left-4 top-4 z-[70] rounded-full border border-line-2 bg-bg-2 px-3 py-1.5 text-[12px] text-ivory focus:not-sr-only focus:absolute"
        >
          Skip to the view
        </a>

        <main id="view-canvas" tabIndex={-1} className="absolute inset-0 focus:outline-none">
          {children}
        </main>

        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col">
          <TopBar />
          <BreadcrumbStrip />
          <div className="flex-1" />
          <BottomBar />
        </div>

        <HelpSheet />
        <PwaRegistrar />
      </div>
    </ShellProvider>
  );
}
