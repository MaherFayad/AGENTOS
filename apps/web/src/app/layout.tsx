import type { Metadata, Viewport } from 'next';

import { DEFAULT_LOCALE, HTML_LANG, directionOf } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
// One import wires all three self-hosted families, including IBM Plex Sans
// Arabic (comms/contracts/design-tokens.md §4). Do not import @fontsource/*
// anywhere else or the weight set drifts.
import '@/styles/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Command Center',
  description: 'MAP / DASHBOARDS / CHART / THREADS',
};

// §3.6: the PWA installs to a phone home screen and must respect the notch.
// `themeColor` is deliberately NOT set here — it would be a literal hex outside
// tokens.css (BOARD constraint 3). It belongs to the PWA manifest, which
// `shell-navigation-engineer` owns along with the rest of §3.6.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

/**
 * Root layout — html/body, fonts, direction, the i18n provider.
 *
 * `shell-navigation-engineer` owns §2.0 (the app shell) and wraps {children}
 * further down. Locale switching is M8; until then the default is English LTR,
 * driven from i18n/config.ts so `dir` and `lang` cannot drift from the catalogue.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE;
  return (
    <html lang={HTML_LANG[locale]} dir={directionOf(locale)} suppressHydrationWarning>
      {/*
       * `suppressHydrationWarning` here is about **browser extensions, not our render**.
       *
       * Extensions mutate `<body>` before React hydrates — ColorZilla adds
       * `cz-shortcut-listen="true"`, Grammarly adds `data-gr-*`, and several password
       * managers add their own. React compares the server HTML against the DOM it finds,
       * sees an attribute the server never wrote, and reports a hydration mismatch that
       * names `layout.tsx` — pointing a developer at code that is correct.
       *
       * It suppresses **one level only**: attribute and text differences on `<body>`
       * itself. A real mismatch inside any child still reports normally, which is what
       * keeps this from being a blanket silencer — and is why it goes here rather than
       * on a wrapper further down. `<html>` already carries it for the same reason.
       */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
