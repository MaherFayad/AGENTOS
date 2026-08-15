'use client';

import { useEffect, useRef } from 'react';
import { GlassPanel } from './ui';
import { useShell } from './ShellContext';

const SHORTCUTS: ReadonlyArray<{ keys: string; what: string }> = [
  { keys: '/', what: 'Focus search — the keyboard route to any agent on the map' },
  { keys: '↑ ↓', what: 'Walk search results' },
  { keys: 'Enter', what: 'Open the highlighted result and fly the map to it' },
  { keys: 'Esc', what: 'Clear the search, then close it' },
  { keys: '?', what: 'This panel' },
];

/**
 * The `?` pill's panel (§2.0 bottom-left). Two jobs: teach the keyboard path into a
 * canvas view, and state the access model plainly — there is no sign-in because the app
 * is unreachable off the tailnet (§3.6). A person who sees no login should be told why,
 * once, here.
 */
export function HelpSheet(): React.JSX.Element | null {
  const { helpOpen, setHelpOpen } = useShell();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

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
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-start p-5 sm:p-6">
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
        <GlassPanel className="block rounded-[16px] border border-line p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.35em] text-ink-2">SHORTCUTS</p>
          <dl className="space-y-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex gap-3">
                <dt className="w-12 shrink-0 text-[11px] text-ivory">{shortcut.keys}</dt>
                <dd className="text-[12px] leading-[1.5] text-ink-2">{shortcut.what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-[1.6] text-ink-2">
            There is no sign-in. This command center is reachable only from your Tailscale
            network — if you can load it, you are already the only person who can.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
