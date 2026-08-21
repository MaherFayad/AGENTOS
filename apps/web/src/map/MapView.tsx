'use client';

/**
 * The galaxy view (§2.1) and department drill-in (§2.2). Canvas underlay, SVG graph.
 *
 * This file composes; it does not own layout (scripts/lib/layout.mjs) or the drawer
 * (drawer-engineer). Node activation emits `openDrawer` and pushes the route.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GraphNode, GraphPayload } from '@agnetos/contracts';
import { findDepartment } from '@agnetos/contracts';
import { DURATION, useReducedMotion, withReducedMotion } from '@/components/primitives/motion';
import { useProjectHref, useProjectSegment } from '@/components/shell/useProjectHref';
import { openDrawer } from '@/drawer/events';
import { useT } from '@/i18n';
import { emit, on } from '@/lib/shell-bus';
import { GalaxyCanvas } from './canvas/GalaxyCanvas';
import { DepartmentRails } from './chrome/DepartmentRails';
import { MapEmptyState } from './chrome/EmptyState';
import { FocusRotator } from './chrome/FocusRotator';
import { useGraph } from './data/useGraph';
import { animateTransform } from './lib/animate';
import { countAgents } from './lib/branches';
import {
  centreOn,
  clampScale,
  fitBounds,
  focusDepartment,
  IDENTITY,
  invertTransform,
  nearestDepartment,
  stepScale,
  toPercent,
  WHEEL_ZOOM,
  ZOOM_STEP,
  zoomAbout,
  type Transform,
  type Viewport,
} from './lib/camera';
import { passesYourTree } from './lib/geometry';
import { entryNode, nodeInDirection, siblingAnchor } from './lib/keyboard';
import { createRelaxer, type Relaxer } from './lib/relax';
import { agentSegment, cycleId, jobSlug } from './lib/slugs';
import { BrainEmptyState } from './svg/BrainEmptyState';
import { BranchLabels } from './svg/BranchLabels';
import { ClusterLabels } from './svg/ClusterLabels';
import { Edges } from './svg/Edges';
import { Nodes } from './svg/Nodes';
import { Watermark } from './svg/Watermark';

/**
 * Movement beyond this is a drag; anything under it is a click (§2.1's interaction budget
 * lists both gestures on the same node, so one of them has to yield to a threshold).
 *
 * Compared against the *pointerdown origin*, not the previous move: comparing consecutive
 * moves means a slow 200px drag made of 1px steps never crosses it, and then the drag
 * releases into a drawer.
 */
const DRAG_SLOP_PX = 3;

const beyondSlop = (origin: { x: number; y: number } | null, x: number, y: number): boolean =>
  origin !== null && Math.hypot(x - origin.x, y - origin.y) > DRAG_SLOP_PX;

export interface MapViewProps {
  department?: string | null;
  agent?: string | null;
  yourTree?: boolean;
  /** Skip fetch — tests and Story-like mounts. */
  payload?: GraphPayload;
}

