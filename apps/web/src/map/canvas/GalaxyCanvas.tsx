'use client';

/**
 * The ONE canvas underlay (§2.1, contracts/graph-layout.md "Rendering split").
 *
 *   back  → this canvas: dotted grid, starfield, the centre galaxy, the core dot
 *   front → SVG: nodes, edges, labels, halos, badges
 *
 * Canvas never handles interaction; it is `aria-hidden` and `pointer-events-none`. The
 * non-visual path to every agent is the shell's search plus the SVG's focusable nodes.
 *
 * Every colour here is read from a CSS custom property at paint time — a canvas cannot use
 * a Tailwind class, so `resolveInk()` is how this file obeys "no literal outside
 * tokens.css". It also means the light theme works without this component knowing a theme
 * exists (§1.2).
 */

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../components/primitives/motion';
import {
  buildGalaxy,
  buildStarfield,
  particleBrightness,
  shimmer,
  GALAXY_RADIUS,
  PARTICLE_INK_VARS,
  type Particle,
  type Star,
} from '../lib/particles';
import { galaxyAngle } from '../lib/map-motion';
import type { Transform } from '../lib/camera';

export interface GalaxyCanvasProps {
  /** `GraphPayload.core` — position in world space and §3.3 completeness. */
  core: { x: number; y: number; brainCompleteness: number };
  transform: Transform;
  className?: string;
}

/** Read a design token off the document. Returns '' if the token does not exist, and the
 *  caller degrades to a monochrome value rather than inventing a colour. */
