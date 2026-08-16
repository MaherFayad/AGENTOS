'use client';

/**
 * The node layer (§2.1, §3.2, §3.4). SVG, because every one of these needs hit-testing, a
 * focus ring and a transition — which is exactly the line `contracts/graph-layout.md` draws
 * between this and the canvas underneath.
 *
 * §2.1, verbatim: "Nodes: filled circles, --ivory fill; three sizes — anchor (44px,
 * contains a line-icon in dark ink on ivory), job node (28–32px, line icon), leaf/skill dot
 * (8–10px, plain). Live nodes get a copper ring (2px, +4px offset) and a small orange
 * satellite dot on their outbound edge. Dormant nodes are dimmed to 45% opacity."
 *
 * The satellite dot lives in `Edges.tsx` because it sits *on the edge*, not on the node.
 *
 * Sizes come from the payload's `r`, which the layout engine derived from `kind` — so the
 * 44 / 28–32 / 8–10 decision is made once, server-side, and the renderer cannot drift from
 * the collision radii the layout was solved with.
 */

import { memo, useEffect, useRef } from 'react';
import { icons } from 'lucide-react';
import type { GraphNode } from '@agnetos/contracts';
import { useReducedMotion } from '../../components/primitives/motion';
import { presentation, DORMANT_OPACITY, LIVE_RING_OFFSET, LIVE_RING_WIDTH } from '../lib/geometry';
import { NODE_LABEL, LEAF_LABEL } from '../lib/map-type';
import { APPROVAL_PULSE_MS } from '../lib/map-motion';
import { nodeAriaLabel } from '../lib/keyboard';
import { useI18n } from '@/i18n';

export interface NodesProps {
  nodes: readonly GraphNode[];
  /** Live drag/relax displacements, keyed by node id. Absent = the node is at home. */
  displaced?: ReadonlyMap<string, { x: number; y: number }> | null;
  /** Dim everything outside this department during the §2.2 drill-in. */
  focusDepartment?: string | null;
  hoveredId: string | null;
  /** The single roving tab stop (see `lib/keyboard.ts`). */
  focusedId: string | null;
  /** Node ids added by a `/ws/graph` delta this session — they fade in (§2.1 live drop). */
  arrivingIds?: ReadonlySet<string>;
  departmentLabels: ReadonlyMap<string, string>;
  onHover: (id: string | null) => void;
  onActivate: (node: GraphNode) => void;
  onGrab: (node: GraphNode, event: React.PointerEvent<SVGGElement>) => void;
}

/**
 * §2.1's line icon, "dark ink on ivory". `--copper-ink` is exactly that token pair: it is
 * #131315 on the dark theme's ivory node and #FFFFFF on the light theme's, so one
 * reference is legible in both and no component branches on theme (§1.2).
 */
const pascal = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

function NodeIcon({ name, r }: { name: string; r: number }): React.JSX.Element | null {
  const Glyph = (icons as Record<string, typeof icons.Square | undefined>)[pascal(name)];
  if (!Glyph) return null; // a mistyped icon leaves a plain ivory disc, never a broken node
  const size = Math.round(r * 1.05);
  return (
    <g transform={`translate(${-size / 2} ${-size / 2})`} aria-hidden="true">
      <Glyph size={size} strokeWidth={1.4} color="var(--copper-ink)" />
    </g>
  );
}

/**
 * §3.2 — "tiny clock badge" for a scheduled agent. Monochrome on purpose: a schedule is a
 * configuration fact, not a status, so it earns no data ink (§1.3). Drawn rather than
 * imported so it stays crisp at 7px, where a 24px lucide glyph scaled down would not.
 */
