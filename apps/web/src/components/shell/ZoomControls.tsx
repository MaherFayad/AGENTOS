'use client';

import { useCallback } from 'react';
import { emit } from '../../lib/shell-bus';
import { viewHasZoom } from './route';
import { useShell } from './ShellContext';

const BUTTON =
  'grid h-7 w-7 place-items-center rounded-pill text-ivory-2 transition-colors hover:bg-card-2 hover:text-ivory disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-line-2';

/**
 * §2.0 bottom-left: `?` help pill, `−`/`+` zoom, zoom-level readout.
 *
 * The shell owns the buttons, the canvas owns the camera. The buttons publish
 * `shell:zoom`; the canvas publishes `shell:zoomChanged` and the readout renders it.
 * The shell never guesses a level — before a canvas has reported one the readout is an
 * em dash, because "100%" would be a number we made up (standing rule 9).
 */
export function ZoomControls(): React.JSX.Element {
  const { route, zoom, setHelpOpen } = useShell();
  const enabled = viewHasZoom(route.view);

  const step = useCallback((direction: 'in' | 'out') => emit('shell:zoom', { direction }), []);
  const reset = useCallback(() => emit('shell:zoom', { direction: 'reset' }), []);

  const readout = zoom === null ? '—' : `${Math.round(zoom * 100)}%`;
  // "…has not reported a zoom level yet" is only honest on a view that will eventually
  // report one. On CHART it never would, and `viewHasZoom` used to say CHART had zoom, so
  // the readout sat there promising a number that was not coming. Both branches now name
  // only MAP, which is the only view that answers `shell:zoom`.
  const readoutTitle =
    zoom === null
      ? enabled
        ? 'The map has not reported a zoom level yet.'
        : 'Zoom applies to the MAP view.'
      : 'Reset zoom to 100%';

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label="Keyboard shortcuts and help"
        title="Keyboard shortcuts (?)"
        className="grid h-7 w-7 place-items-center rounded-pill border border-line bg-card text-meta text-ivory-2 transition-colors hover:border-line-2 hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-line-2"
      >
        ?
      </button>

      <div className="flex items-center gap-1 rounded-pill border border-line bg-card px-1">
        <button type="button" className={BUTTON} onClick={() => step('out')} disabled={!enabled} aria-label="Zoom out">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M2.5 6h7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!enabled || zoom === null}
          title={readoutTitle}
          aria-label={`Zoom level ${readout}`}
          className="min-w-[42px] rounded-pill px-1 text-center text-label tracking-normal tabular-nums text-ink-2 transition-colors hover:text-ivory disabled:hover:text-ink-2"
        >
          {readout}
        </button>
        <button type="button" className={BUTTON} onClick={() => step('in')} disabled={!enabled} aria-label="Zoom in">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M6 2.5v7M2.5 6h7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