function readToken(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readNumber(name: string, fallback: number): number {
  const raw = parseFloat(readToken(name));
  return Number.isFinite(raw) ? raw : fallback;
}

interface Palette {
  ink: string[];
  star: string;
  dot: string;
  bg: string;
  bgEdge: string;
  ivory: string;
}

/**
 * Data ink for the galaxy, with an honest fallback: if the `--ink-*` tokens are absent the
 * galaxy renders monochrome in `--ivory` rather than falling back to a hardcoded hex. A
 * colourless galaxy is a visible bug; a hex in this file is an invisible one.
 */
function readPalette(): Palette {
  const ivory = readToken('--ivory') || 'currentColor';
  const ink = PARTICLE_INK_VARS.map((v) => readToken(v) || ivory);
  return {
    ink,
    star: readToken('--star-color') || ivory,
    dot: readToken('--dot-color') || ivory,
    bg: readToken('--bg') || 'transparent',
    bgEdge: readToken('--bg-3') || 'transparent',
    ivory,
  };
}

export function GalaxyCanvas({ core, transform, className }: GalaxyCanvasProps): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  // The camera changes every frame during a pan; keeping it in a ref means the animation
  // loop is created once instead of being torn down and rebuilt on each transform.
  const camera = useRef(transform);
  camera.current = transform;

  const completeness = core.brainCompleteness;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let particles: Particle[] = buildGalaxy({ completeness });
    let palette = readPalette();
    let dotPitch = readNumber('--dot-pitch', 22);
    let dotSize = readNumber('--dot-size', 1);
    let starCount = readNumber('--star-count', 200);
    const brightness = particleBrightness(completeness);
    const start = performance.now();

    const resize = (): void => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Stars are screen-space and reseeded only here — they must not swim while panning.
      stars = buildStarfield(width, height, Math.round(starCount));
    };

    const readTokensAgain = (): void => {
      palette = readPalette();
      dotPitch = readNumber('--dot-pitch', 22);
      dotSize = readNumber('--dot-size', 1);
      starCount = readNumber('--star-count', 200);
      particles = buildGalaxy({ completeness });
    };

    /** §1.5 dotted grid — drawn in world space so it pans and zooms with the map. */
    const drawGrid = (t: Transform): void => {
      const pitch = dotPitch * t.k;
      if (pitch < 6) return; // below this it is a grey wash, not a texture
      ctx.fillStyle = palette.dot;
      const r = Math.max(0.5, dotSize * Math.min(1.5, t.k));
      const originX = ((t.x % pitch) + pitch) % pitch;
      const originY = ((t.y % pitch) + pitch) % pitch;
      for (let x = originX; x < width; x += pitch) {
        for (let y = originY; y < height; y += pitch) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    /** §1.5 starfield — ~200 1px points at .05–.15, screen space, no parallax. */
    const drawStars = (): void => {
      ctx.fillStyle = palette.star;
      for (const s of stars) {
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    };

    /**
     * §1.5 central galaxy glow — "radial-gradient copper→transparent, blur 60px". Drawn as
     * a gradient rather than a CSS blur so it lives in the same layer as the particles and
     * composites with them additively.
     */
    const drawGlow = (cx: number, cy: number, k: number): void => {
      const radius = 260 * k;
      if (radius < 1) return;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, palette.ink[0]);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.16 * brightness;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    /**
     * §3.3 at zero — the empty disc.
     *
     * `particleBudget(0)` is 0, so a 0/20 brain has no swirl to draw. A core dot alone on a
     * starfield is indistinguishable from a canvas that failed, and "is this broken?" is a
     * worse first impression than "nothing here yet". So the disc the swirl would occupy is
     * outlined instead: a dashed ring at the galaxy radius, rotating on the same 120s clock
     * as the swirl would. Dashes are unmistakably drawn — a failed render produces nothing,
     * never a dotted circle — and the rotation proves the loop is running. The map states
     * the count in words alongside it (`chrome/BrainEmptyState`); this is the visual half.
     */
    const drawEmptyDisc = (cx: number, cy: number, k: number, elapsed: number): void => {
      const radius = GALAXY_RADIUS * k;
      if (radius < 10) return; // zoomed out past legibility — a dotted speck reads as dirt
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(galaxyAngle(elapsed, reduced));
      ctx.setLineDash([2, 10]); // screen-space, so the dashes stay hairlines at any zoom
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.ivory;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    /** §2.1 — 600 particles, additive blending, idle rotation, opacity shimmer. */
    const drawGalaxy = (cx: number, cy: number, k: number, elapsed: number): void => {
      const seconds = elapsed / 1000;
      const base = galaxyAngle(elapsed, reduced);

      if (particles.length === 0) drawEmptyDisc(cx, cy, k, elapsed);

      ctx.globalCompositeOperation = 'lighter'; // §2.1 additive blending
      for (const p of particles) {
        // Differential rotation: inner particles lead, so the swirl reads as a disc.
        const a = base * p.speed;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const x = cx + (p.x * cos - p.y * sin) * k;
        const y = cy + (p.x * sin + p.y * cos) * k;
        if (x < -8 || y < -8 || x > width + 8 || y > height + 8) continue;

        ctx.globalAlpha = (reduced ? p.alpha : shimmer(p, seconds)) * brightness;
        ctx.fillStyle = palette.ink[p.hue] ?? palette.ivory;
        const size = Math.max(1, p.size * Math.min(2, k));
        ctx.fillRect(x, y, size, size);
      }

      // §2.1 "one bright core dot" — the Second Brain itself. Present even at zero
      // completeness: the brain exists, it is simply unanswered (§3.3).
      ctx.globalAlpha = 0.55 + 0.45 * brightness;
      ctx.fillStyle = palette.ivory;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, 3 * Math.min(2, k)), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    /** §2.1 — "--bg → vignette to --bg-3 at edges". */
    const drawVignette = (): void => {
      const g = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.28,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.78,
      );
      g.addColorStop(0, 'transparent');
      g.addColorStop(1, palette.bgEdge);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    };

    const frame = (now: number): void => {
      const elapsed = now - start;
      const t = camera.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      drawGrid(t);
      drawStars();

      const cx = core.x * t.k + t.x;
      const cy = core.y * t.k + t.y;
      drawGlow(cx, cy, t.k);
      drawGalaxy(cx, cy, t.k, elapsed);
      drawVignette();

      // Reduced motion: paint the end state once and stop the loop entirely, rather than
      // burning a rAF on an unchanging image (§1.6).
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);

    const onResize = (): void => {
      resize();
      if (reduced) raf = requestAnimationFrame(frame);
    };
    window.addEventListener('resize', onResize);

    // The theme swap changes every token this canvas reads, and it is a class change on
    // <body> rather than an event — so observe it. The component still never asks which
    // theme is active (§1.2).
    const observer = new MutationObserver(() => {
      readTokensAgain();
      if (reduced) raf = requestAnimationFrame(frame);
    });
    if (typeof document !== 'undefined') {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [completeness, core.x, core.y, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={['pointer-events-none absolute inset-0 z-canvas', className].filter(Boolean).join(' ')}
    />
  );
}
