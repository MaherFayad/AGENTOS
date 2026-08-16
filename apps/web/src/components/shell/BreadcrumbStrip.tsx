'use client';

import Link from 'next/link';
import { breadcrumbFor, projectTrail, viewHasLiveCounter } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 breadcrumb strip — appears in drill-ins only: `← ALL DEPARTMENTS` top-left under
 * the bar, and top-right the `N OF 22 LIVE · YOUR TREE` counter (copper numeral, ivory
 * small-caps) where `YOUR TREE` filters the canvas to installed/live agents (§2.2).
 *
 * The numeral is the second and last piece of colour in the shell: copper marks "alive"
 * things (§1.3). It is only ever printed when a real count exists — no agent has run
 * yet is a sentence, not a zero.
 *
 * **M15 adds the project trail** (`Plan §23.10`: `AgentOS › Sales › account-enrichment`).
 * It sits under the back link rather than replacing it: the back link is an *action* and
 * the trail is a *statement of position*, and merging the two costs the one-tap way out
 * of a drill-in on a phone. The separator is rendered by this component, never baked into
 * copy, so RTL flips it (§1.4).
 *
 * The head crumb prints the project **the URL names**. It shows the coordinator's display
 * name only once the coordinator has confirmed that slug exists, and marks it otherwise.
 * A trail is the one place in the chrome a reader trusts without checking, so it must not
 * be the place a configured value gets read as an observed one.
 */
export function BreadcrumbStrip(): React.JSX.Element | null {
  const { route, project, liveCounts, liveCountsMessage, yourTree, toggleYourTree } = useShell();
  const crumb = breadcrumbFor(route);
  if (crumb === null) return null;

  const showCounter = viewHasLiveCounter(route.view);
  const trail = projectTrail(route);

  return (
    <div className="pointer-events-none flex items-start justify-between gap-4 px-5 pt-2 sm:px-6">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Link
          href={crumb.href}
          className="pointer-events-auto text-label uppercase tracking-wider-1 text-ink-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
        >
          <span aria-hidden="true">← </span>
          {crumb.label}
        </Link>

        <nav
          aria-label="Where you are"
          className="pointer-events-auto flex min-w-0 max-w-full items-center gap-1.5 text-label-sm uppercase tracking-wider-1 text-ink-3"
        >
          <span
            className={`max-w-[132px] truncate ${project.confirmed ? 'text-ivory-2' : 'text-ink-2'}`}
            title={project.message ?? undefined}
          >
            {trail.project ?? 'no project'}
            {/* Same mark as the switcher pill, same reason: the reader is told, in the
                visible label rather than a tooltip a phone cannot show, that nothing has
                confirmed this name. */}
            {!project.confirmed && <span aria-hidden="true"> ?</span>}
            {!project.confirmed && (
              <span className="sr-only">
                {project.message ?? ' This project name has not been confirmed by the runner.'}
              </span>
            )}
          </span>
          {trail.department && (
            <>
              <span aria-hidden="true">›</span>
              <span className="max-w-[110px] truncate text-ivory-2">{trail.department}</span>
            </>
          )}
          {trail.leaf && (
            <>
              <span aria-hidden="true">›</span>
              <span className="max-w-[150px] truncate text-ink-2">{trail.leaf}</span>
            </>
          )}
        </nav>
      </div>

      {showCounter && (
        <div className="pointer-events-auto flex shrink-0 items-center gap-2 text-label uppercase tracking-wider-1">
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
