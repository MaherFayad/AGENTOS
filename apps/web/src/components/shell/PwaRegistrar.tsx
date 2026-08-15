'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '../../lib/pwa';

/**
 * Registers the service worker once, on mount (§3.6). Renders nothing.
 *
 * Deliberately not a `<Script>` or an inline snippet in the root layout: the root layout
 * belongs to `infra-compose-engineer`, and a component the shell owns keeps the PWA
 * wiring in one place with the rest of it.
 */
export function PwaRegistrar(): null {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
