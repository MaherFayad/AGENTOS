import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '../../components/shell';

/**
 * Every view lives under this route group, so the §2.0 shell mounts exactly once and
 * survives navigation between MAP / DASHBOARDS / CHART / SESSIONS — the top bar never
 * remounts, so the search box keeps focus and the tabs never flash.
 *
 * `viewport-fit: cover` + the shell's `env(safe-area-inset-*)` padding is the §3.6
 * notch story. The root `app/layout.tsx` (owned by `infra-compose-engineer`) keeps the
 * font and `<html>` wiring; this layout adds only what the shell needs.
 *
 * THE OFFSET CONTRACT, for anyone mounting a view under here. The §2.0 bar is
 * transparent and floats over the canvas, so the top and bottom bands of the viewport
 * belong to the chrome. `<AppShell>` reserves those bands for you — a view in document
 * flow starts below the bar with no padding of its own, because the shell applies
 * `--shell-inset-t` / `--shell-inset-b` to the frame it mounts you in.
 *
 * If your view is a full-bleed canvas that deliberately paints *under* the bar (MAP's
 * galaxy, the DASHBOARDS carousel), name it in `CANVAS_VIEWS` in
 * `components/shell/route.ts` and place your own content clear of the chrome by reading
 * the same two variables. Do not type the bar's height into your stylesheet: the two
 * variables are measured from the rendered bar, and a literal will drift the first time
 * the bar changes or a breadcrumb strip appears.
 */
export const metadata: Metadata = {
  title: 'Command Center',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Command Center' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // pinch-zoom stays available: never trap a phone user at 1×
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export default function ViewsLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
