'use client';

import { useEffect, useRef, useState } from 'react';
import { isStandalone, promptInstall, watchInstallPrompt } from '../../lib/pwa';
import { GlassPanel, Pill } from './ui';
import { useShell } from './ShellContext';

const SHORTCUTS: ReadonlyArray<{ keys: string; what: string }> = [
  { keys: '/', what: 'Focus search — the keyboard route to any agent on the map' },
  { keys: '↑ ↓', what: 'Walk search results' },
  { keys: 'Enter', what: 'Open the highlighted result and fly the map to it' },
  { keys: 'Esc', what: 'Clear the search, then close it' },
  { keys: '?', what: 'This panel' },
];

/**
 * The `?` pill's panel (§2.0 bottom-left). Three jobs: teach the keyboard path into a
 * canvas view, state the access model plainly — there is no sign-in because the app is
 * unreachable off the tailnet (§3.6) — and hold the install affordance.
 *
 * The install button lives here rather than in the top bar on purpose: §2.0 fixes what is
 * in that bar, and "don't disturb the layout" is an explicit instruction. A one-time
 * action belongs behind the one control that already means "the things you might not know
 * about".
 */
export function HelpSheet(): React.JSX.Element | null {
  const { helpOpen, setHelpOpen } = useShell();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(true); // assume installed until the client says otherwise — no flash of an offer we may not be able to make

  useEffect(() => {
    setInstalled(isStandalone());
    return watchInstallPrompt(setCanInstall);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (event.key !== '?' || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      setHelpOpen(!helpOpen);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, setHelpOpen]);

  useEffect(() => {
    if (helpOpen) {
      restoreTo.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else {
      restoreTo.current?.focus?.();
    }
  }, [helpOpen]);

  if (!helpOpen) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-toast flex items-end justify-start p-5 sm:p-6">
      <button
        type="button"
        aria-label="Close help"
        onClick={() => setHelpOpen(false)}
        className="absolute inset-0 cursor-default bg-transparent"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts and access"
        tabIndex={-1}
        className="relative w-[320px] focus:outline-none"
      >
        <GlassPanel radius="md" shadow="drawer" className="block p-4">
          <p className="mb-3 text-label-sm uppercase tracking-wider-3 text-ink-2">SHORTCUTS</p>
          <dl className="space-y-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex gap-3">
                <dt className="w-12 shrink-0 text-label tracking-normal text-ivory">{shortcut.keys}</dt>
                <dd className="text-meta text-ink-2">{shortcut.what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-meta text-ink-2">
            There is no sign-in. This command center is reachable only from your Tailscale
            network — if you can load it, you are already the only person who can.
          </p>

          {!installed && (
            <div className="mt-3 border-t border-line pt-3">
              {canInstall ? (
                <Pill variant="secondary" onClick={() => void promptInstall()}>
                  Add to home screen
                </Pill>
              ) : (
                <p className="text-meta text-ink-2">
                  To keep this on your phone, add it to your home screen from the browser
                  menu — on iPhone that is Share, then Add to Home Screen.
                </p>
              )}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
