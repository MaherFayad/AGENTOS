'use client';

/**
 * Edges and the travelling pulse dots (§2.1).
 *
 * "Edges: 1px rgba(255,255,255,.14), slight curves (quadratic), with occasional orange
 * pulse dots traveling along edges of live branches (2px dot, 3s linear, staggered) —
 * this is the 'alive' feel."
 *
 * The .14 alpha is expressed as `stroke="var(--ivory)" strokeOpacity` rather than an rgba
 * literal: `--ivory` is #ECECEE in dark and #161618 in light, so the edges also stop being
 * white-on-white when the theme flips — which an rgba(255,255,255,…) literal could not do.
 *
 * The pulses are driven by one requestAnimationFrame loop writing `cx`/`cy` directly on the
 * circles. Not React state (150 edges × 60fps of reconciliation for a decorative dot), and
 * not a CSS/SMIL animation (both would put a duration literal in a component). One loop,
 * one number, imported from `map-motion`.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { GraphEdge, GraphNode } from '@agnetos/contracts';
import { useReducedMotion } from '../../components/primitives/motion';
import { edgePath, endpoint, indexNodes, isPulseCarrier, pointOnEdge, pulseT, SATELLITE_T } from '../lib/geometry';

const EDGE_OPACITY = 0.14; // §2.1, verbatim
const BUILDS_ON_DASH = '4 5';

export interface EdgesProps {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  core: { x: number; y: number };
  /** Dim everything outside the focused department in the §2.2 drill-in. */
  focusDepartment?: string | null;
}

interface Resolved {
  edge: GraphEdge;
  d: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  department: string;
}

export function Edges({ nodes, edges, core, focusDepartment = null }: EdgesProps): React.JSX.Element {
  const reduced = useReducedMotion();

  const resolved = useMemo<Resolved[]>(() => {
    const index = indexNodes(nodes);
    const out: Resolved[] = [];
    for (const edge of edges) {
      const a = endpoint(edge.source, index, core);
      const b = endpoint(edge.target, index, core);
      if (!a || !b) continue; // an edge to a filtered-out node simply is not drawn
      out.push({
        edge,
        a,
        b,
        d: edgePath(a, b, edge.curve),
        department: index.get(edge.target)?.department ?? index.get(edge.source)?.department ?? '',
      });
    }
    return out;
  }, [nodes, edges, core]);

  /** §2.1 — pulses only on live branches, and only "occasional" ones carry a dot. */
  const carriers = useMemo(
    () => resolved.filter((r) => r.edge.pulse && isPulseCarrier(r.edge)),
    [resolved],
  );

  const dots = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    if (reduced || carriers.length === 0) return; // §1.6 — kill the pulses, keep the edges
    let raf = 0;
    const start = performance.now();

    const frame = (now: number): void => {
      const elapsed = now - start;
      for (let i = 0; i < carriers.length; i++) {
        const dot = dots.current[i];
        if (!dot) continue;
        const c = carriers[i];
        const t = pulseT(c.edge, elapsed);
        const p = pointOnEdge(c.a, c.b, c.edge.curve, t);
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        // Fade in and out at the ends so a dot never pops into existence at a node.
        dot.setAttribute('opacity', String(Math.sin(t * Math.PI) ** 0.6));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [carriers, reduced]);

  return (
    <g aria-hidden="true">
      {resolved.map((r) => {
        const dimmed = focusDepartment !== null && r.department !== focusDepartment;
        return (
          <path
            key={`${r.edge.source}->${r.edge.target}-${r.edge.kind}`}
            d={r.d}
            fill="none"
            stroke="var(--ivory)"
            strokeWidth={1}
            strokeOpacity={dimmed ? EDGE_OPACITY * 0.3 : EDGE_OPACITY}
            strokeDasharray={r.edge.kind === 'builds-on' ? BUILDS_ON_DASH : undefined}
            vectorEffect="non-scaling-stroke"
            className="transition-opacity duration-zoom ease-zoom"
          />
        );
      })}

      {/* §2.1 — "a small orange satellite dot on their outbound edge" for live nodes. */}
      {resolved
        .filter((r) => r.edge.pulse && r.edge.kind === 'tree')
        .map((r) => {
          const p = pointOnEdge(r.a, r.b, r.edge.curve, SATELLITE_T);
          return (
            <circle
              key={`sat-${r.edge.source}->${r.edge.target}`}
              cx={p.x}
              cy={p.y}
              r={1.75}
              fill="var(--ink-copper)"
              opacity={focusDepartment !== null && r.department !== focusDepartment ? 0.25 : 0.9}
            />
          );
        })}

      {/* The travelling pulses themselves — 2px copper dots (§2.1). */}
      {!reduced &&
        carriers.map((c, i) => (
          <circle
            key={`pulse-${c.edge.source}->${c.edge.target}`}
            ref={(el) => {
              dots.current[i] = el;
            }}
            r={1}
            fill="var(--ink-copper-2)"
            opacity={0}
          />
        ))}
    </g>
  );
}
