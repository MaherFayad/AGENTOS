import type { Metadata, Viewport } from 'next';

// Self-hosted fonts (§1.4, BOARD constraint 7 — no CDN, no runtime network requests).
// Weights follow comms/contracts/design-tokens.md §4: PJS 400/500/600/700 for body,
// labels, KPI numerals and display; Instrument Serif italic 400 for the accent words.
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/instrument-serif/400-italic.css';

import './globals.css';

export const metadata: Metadata = {
  title: 'Command Center',
  description: 'MAP / DASHBOARDS / CHART / SESSIONS',
};

// §3.6: the PWA installs to a phone home screen and must respect the notch.
// `themeColor` is deliberately NOT set here — it would be a literal hex outside
// tokens.css (BOARD constraint 3). It belongs to the PWA manifest, which
// `shell-navigation-engineer` owns along with the rest of §3.6.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

/**
 * Root layout — scaffold only (M0).
 *
 * `shell-navigation-engineer` owns §2.0 (the app shell, segmented tabs, search, cost
 * ticker, status pill) and will wrap {children} in it. Keep this file to html/body,
 * font imports and globals.css so the shell lands in one place.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
