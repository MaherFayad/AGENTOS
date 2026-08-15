'use client';

import Link from 'next/link';
import { breadcrumbFor, viewHasLiveCounter } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 breadcrumb strip — appears in drill-ins only: `← ALL DEPARTMENTS` top-left under
 * the bar, and top-right the `N OF 22 LIVE · YOUR TREE` counter (copper numeral, ivory
 * small-caps) where `YOUR TREE` filters the canvas to installed/live agents (§2.2).
 *
 * The numeral is the second and last piece of colour in the shell: copper marks "alive"
 * things (§1.3). It is only ever printed when a real count exists — no agent has run
 * yet is a sentence, not a zero.
 */
export function BreadcrumbStrip(): React.JSX.Element | null {
  const { route, liveCounts, liveCountsMessage, yourTree, toggleYourTree } = useShell();
  const crumb = breadcrumbFor(route);
  if (crumb === null) return null;

  const showCounter = viewHasLiveCounter(route.view);

  return (
    <div className="pointer-events-none flex items-start justify-between px-5 pt-2 sm:px-6">
      <Link
        href={crumb.href}
        className="pointer-events-auto text-label uppercase tracking-wider-1 text-ink-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
      >
        <span aria-hidden="true">← </span>
        {crumb.label}
      </Link>

      {showCounter && (
        <div className="pointer-events-auto flex items-center gap-2 text-label uppercase tracking-wider-1">
          {liveCounts === null ? (
            <span className="text-ink-2" title={liveCountsMessage ?? undefined}>
              NO LIVE COUNT YET
              <span className="sr-only">
                {liveCountsMessage ?? 'No agent has reported a run yet, so there is no live count to show.'}
              </span>
            </span>
          ) : (
            <span className="text-ivory-2">
              <span className="text-ink-copper tabular-nums">{liveCounts.live}</span> OF{' '}
              <span className="tabular-nums">{liveCounts.total}</span> LIVE
            </span>
          )}
          <span aria-hidden="true" className="text-ink-3">
            ·
          </span>
          <button
            type="button"
            onClick={toggleYourTree}
            aria-pressed={yourTree}
            title={
              yourTree
                ? 'Showing only agents that are installed and live.'
                : 'Filter this view to the agents you have installed and running.'
            }
            className={`uppercase tracking-wider-1 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2 ${
              yourTree ? 'text-ivory' : 'text-ink-2 hover:text-ivory-2'
            }`}
          >
            YOUR TREE
          </button>
        </div>
      )}
    </div>
  );
}
