/**
 * The centre galaxy (§2.1) — pure geometry, no canvas, no React, so it can be tested.
 *
 * §2.1, verbatim: "hundreds of 1–2px multicolor particles (copper/teal/coral/lavender at
 * low saturation) in a swirl, with one bright core dot … Implement as a single <canvas>
 * layer: 600 particles on a logarithmic spiral + gaussian jitter, hue picked from the
 * data-ink palette, additive blending."
 *
 * §3.3: "The center galaxy particle count/brightness scales with brain completeness — a
 * delightful, honest progress indicator." Honest is the operative word: at completeness 0
 * this returns zero particles and the canvas draws the core dot alone. It never renders a
 * full galaxy over an empty COMPANY.md.
 */

/** §2.1 — the particle budget at a fully answered Second Brain. */
export const GALAXY_PARTICLE_COUNT = 600;

/** World-space radius the swirl occupies — and, at zero completeness, the radius of the
 *  empty disc drawn in its place, so the two describe the same object. */
export const GALAXY_RADIUS = 190;

/**
 * A floor so the core never looks broken while the brain is genuinely empty — the swirl is
 * absent, but the core dot and a faint dusting say "this exists and is unpopulated" rather
 * than "this is broken". 0 completeness ⇒ 0 particles; the floor only applies once the
 * interview has produced anything at all.
 */
export const GALAXY_MIN_PARTICLES = 40;

export interface Particle {
  /** World-space offset from the core, before rotation. */
  x: number;
  y: number;
  /** 1–2px (§2.1). */
  size: number;
  /** Index into `PARTICLE_INK_VARS` — resolved to a CSS variable by the renderer, never a literal. */
  hue: number;
  /** Base alpha before the shimmer term. */
  alpha: number;
  /** Per-particle phase so the opacity noise is not synchronised. */
  phase: number;
  /** Angular speed multiplier — inner particles orbit faster, as a real disc does. */
  speed: number;
}

/**
 * The data-ink tokens the galaxy is allowed to draw from (§1.3 / §2.1: copper, teal, coral,
 * lavender "at low saturation"). Resolved from CSS custom properties at paint time — the
 * renderer never writes a color literal, which is also what keeps the light theme working.
 */
export const PARTICLE_INK_VARS = ['--ink-copper', '--ink-teal', '--ink-coral', '--ink-lavender'] as const;

/** §3.3 — particle budget as a function of Second Brain completeness. */
export function particleBudget(completeness: number): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(completeness) ? completeness : 0));
  if (c === 0) return 0;
  return Math.round(GALAXY_MIN_PARTICLES + (GALAXY_PARTICLE_COUNT - GALAXY_MIN_PARTICLES) * c);
}

/**
 * §3.3 — brightness scales too, so a half-answered brain is visibly dimmer and not just
 * sparser. Kept well below 1 so the galaxy stays a texture behind the graph, never a
 * spotlight competing with the nodes.
 */
export function particleBrightness(completeness: number): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(completeness) ? completeness : 0));
  return 0.25 + 0.75 * c;
}

/** Deterministic PRNG so the galaxy is the same swirl on every visit, like the layout. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, clamped, for the "gaussian jitter" §2.1 asks for. */
export function gaussian(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-3, Math.min(3, g));
}

export interface GalaxyOptions {
  /** 0…1, from `GraphPayload.core.brainCompleteness`. */
  completeness: number;
  /** World-space radius the swirl occupies. */
  radius?: number;
  /** How tightly the log spiral winds. */
  tightness?: number;
  /** Number of spiral arms. */
  arms?: number;
  seed?: number;
}

/**
 * Build the galaxy: `n` particles on a **logarithmic** spiral (r = a·e^(b·θ)) with gaussian
 * jitter perpendicular to the arm, hues drawn from the data-ink palette.
 */
export function buildGalaxy({
  completeness,
  radius = GALAXY_RADIUS,
  tightness = 0.32,
  arms = 3,
  seed = 0x9a1a,
}: GalaxyOptions): Particle[] {
  const count = particleBudget(completeness);
  if (count === 0) return [];

  const rand = mulberry32(seed);
  const particles: Particle[] = [];
  // r = a·e^(b·θ). Solve `a` so the outermost turn lands on `radius`.
  const turns = 2.2;
  const thetaMax = turns * 2 * Math.PI;
  const a = radius / Math.exp(tightness * thetaMax);

  for (let i = 0; i < count; i++) {
    const arm = i % arms;
    // Bias θ toward the outside so the disc is not a dense blob at the centre.
    const t = Math.sqrt(rand());
    const theta = t * thetaMax;
    const r = a * Math.exp(tightness * theta);
    const angle = theta + (arm * 2 * Math.PI) / arms;

    // Jitter grows with radius, as a real arm frays outward.
    const spread = 6 + (r / radius) * 26;
    const jx = gaussian(rand) * spread;
    const jy = gaussian(rand) * spread;

    particles.push({
      x: Math.cos(angle) * r + jx,
      y: Math.sin(angle) * r + jy,
      size: rand() < 0.82 ? 1 : 2,
      hue: Math.floor(rand() * PARTICLE_INK_VARS.length),
      // Outer particles are fainter — depth without drawing depth.
      alpha: 0.1 + (1 - r / radius) * 0.32 + rand() * 0.1,
      phase: rand() * Math.PI * 2,
      speed: 0.55 + (1 - r / radius) * 0.9,
    });
  }
  return particles;
}

/**
 * Opacity-noise shimmer (§2.1 "particles shimmer (opacity noise)"). A cheap two-term sine
 * beats real noise here: it is continuous, seamless across a loop, and costs nothing at
 * 600 particles per frame.
 */
export function shimmer(p: Particle, timeSeconds: number): number {
  const s = Math.sin(timeSeconds * 1.7 + p.phase) * 0.5 + Math.sin(timeSeconds * 0.9 + p.phase * 1.7) * 0.5;
  return Math.max(0, Math.min(1, p.alpha * (0.72 + 0.28 * s)));
}

/**
 * The starfield (§1.5: "~200 random 1px points at opacity .05–.15"). Screen-space, seeded,
 * and regenerated only when the viewport resizes — stars do not parallax with the map,
 * which is what keeps them reading as a backdrop rather than as data.
 */
export interface Star {
  x: number;
  y: number;
  alpha: number;
}

export function buildStarfield(width: number, height: number, count: number, seed = 0x57a2): Star[] {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      // §1.5's exact range.
      alpha: 0.05 + rand() * 0.1,
    });
  }
  return stars;
}
