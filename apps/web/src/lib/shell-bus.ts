/**
 * The shell event bus — the typed interface between the chrome (§2.0) and whatever is
 * painting the canvas underneath it (§2.1 map, §2.6 chart).
 *
 * Why an event bus and not props or a store: the shell is a fixed overlay rendered by
 * `(views)/layout.tsx`, the canvas is rendered by a page below it. They are siblings in
 * the React tree, they are owned by different agents, and the canvas is imperative D3.
 * A one-way event with a named, versioned payload is the smallest coupling that works
 * and the only one that survives either side being rewritten.
 *
 * Owner: shell-navigation-engineer. **Publishers and subscribers listed per event.**
 * Adding an event = a message to this owner; changing a payload = an ADR.
 */

export type FlyToTarget =
  | { kind: 'node'; id: string; department?: string }
  | { kind: 'department'; id: string };

export interface FlyToDetail {
  target: FlyToTarget;
  /** Where the request came from — the map may want to skip animation on a deep link. */
  source: 'search' | 'breadcrumb' | 'deeplink' | 'chip';
  /** Animation budget in ms. Supplied by the shell from `primitives/motion`, §1.6. */
  durationMs: number;
}

export interface ZoomRequestDetail {
  /** `set` carries `level`; `in`/`out` step by the canvas's own increment. */
  direction: 'in' | 'out' | 'set' | 'reset';
  /** 1 = 100%. Clamped by the canvas to 0.3–3.0 (contracts/graph-layout.md). */
  level?: number;
}

export interface ZoomChangedDetail {
  /** 1 = 100%. The shell renders `Math.round(level * 100)%` in the zoom readout. */
  level: number;
}

export interface LiveCountDetail {
  /** Department slug (ADR-001), or `null` at the galaxy root (all departments). */
  department: string | null;
  live: number;
  total: number;
}

export interface YourTreeDetail {
  /** True = filter the canvas to installed/live agents only (§2.2). */
  enabled: boolean;
}

/**
 * Every event on the bus. Names are namespaced `shell:` so a stray listener on
 * `window` can never collide with a DOM event.
 */
export interface ShellEventMap {
  /** Shell → canvas. Centre the camera on a node/department. */
  'shell:flyTo': FlyToDetail;
  /** Shell → canvas. The −/+ buttons and keyboard zoom. */
  'shell:zoom': ZoomRequestDetail;
  /** Canvas → shell. Reports the current camera scale for the zoom readout. */
  'shell:zoomChanged': ZoomChangedDetail;
  /** Canvas → shell. Real counts for the `N OF 22 LIVE` counter. Never synthesised. */
  'shell:liveCount': LiveCountDetail;
  /** Shell → canvas. The `YOUR TREE` toggle in the breadcrumb strip. */
  'shell:yourTree': YourTreeDetail;
}

export type ShellEventName = keyof ShellEventMap;

type Handler<K extends ShellEventName> = (detail: ShellEventMap[K]) => void;

let target: EventTarget | null = null;

/** Lazily created so importing this module is safe during SSR. */
function bus(): EventTarget {
  if (target === null) target = new EventTarget();
  return target;
}

/** Publish an event. No-op-safe on the server (no subscribers exist there). */
export function emit<K extends ShellEventName>(name: K, detail: ShellEventMap[K]): void {
  bus().dispatchEvent(new CustomEvent(name, { detail }));
}

/** Subscribe. Returns the unsubscribe function — call it from a `useEffect` cleanup. */
export function on<K extends ShellEventName>(name: K, handler: Handler<K>): () => void {
  const listener = (event: Event): void => {
    handler((event as CustomEvent<ShellEventMap[K]>).detail);
  };
  bus().addEventListener(name, listener);
  return () => bus().removeEventListener(name, listener);
}

/** Test seam only: drop every subscriber. Never call this from app code. */
export function resetBusForTests(): void {
  target = null;
}
