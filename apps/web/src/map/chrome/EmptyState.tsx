/**
 * Honest empty — the graph payload is missing, so there is no map to count.
 * Never prints a node total. The canvas underneath still paints the sky.
 *
 * The body sentence has two possible sources: the catalogue, and the runner's own
 * English explanation. `serverOrCatalogue` decides — the runner's detail wins in
 * English, the readable sentence wins everywhere else (i18n/server-copy.ts).
 */

'use client';

import { serverOrCatalogue, useI18n } from '@/i18n';
import type { MapEmptyKey } from '../data/useGraph';

export function MapEmptyState({
  reason,
  serverMessage,
}: {
  reason: MapEmptyKey;
  serverMessage?: string | null;
}): React.JSX.Element {
  const { t, locale } = useI18n();
  const message = serverOrCatalogue(locale, t(reason, { command: 'npm run graph:build' }), serverMessage);
  return (
    <div
      data-testid="map-empty-state"
      className="pointer-events-none absolute inset-0 z-overlay grid place-items-center px-6"
    >
      <div className="max-w-[42ch] text-center">
        {/* A spec citation is a note to the builders, not a word for the person looking at
            an empty screen. The eyebrow names the view they are in. */}
        <p className="text-label-sm uppercase tracking-wider-3 text-ink-2">{t('shell.tab.map')}</p>
        <p className="mt-3 text-body font-semibold text-ivory-2">{t('map.empty.title')}</p>
        <p className="mt-2 text-small text-ink-2">{message}</p>
      </div>
    </div>
  );
}