export function MapView({
  department = null,
  agent = null,
  yourTree = false,
  payload: provided,
}: MapViewProps): React.JSX.Element {
  const router = useRouter();
  const href = useProjectHref();
  const t = useT();
  const reduced = useReducedMotion();
  // One seam for both halves of the project axis: the URLs the map *builds* (`href`) and
  // the URLs it *calls* (`useGraph`) read the same segment off the same pathname. M15
  // wired the first and left the second on the pre-project paths — REQ-MAP-39.
  const project = useProjectSegment();
  const { resource, arrivingIds } = useGraph(project, provided);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformRef = useRef<Transform>(IDENTITY);
  const viewportRef = useRef<Viewport>({ width: 1, height: 1 });
  const relaxerRef = useRef<Relaxer | null>(null);
  const relaxRaf = useRef(0);
  const stopAnim = useRef<(() => void) | null>(null);
  const didFit = useRef(false);
  const dragged = useRef(false);
  /** Where the current gesture started, in client pixels. Feeds `beyondSlop`. */
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const graphRef = useRef<GraphPayload | null>(null);
  const pan = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ distance: number; midX: number; midY: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [viewport, setViewport] = useState<Viewport>({ width: 1, height: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [displaced, setDisplaced] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [nearest, setNearest] = useState<string | null>(null);

  const commitTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
    emit('shell:zoomChanged', { level: next.k });
  }, []);

  const payload = resource.state === 'ready' ? resource.data : null;
  graphRef.current = payload;

  const visibleNodes = useMemo(() => {
    if (!payload) return [];
    return payload.nodes.filter((node) => passesYourTree(node, yourTree));
  }, [payload, yourTree]);

  const departmentLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of payload?.departments ?? []) map.set(d.id, d.label);
    return map;
  }, [payload]);

  const placedNodes = useMemo(() => {
    if (!displaced || displaced.size === 0) return visibleNodes;
    return visibleNodes.map((node) => {
      const moved = displaced.get(node.id);
      return moved ? { ...node, x: moved.x, y: moved.y } : node;
    });
  }, [visibleNodes, displaced]);

  const core = payload?.core ?? { x: 0, y: 0, brainCompleteness: 0 };

  const goTo = useCallback(
    (next: Transform, durationMs: number) => {
      stopAnim.current?.();
      const from = transformRef.current;
      stopAnim.current = animateTransform(from, next, durationMs, commitTransform);
    },
    [commitTransform],
  );

  const cameraFor = useCallback(
    (graph: GraphPayload, dept: string | null, centreId?: string | null): Transform => {
      const view = viewportRef.current;
      if (dept) return focusDepartment(graph.nodes, dept, view, centreId ?? undefined);
      return fitBounds(graph.bounds, view);
    },
    [],
  );

  // Size the viewport from the frame — the shell is an overlay, so this is the whole dvh.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (width: number, height: number): void => {
      const view = { width: Math.max(1, width), height: Math.max(1, height) };
      viewportRef.current = view;
      setViewport(view);
    };
    apply(el.clientWidth, el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) apply(box.width, box.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(relaxRaf.current);
      stopAnim.current?.();
    },
    [],
  );

  // First fit, then camera follows the *route*. Payload identity changes on a
  // `/ws/graph` delta must not retrigger this — that would jump the galaxy.
  const routeKey = `${department ?? ''}/${agent ?? ''}`;
  const ready = resource.state === 'ready';
  const sized = viewport.width > 8;
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !sized) return;
    const duration = didFit.current ? withReducedMotion(DURATION.zoom, reduced) : 0;
    didFit.current = true;
    const centreId = agent && department ? `${department}/${agent}` : null;
    goTo(cameraFor(graph, department, centreId), duration);
    // routeKey / ready / sized are the only inputs that should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, ready, sized, reduced, cameraFor, goTo]);

  useEffect(() => {
    if (!payload) return;
    const counts = countAgents(visibleNodes, department);
    emit('shell:liveCount', { department, live: counts.live, total: counts.total });
  }, [payload, visibleNodes, department]);

  useEffect(() => {
    if (!payload) {
      setNearest(null);
      return;
    }
    setNearest(nearestDepartment(payload.nodes, transform, viewport));
  }, [payload, transform, viewport]);

  useEffect(() => {
    if (!payload) return undefined;
    const positions = new Map(payload.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    relaxerRef.current = createRelaxer(positions, payload.edges);
    return () => {
      relaxerRef.current = null;
    };
  }, [payload]);

  // Roving tabindex: arrow/`Home`/`[`/`]` update focusedId — sync DOM focus so
  // Enter/Space on the node (and the visual ring) stay aligned (Part VI a11y).
  useEffect(() => {
    if (!focusedId) return;
    const el = svgRef.current?.querySelector(`[data-node-id="${CSS.escape(focusedId)}"]`);
    if (el instanceof SVGElement) el.focus({ preventScroll: true });
  }, [focusedId]);

  useEffect(
    () =>
      on('shell:zoom', (detail) => {
        const current = transformRef.current;
        const view = viewportRef.current;
        const cx = view.width / 2;
        const cy = view.height / 2;
        switch (detail.direction) {
          case 'in':
            commitTransform(zoomAbout(current, cx, cy, stepScale(current.k, 'in')));
            break;
          case 'out':
            commitTransform(zoomAbout(current, cx, cy, stepScale(current.k, 'out')));
            break;
          case 'set':
            commitTransform(zoomAbout(current, cx, cy, clampScale(detail.level ?? current.k)));
            break;
          case 'reset':
            commitTransform(zoomAbout(current, cx, cy, 1));
            break;
          default: {
            const _exhaustive: never = detail.direction;
            return _exhaustive;
          }
        }
      }),
    [commitTransform],
  );

  useEffect(
    () =>
      on('shell:flyTo', (detail) => {
        if (!payload) return;
        const view = viewportRef.current;
        const duration = withReducedMotion(detail.durationMs, reduced);
        if (detail.target.kind === 'department') {
          goTo(focusDepartment(payload.nodes, detail.target.id, view), duration);
          return;
        }
        if (detail.target.kind !== 'node') {
          const _exhaustive: never = detail.target;
          return _exhaustive;
        }
        const node = payload.nodes.find((n) => n.id === detail.target.id);
        if (!node) return;
        goTo(centreOn(node, Math.max(transformRef.current.k, ZOOM_STEP), view), duration);
      }),
    [payload, reduced, goTo],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const factor = event.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM;
      commitTransform(
        zoomAbout(transformRef.current, event.clientX - rect.left, event.clientY - rect.top, transformRef.current.k * factor),
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [commitTransform, payload]);

  // M15: the galaxy drills in without leaving its project (`Plan §9`).
  const drillTo = useCallback(
    (dept: string, slug?: string | null) => {
      router.push(href(slug ? `/map/${dept}/${agentSegment(slug)}` : `/map/${dept}`));
    },
    [router, href],
  );

  const onActivate = useCallback(
    (node: GraphNode) => {
      if (dragged.current) return;
      if (node.kind === 'anchor') {
        drillTo(node.department);
        return;
      }
      const slug = jobSlug(node);
      if (!slug) return;
      openDrawer({ slug, view: 'map' });
      drillTo(node.department, slug);
    },
    [drillTo],
  );

  const tickRelax = useCallback(() => {
    const relaxer = relaxerRef.current;
    if (!relaxer) return;
    cancelAnimationFrame(relaxRaf.current);
    let last = performance.now();
    const frame = (now: number): void => {
      const moved = relaxer.tick(now - last);
      last = now;
      setDisplaced(moved);
      if (moved || relaxer.dragging) relaxRaf.current = requestAnimationFrame(frame);
    };
    relaxRaf.current = requestAnimationFrame(frame);
  }, []);

  /**
   * Start a node gesture. It is not yet a drag and not yet a click — `onPointerMove` and
   * `dragged` decide which, and both outcomes have to stay reachable from here (§2.1 asks
   * for a springy node drag *and* a click that opens the drawer).
   *
   * REQ-MAP-41 — the two defects this shape exists to prevent, both of which shipped:
   *
   * 1. **Never capture on an ancestor.** This called `svgRef.current.setPointerCapture()`,
   *    which retargets every later pointer event — and the compatibility mouse events — to
   *    the `<svg>`. Chrome then dispatches `click` at the nearest common ancestor of the
   *    mousedown target (the node) and the mouseup target (the `<svg>`), which is the
   *    `<svg>`, so `Nodes.tsx`'s `onClick` could never fire and the drawer never opened on
   *    a mouse. Measured in Chrome over CDP: `pointerdown -> path`, `pointerup -> svg`,
   *    `click -> svg`. Capturing on the node itself is what the browser already does for
   *    touch (implicit pointer capture) — move/up still bubble to the `<svg>` handlers, and
   *    the click still lands on the node.
   * 2. **Reset `dragged` before anything can return early.** It used to sit below the grab
   *    guard, and the `<svg>`'s own handler bails on a `[data-node-id]` target above *its*
   *    reset — so a failed grab left the flag true from the previous pan and `onActivate`
   *    swallowed every later click in silence. The reset belongs before the first `return`,
   *    not after the last one.
   */
  const onGrab = useCallback(
    (node: GraphNode, event: React.PointerEvent<SVGGElement>) => {
      if (event.button !== 0) return;
      dragged.current = false;
      downAt.current = { x: event.clientX, y: event.clientY };
      const relaxer = relaxerRef.current;
      if (!relaxer?.grab(node.id)) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pan.current = null;
      tickRelax();
    },
    [tickRelax],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    // Same reason as `onGrab`: three early returns live below this line, and a flag whose
    // reset sits under them is a flag that stays true after the one path that skips it.
    //
    // Guarded on *first pointer* rather than reset unconditionally: a second finger joining
    // a pinch or an in-flight node drag is not a new gesture, and clearing the flag there
    // would let the release of a 200px drag arrive at `onActivate` as a click.
    if (pointers.current.size === 0 && !relaxerRef.current?.dragging) {
      dragged.current = false;
      downAt.current = { x: event.clientX, y: event.clientY };
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinch.current = {
        distance: Math.hypot(dx, dy) || 1,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      pan.current = null;
      return;
    }
    if (relaxerRef.current?.dragging) return;
    const target = event.target as Element | null;
    if (target?.closest('[data-node-id]')) return;
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    // No capture yet — see `onPointerMove`. Capturing here retargets the click to the
    // `<svg>` and kills every clickable thing drawn inside the canvas, which is how §2.1's
    // "click a department label → department view" was dead as well as the node click.
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      const scale = transformRef.current.k * (distance / pinch.current.distance);
      commitTransform(zoomAbout(transformRef.current, midX, midY, scale));
      pinch.current = { distance, midX: midX + rect.left, midY: midY + rect.top };
      return;
    }

    if (relaxerRef.current?.dragging) {
      const [wx, wy] = invertTransform(transformRef.current, event.clientX - rect.left, event.clientY - rect.top);
      relaxerRef.current.moveTo(wx, wy);
      // Thresholded, not "any movement at all". A mouse jitters a pixel between press and
      // release; without the slop the second half of REQ-MAP-41 reappears as a click that
      // works only when the hand is perfectly still.
      if (beyondSlop(downAt.current, event.clientX, event.clientY)) dragged.current = true;
      return;
    }

    if (pan.current && pan.current.id === event.pointerId) {
      const dx = event.clientX - pan.current.x;
      const dy = event.clientY - pan.current.y;
      if (!dragged.current && beyondSlop(downAt.current, event.clientX, event.clientY)) {
        // The moment it is a drag and not a click, take the pointer — so a pan that leaves
        // the window still ends, and a click that never moved still reaches whatever it was
        // aimed at. Capture is for drags; a click must not be captured by anything.
        dragged.current = true;
        svgRef.current?.setPointerCapture(event.pointerId);
      }
      pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      const current = transformRef.current;
      commitTransform({ ...current, x: current.x + dx, y: current.y + dy });
    }
  };

  /**
   * One exit for every way a gesture can end — up, cancel, and losing the capture (which is
   * what fires when the captured node is unmounted mid-drag by a `/ws/graph` delta). Safe to
   * run twice: a normal release fires `pointerup` and then `lostpointercapture`.
   */
  const endPointer = (event: React.PointerEvent<SVGSVGElement>): void => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    if (pan.current?.id === event.pointerId) pan.current = null;
    if (relaxerRef.current?.dragging && pointers.current.size === 0) {
      relaxerRef.current.release();
      tickRelax();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>): void => {
    if (!payload) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const id = focusedId ?? entryNode(visibleNodes, department);
      const node = id ? visibleNodes.find((n) => n.id === id) : undefined;
      if (node) onActivate(node);
      return;
    }
    if (key === 'Home') {
      event.preventDefault();
      setFocusedId(entryNode(visibleNodes, department));
      return;
    }
    if (key === '[' || key === ']') {
      event.preventDefault();
      setFocusedId(siblingAnchor(visibleNodes, focusedId, key === ']' ? 1 : -1));
      return;
    }
    const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    const dir = arrows[key];
    if (!dir) return;
    event.preventDefault();
    const next = nodeInDirection(visibleNodes, focusedId, dir);
    if (next) setFocusedId(next);
  };

  const departmentIds = payload?.departments.map((d) => d.id) ?? [];
  const focusLabel =
    (nearest && departmentLabels.get(nearest)) ||
    (department && departmentLabels.get(department)) ||
    null;

  const cameraToDepartment = (dept: string | null): void => {
    if (!payload || !dept) return;
    goTo(focusDepartment(payload.nodes, dept, viewportRef.current), withReducedMotion(DURATION.zoom, reduced));
  };

  return (
    <div ref={rootRef} data-testid="map-galaxy" className="relative h-full w-full overflow-hidden bg-bg">
      <GalaxyCanvas core={core} transform={transform} />

      {resource.state === 'unavailable' && (
        <MapEmptyState reason={resource.reason} serverMessage={resource.serverMessage} />
      )}

      {payload && (
        <svg
          ref={svgRef}
          role="group"
          aria-label={t('a11y.galaxyGroup')}
          tabIndex={0}
          className="absolute inset-0 z-canvas h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onKeyDown={onKeyDown}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {department && (
              <Watermark
                nodes={visibleNodes}
                department={department}
                label={(departmentLabels.get(department) ?? department).toUpperCase()}
              />
            )}
            <Edges nodes={placedNodes} edges={payload.edges} core={core} focusDepartment={department} />
            {/* §3.3 — only in the galaxy view, and only while the brain is 0/20. The
                department camera has its own watermark and this would fight it. */}
            {!department && <BrainEmptyState core={core} scale={transform.k} />}
            <Nodes
              nodes={visibleNodes}
              displaced={displaced}
              focusDepartment={department}
              hoveredId={hoveredId}
              focusedId={focusedId ?? entryNode(visibleNodes, department)}
              arrivingIds={arrivingIds}
              departmentLabels={departmentLabels}
              onHover={setHoveredId}
              onActivate={onActivate}
              onGrab={onGrab}
            />
            <BranchLabels
              departments={payload.departments}
              nodes={visibleNodes}
              focusDepartment={department}
              // Same guard as `onActivate`: the label now has a real hit rectangle, so a pan
              // that happens to start on one would otherwise drill in when it is released.
              onActivate={(id) => {
                if (dragged.current) return;
                drillTo(id);
              }}
            />
            {department && (
              <ClusterLabels
                nodes={visibleNodes}
                department={department}
                angle={payload.departments.find((d) => d.id === department)?.angle ?? 0}
              />
            )}
          </g>
        </svg>
      )}

      {department ? (
        <DepartmentRails
          department={department}
          onPrev={() => {
            const prev = findDepartment(department)?.neighbours[0];
            if (prev) drillTo(prev);
          }}
          onNext={() => {
            const next = findDepartment(department)?.neighbours[1];
            if (next) drillTo(next);
          }}
        />
      ) : (
        <FocusRotator
          label={focusLabel ? focusLabel.toUpperCase() : null}
          onPrev={() => cameraToDepartment(cycleId(departmentIds, nearest, -1))}
          onNext={() => cameraToDepartment(cycleId(departmentIds, nearest, 1))}
          onSelect={() => nearest && drillTo(nearest)}
        />
      )}

      <span className="sr-only">{toPercent(transform.k)} percent zoom</span>
    </div>
  );
}
