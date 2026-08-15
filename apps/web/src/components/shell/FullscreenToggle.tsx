'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * §2.0 top-left: "fullscreen toggle (⛶, 32px ghost square)".
 *
 * Ghost square, not a pill — it is the one square control in a shell of pills, exactly
 * as in their frame. Drawn as an SVG rather than the ⛶ glyph so it renders identically
 * on every platform and inherits `currentColor` (monochrome chrome).
 */
export function FullscreenToggle({ className = '' }: { className?: string }): React.JSX.Element {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof document !== 'undefined' && document.fullscreenEnabled);
    const sync = (): void => setIsFullscreen(document.fullscreenElement !== null);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  if (!supported) return <></>;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-line bg-card text-ivory-2 transition-colors hover:border-line-2 hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-line-2 ${className}`}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        {isFullscreen ? (
          <>
            <path d="M6 1.5V6H1.5M10 14.5V10h4.5" />
            <path d="M14.5 6H10V1.5M1.5 10H6v4.5" />
          </>
        ) : (
          <>
            <path d="M1.5 5.5v-4h4M14.5 5.5v-4h-4" />
            <path d="M1.5 10.5v4h4M14.5 10.5v4h-4" />
          </>
        )}
      </svg>
    </button>
  );
}
