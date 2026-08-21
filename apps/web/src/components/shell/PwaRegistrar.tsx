'use client';

import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { DEV_SERVICE_WORKER_EVICTION, isDevelopment, registerServiceWorker } from '../../lib/pwa';

/**
 * Registers the service worker in production (§3.6), and **evicts** it in development.
 * Renders nothing in production; renders one inline script in development.
 *
 * Deliberately not a `<Script>` or an inline snippet in the root layout: the root layout
 * belongs to `infra-compose-engineer`, and a component the shell owns keeps the PWA
 * wiring in one place with the rest of it.
 *
 * ## Why development gets a `<script>` and not an effect
 *
 * A service worker under `next dev` pins one build's chunks forever (dev chunk URLs are
 * stable and non-hashed) and a hard reload does not clear it, because the worker answers
 * `fetch` before the HTTP cache is consulted. The browser in that state is therefore
 * running **yesterday's bundle** — so any repair written as an effect ships in a file that
 * browser will never execute. Navigations are network-only in `sw.js`, which means the
 * server-rendered HTML is always current; an inline script is the only code on the page
 * that is guaranteed to be today's.
 *
 * The effect below still runs, and is still the production path. It cannot rescue anyone,
 * and does not claim to.
 */
export function PwaRegistrar(): ReactElement | null {
  useEffect(() => {
    // `registerServiceWorker` is itself a no-op in development; calling it unconditionally
    // keeps the environment decision in exactly one place.
    void registerServiceWorker();
  }, []);

  if (!isDevelopment()) return null;
  return <script dangerouslySetInnerHTML={{ __html: DEV_SERVICE_WORKER_EVICTION }} />;
}
