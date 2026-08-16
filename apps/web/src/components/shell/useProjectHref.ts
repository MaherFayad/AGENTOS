'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { splitProject, withProject } from './route';

/**
 * Build a link that stays in the project you are already in (M15, `Plan §9`).
 *
 * ```tsx
 * const href = useProjectHref();
 * router.push(href(`/map/${department}`));   // → /p/agentos/map/sales
 * ```
 *
 * **Why this exists rather than `useShell().route.project`.** Every view in the app now
 * has to prefix the URLs it builds, and the views are owned by five different agents.
 * `useShell` would drag a React context requirement into `MapView`, `Carousel`,
 * `DashboardDetail` and the sessions list — components whose own tests render them
 * without the shell around them, so the cost of the context is paid by four suites that
 * have nothing to do with projects.
 *
 * This hook needs only `next/navigation`, which every one of those components already
 * uses for `useRouter`. It reads the segment from the same pure `splitProject` the shell
 * parses its route with, so there is still exactly one definition of what `/p/:project`
 * means.
 *
 * When the URL names no project the returned path is unchanged — the pre-M15 shape,
 * which the legacy resolver then rewrites. A caller never has to handle `null`.
 */
export function useProjectHref(): (path: string) => string {
  const pathname = usePathname() ?? '';
  const { project } = splitProject(pathname);
  return useCallback((path: string) => withProject(path, project), [project]);
}

/** The raw segment, for callers that need the slug itself rather than a URL. */
export function useProjectSegment(): string | null {
  const pathname = usePathname() ?? '';
  return splitProject(pathname).project;
}
