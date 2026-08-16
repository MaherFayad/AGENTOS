/**
 * The §2.0 shell — public surface. Anything not exported here is private to the shell
 * and may change without a message (comms/README.md).
 *
 * Owner: shell-navigation-engineer.
 */

export { AppShell } from './AppShell';
export { ViewMount } from './ViewMount';
export { LegacyRouteResolver } from './LegacyRouteResolver';
export { useShell, usePrefersReducedMotion, type ShellState } from './ShellContext';
export {
  parseShellRoute,
  breadcrumbFor,
  searchPlaceholder,
  viewHref,
  viewHasZoom,
  viewHasLiveCounter,
  viewSurface,
  VIEWS,
  VIEW_LABELS,
  type ShellView,
  type ShellRoute,
  type ViewSurface,
} from './route';
/**
 * The project segment's href builders (M15, `Plan §9`).
 *
 * **Every view that builds a URL must go through these.** They are exported rather than
 * kept private precisely because the alternative — each view interpolating `/p/${slug}/`
 * itself — puts the shape of the segment in six places, and the day one of them is wrong
 * it produces a link to another project's data rather than a 404. `withProject` is the
 * one to reach for; it degrades to the pre-project path when the project is unknown, so a
 * caller never has to decide what to do about `null`.
 */
export {
  withProject,
  projectPrefix,
  switchProjectHref,
  projectTrail,
  splitProject,
  PROJECT_SEGMENT,
  type ProjectTrail,
} from './route';
export { useProjectHref, useProjectSegment } from './useProjectHref';
export { newSessionHref } from './NewSessionAction';
export type { ProjectScope, ProjectRow, ProjectsReading } from './useProjects';
