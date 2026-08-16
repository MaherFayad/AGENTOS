/**
 * The §2.0 shell — public surface. Anything not exported here is private to the shell
 * and may change without a message (comms/README.md).
 *
 * Owner: shell-navigation-engineer.
 */

export { AppShell } from './AppShell';
export { ViewMount } from './ViewMount';
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
export { NEW_SESSION_HREF } from './NewSessionAction';
