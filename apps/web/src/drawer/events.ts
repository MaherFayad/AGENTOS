/**
 * The drawer's inbound events (ADR-004).
 *
 * `map-galaxy-engineer` and `chart-matrix-engineer` open the drawer by publishing an
 * event; they never import the drawer component. That is the same argument
 * `src/lib/shell-bus.ts` makes for the shell — siblings in the React tree, owned by
 * different agents, one-way payload — so this module copies its shape deliberately.
 *
 * Two delivery paths, one payload:
 *   - a module-local EventTarget, for anyone who imports `openDrawer()`;
 *   - `window`, for a publisher that would rather dispatch a raw CustomEvent than import
 *     anything at all.
 * `seq` makes the double-delivery idempotent, so a publisher can use either or both.
 *
 * The outbound direction (a `BREAKS INTO` chip flying the map to a leaf node) is NOT here:
 * it goes out on the shell bus as `shell:flyTo`, which already exists and already has a
 * `source: 'chip'` case.
 *
 * Owner: drawer-engineer
 */

export const DRAWER_OPEN = 'drawer:open';
export const DRAWER_CLOSE = 'drawer:close';

export interface DrawerOpenDetail {
  /** `department/agent-name` — the node id from contracts/graph-layout.md. */
  slug: string;
  /**
   * Which projection asked. `map` opens the §2.3 drawer on the inline-start edge, `chart`
   * the §2.6.5 drawer on the inline-end edge. In RTL both mirror (§1.4).
   */
  view?: 'map' | 'chart';
  /** Set by the publisher for double-delivery de-duplication. Filled in if absent. */
  seq?: number;
}

type OpenHandler = (detail: Required<Pick<DrawerOpenDetail, 'slug' | 'seq'>> & DrawerOpenDetail) => void;

let bus: EventTarget | null = null;
let counter = 0;

/** Lazy, so importing this module is safe during SSR. */
function target(): EventTarget {
  if (bus === null) bus = new EventTarget();
  return bus;
}

/** Open the drawer for an agent. Safe to call from an event handler on either canvas. */
export function openDrawer(detail: DrawerOpenDetail): void {
  counter += 1;
  const payload: DrawerOpenDetail = { view: 'map', ...detail, seq: detail.seq ?? counter };
  target().dispatchEvent(new CustomEvent(DRAWER_OPEN, { detail: payload }));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DRAWER_OPEN, { detail: payload }));
  }
}

export function closeDrawer(): void {
  target().dispatchEvent(new CustomEvent(DRAWER_CLOSE));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DRAWER_CLOSE));
}

/** Subscribe. Returns the unsubscribe function — call it from a `useEffect` cleanup. */
export function onDrawerOpen(handler: OpenHandler): () => void {
  let lastSeq = -1;
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<DrawerOpenDetail>).detail;
    if (!detail || typeof detail.slug !== 'string') return;
    const seq = detail.seq ?? ++counter;
    if (seq === lastSeq) return; // same event, second delivery path
    lastSeq = seq;
    handler({ ...detail, seq });
  };
  target().addEventListener(DRAWER_OPEN, listener);
  if (typeof window !== 'undefined') window.addEventListener(DRAWER_OPEN, listener);
  return () => {
    target().removeEventListener(DRAWER_OPEN, listener);
    if (typeof window !== 'undefined') window.removeEventListener(DRAWER_OPEN, listener);
  };
}

export function onDrawerClose(handler: () => void): () => void {
  const listener = (): void => handler();
  target().addEventListener(DRAWER_CLOSE, listener);
  if (typeof window !== 'undefined') window.addEventListener(DRAWER_CLOSE, listener);
  return () => {
    target().removeEventListener(DRAWER_CLOSE, listener);
    if (typeof window !== 'undefined') window.removeEventListener(DRAWER_CLOSE, listener);
  };
}

/** Test seam only. Never call this from app code. */
export function resetDrawerBusForTests(): void {
  bus = null;
  counter = 0;
}
