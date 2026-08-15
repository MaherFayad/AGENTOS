/**
 * §2.6.5 — `More detail →` opens the RIGHT drawer, which is `drawer-engineer`'s
 * (BOARD.md: they own §2.3 and §2.6.5). CHART emits a selection; it never renders a
 * second drawer. Two drawers would mean two copies of the agent projection, which is
 * exactly what Part IV forbids.
 *
 * Proposed to `drawer-engineer` in comms/inbox/drawer-engineer/ — if they name the event
 * differently, this file changes and nothing else does.
 */

export const OPEN_DRAWER_EVENT = 'commandcenter:open-drawer' as const;

export type DrawerSide = 'left' | 'right';

export interface OpenDrawerDetail {
  /** `{department}/{agent-slug}` — resolves against `GET /api/agents/:slug`. */
  agentSlug: string;
  /** CHART always asks for the right side (§2.6.5); MAP asks for the left (§2.3). */
  side: DrawerSide;
  /** Which view raised the selection, so the drawer can pick its variant. */
  source: 'chart';
}

export type OpenDrawerEvent = CustomEvent<OpenDrawerDetail>;

/** Optional injection point: the shell may pass a direct handler instead of listening. */
export type OpenDrawerHandler = (detail: OpenDrawerDetail) => void;

/**
 * Emit a drawer selection. Safe to call during SSR (no-ops without a document).
 */
export function openDrawer(
  agentSlug: string,
  options: { side?: DrawerSide; handler?: OpenDrawerHandler } = {},
): OpenDrawerDetail {
  const detail: OpenDrawerDetail = {
    agentSlug,
    side: options.side ?? 'right',
    source: 'chart',
  };
  if (options.handler) options.handler(detail);
  else if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(OPEN_DRAWER_EVENT, { detail, bubbles: true }));
  }
  return detail;
}
