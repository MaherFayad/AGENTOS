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
