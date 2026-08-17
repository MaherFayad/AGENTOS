'use client';

import { ViewMount } from '@/components/shell';
import { useI18n } from '@/i18n';

/**
 * The THREADS placeholder, in one client component so its copy can go through the
 * catalogue (`Plan §23.11` rule 6 — every new surface is Arabic-reviewed before it ships,
 * and a string typed into JSX is a string nobody can translate).
 *
 * **Both callers are `ViewMount`s and both are temporary.** `shell-navigation-engineer`
 * owns the tab slot and these routes; `sessions-relay-engineer` owns the view. When the
 * real thread list lands, this file and its four catalogue keys go with it — one directory
 * deleted, no residue.
 *
 * The keys are named literally rather than built from `variant`: a template-literal key is
 * a cast away from a key that does not exist, and the whole point of `StringKey` is that a
 * missing string fails the build instead of rendering as its own name.
 *
 * One body sentence serves both screens. Two would have been two entries in the Arabic
 * catalogue for copy that gets deleted this milestone — see the note on the keys.
 */
export function ThreadsMount({ variant }: { variant: 'list' | 'one' }): React.JSX.Element {
  const { t } = useI18n();
  return (
    <ViewMount
      title={variant === 'one' ? t('threads.mount.one.title') : t('threads.mount.title')}
      owner="sessions-relay-engineer"
      spec="Plan §23.8"
    >
      {t('threads.mount.body')}
    </ViewMount>
  );
}