function ClockBadge({ r }: { r: number }): React.JSX.Element {
  const d = Math.max(5, r * 0.42);
  const cx = r * 0.72;
  const cy = -r * 0.72;
  return (
    <g aria-hidden="true" transform={`translate(${cx} ${cy})`}>
      <circle r={d} fill="var(--bg)" stroke="var(--line-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path
        d={`M0 ${-d * 0.5}V0h${d * 0.42}`}
        fill="none"
        stroke="var(--ivory-2)"
        strokeWidth={1}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

const NodeShape = memo(function NodeShape({
  node,
  hovered,
  focused,
  dimmed,
  arriving,
  departmentLabel,
  onHover,
  onActivate,
  onGrab,
}: {
  node: GraphNode;
  hovered: boolean;
  focused: boolean;
  dimmed: boolean;
  arriving: boolean;
  departmentLabel: string;
  onHover: NodesProps['onHover'];
  onActivate: NodesProps['onActivate'];
  onGrab: NodesProps['onGrab'];
}): React.JSX.Element {
  // The screen-reader label is assembled from catalogue fragments and joined with
  // Intl.ListFormat, so it needs both the translator and the locale (§1.4).
  const { t, locale } = useI18n();
  const look = presentation(node);
  const r = node.r;
  const isLeaf = node.kind === 'leaf';
  const label = isLeaf ? LEAF_LABEL : NODE_LABEL;

  // §2.1 dims dormant nodes to 45%; §2.2's drill-in dims the other six branches further.
  const opacity = (look.opacity === 1 ? 1 : DORMANT_OPACITY) * (dimmed ? 0.28 : 1);

  /**
   * A node that arrived on a `/ws/graph` delta starts transparent; the hook drops it out of
   * `arrivingIds` on the next frame and the `transition-opacity` below fades it in. That is
   * the weekly agent drop, animated, with no keyframe and no duration literal.
   */
  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      opacity={arriving ? 0 : opacity}
      className="group cursor-pointer transition-opacity duration-zoom ease-zoom focus:outline-none"
      role="button"
      tabIndex={focused ? 0 : -1}
      data-node-id={node.id}
      aria-label={nodeAriaLabel(node, departmentLabel, t, locale)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onPointerDown={(event) => onGrab(node, event)}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(node);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onActivate(node);
      }}
    >
      {/* §3.4 — a failing audit gets an amber halo. Two rings rather than an SVG filter:
          a blur filter on 150 nodes costs more than the effect is worth, and this reads
          the same at every zoom level. */}
      {look.halo && (
        <>
          <circle r={r + 13} fill="var(--ink-amber-fill)" />
          <circle
            r={r + 6}
            fill="none"
            stroke="var(--ink-amber)"
            strokeWidth={1}
            strokeOpacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* §3.2 — approval pending. The animated ring; its opacity is driven by the shared
          rAF clock in <Nodes>, so no duration is typed in a component. */}
      {look.pulse && (
        <circle
          data-approval-pulse=""
          r={r + LIVE_RING_OFFSET + 3}
          fill="none"
          stroke="var(--ink-amber)"
          strokeWidth={LIVE_RING_WIDTH}
          vectorEffect="non-scaling-stroke"
          opacity={0.6}
        />
      )}

      {/* §2.1 — live nodes get a 2px copper ring at +4px offset. */}
      {look.ring && (
        <circle
          r={r + LIVE_RING_OFFSET}
          fill="none"
          stroke="var(--ink-copper)"
          strokeWidth={LIVE_RING_WIDTH}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* The focus ring. Monochrome, outside every other treatment, so it is never confused
          with the copper "live" ring or the amber "needs you" ring. */}
      <circle
        r={r + LIVE_RING_OFFSET + 6}
        fill="none"
        stroke="var(--ivory)"
        strokeWidth={1}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
        className="opacity-0 transition-opacity duration-hover ease-zoom group-focus-visible:opacity-100 [g:focus-visible>&]:opacity-100"
      />

      {/* The node itself. `--ivory` fill, all three sizes (§2.1). */}
      <circle
        r={r}
        fill="var(--ivory)"
        stroke={hovered ? 'var(--ivory)' : 'none'}
        strokeWidth={hovered && !isLeaf ? 1 : 0}
        strokeOpacity={0.35}
        vectorEffect="non-scaling-stroke"
      />

      {!isLeaf && node.icon && <NodeIcon name={node.icon} r={r} />}
      {look.clock && <ClockBadge r={r} />}

      {/* §2.1 — "hover node → name label fades in under it". Anchors keep their label
          permanently: the department caps are drawn by <BranchLabels>, and an anchor with
          no caption at all reads as an unexplained big dot. */}
      <text
        y={r + label.offset}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontSize={label.size}
        letterSpacing={label.tracking}
        fill="var(--ivory-2)"
        className={
          'pointer-events-none select-none transition-opacity duration-hover ease-zoom ' +
          (hovered || focused ? 'opacity-100' : 'opacity-0')
        }
      >
        {node.label}
      </text>
    </g>
  );
});

export function Nodes({
  nodes,
  displaced = null,
  focusDepartment = null,
  hoveredId,
  focusedId,
  arrivingIds,
  departmentLabels,
  onHover,
  onActivate,
  onGrab,
}: NodesProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const layer = useRef<SVGGElement | null>(null);

  /**
   * §3.2's amber approval pulse, driven imperatively from one rAF. React state at 60fps
   * for a breathing ring would re-reconcile the whole node layer; this writes one
   * attribute on the handful of nodes that are actually waiting on a human.
   */
  useEffect(() => {
    const root = layer.current;
    if (!root || reduced) return;
    const rings = root.querySelectorAll<SVGCircleElement>('[data-approval-pulse]');
    if (rings.length === 0) return;

    let raf = 0;
    const start = performance.now();
    const frame = (now: number): void => {
      // One slow breath, not a blink: waiting is the message, not alarm (§3.2).
      const phase = ((now - start) % APPROVAL_PULSE_MS) / APPROVAL_PULSE_MS;
      const alpha = 0.25 + 0.55 * (0.5 - Math.cos(phase * Math.PI * 2) / 2);
      for (const ring of rings) ring.setAttribute('opacity', String(alpha));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, nodes]);

  return (
    <g ref={layer}>
      {nodes.map((node) => {
        const moved = displaced?.get(node.id);
        const placed = moved ? { ...node, x: moved.x, y: moved.y } : node;
        return (
          <NodeShape
            key={node.id}
            node={placed}
            hovered={hoveredId === node.id}
            focused={focusedId === node.id}
            dimmed={focusDepartment !== null && node.department !== focusDepartment}
            arriving={arrivingIds?.has(node.id) ?? false}
            departmentLabel={departmentLabels.get(node.department) ?? node.department}
            onHover={onHover}
            onActivate={onActivate}
            onGrab={onGrab}
          />
        );
      })}
    </g>
  );
}
