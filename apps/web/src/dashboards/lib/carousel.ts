/**
 * The §2.4 carousel, as maths.
 *
 * The whole interaction is one floating-point number: `position`, measured in cards.
 * `position = 2` means card 2 is centred; `position = 2.4` means the ring is mid-spin,
 * four-tenths of the way to card 3. Drag adds to it, the spring settles it, and the
 * transform of every card is a pure function of the distance between its index and it.
 *
 * **Momentum is the charm.** A carousel that snaps to the next card the instant you
 * release reads as a tab bar with extra steps. So a release does not snap: it hands the
 * pointer's velocity to a spring, which overshoots slightly and comes back — the spring
 * config is `motion.carousel.spring` and is passed in rather than imported, because
 * `motion.ts` is the only module allowed to type a duration and this one is allowed to
 * be tested without it.
 *
 * Owner: dashboards-engineer · Spec §2.4, §1.6 (carousel row)
 */

/** Front card is ~720px wide (§2.4). The flanks sit at this fraction of it, either side. */
export const CARD_WIDTH = 720;
export const STRIDE = CARD_WIDTH * 0.62;
/** How far back a flanking card sits. Depth, in the same units as the transform. */
export const DEPTH = 260;
/** Cards beyond this distance are not rendered — they are behind the ones in front. */
export const VISIBLE_SPAN = 2;

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface CardTransform {
  /** Degrees. 0 on the front card, ∓35 on the flanks (§2.4). */
  rotateY: number;
  /** 1.0 front, 0.82 rear (§1.6). */
  scale: number;
  /** 1.0 front, 0.5 rear — the "receding into dark" (§2.4). */
  brightness: number;
  translateX: number;
  translateZ: number;
  opacity: number;
  zIndex: number;
  /** True only for the exactly-centred card: the one that is clickable to enter. */
  isFront: boolean;
}

const FRONT = { rotate: 0, scale: 1, brightness: 1 };
const REAR = { rotate: 35, scale: 0.82, brightness: 0.5 };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Signed distance from `position` to `index`, taking the short way around the ring.
 * With six cards, the distance from 5 to 0 is +1, not −5 — otherwise a spin past the
 * end unwinds the whole carousel backwards in front of you.
 */
export function wrappedOffset(index: number, position: number, count: number): number {
  if (count <= 0) return 0;
  let d = index - position;
  d = ((d % count) + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

/**
 * Offset → the transform for that card.
 *
 * The interpolation is continuous over the first card of travel, so mid-drag the flanks
 * genuinely rotate rather than popping between two states. Past one card everything is
 * pinned at the rear values and only the translation keeps growing, which is what makes
 * the ring read as a ring instead of a stack.
 */
export function cardTransform(offset: number): CardTransform {
  const distance = Math.abs(offset);
  const t = clamp(distance, 0, 1);
  const side = offset === 0 ? 0 : Math.sign(offset);
  return {
    // A card to the right of centre turns its face toward the middle: negative rotateY.
    rotateY: -side * mix(FRONT.rotate, REAR.rotate, t),
    scale: mix(FRONT.scale, REAR.scale, t),
    brightness: mix(FRONT.brightness, REAR.brightness, t),
    translateX: offset * STRIDE,
    translateZ: -t * DEPTH - Math.max(0, distance - 1) * DEPTH * 0.5,
    opacity: distance > VISIBLE_SPAN ? 0 : clamp(1 - Math.max(0, distance - 1) * 0.5, 0, 1),
    zIndex: Math.round(100 - distance * 10),
    isFront: distance < 0.5,
  };
}

/** Which card is centred right now. Always a real index in `0..count-1`. */
export function frontIndex(position: number, count: number): number {
  if (count <= 0) return 0;
  return ((Math.round(position) % count) + count) % count;
}

/** Drag: pixels moved → cards travelled. Dragging left advances the ring. */
export function dragToPosition(startPosition: number, dxPixels: number): number {
  return startPosition - dxPixels / STRIDE;
}

/**
 * Where a flick should come to rest.
 *
 * `velocity` is in cards per second. The projection distance is the spring's own natural
 * period (`v / ω`, `ω = √(k/m)`) rather than an invented "momentum factor" — the flick
 * therefore travels exactly as far as this spring would carry it, and tuning the spring
 * tunes the flick. Travel is capped at ±2 cards so a hard swipe cannot spin the ring past
 * the point where the eye can follow which card it landed on.
 */
export function settleTarget(position: number, velocity: number, spring: SpringConfig): number {
  const omega = Math.sqrt(spring.stiffness / Math.max(spring.mass, 0.0001));
  const projected = position + velocity / omega;
  const nearest = Math.round(position);
  return clamp(Math.round(projected), nearest - VISIBLE_SPAN, nearest + VISIBLE_SPAN);
}

export interface SpringState {
  position: number;
  velocity: number;
}

/**
 * One semi-implicit Euler step of a damped spring toward `target`.
 *
 * `dt` is clamped: a backgrounded tab resumes with a 900ms frame, and an unclamped step
 * that large makes the integrator explode — the carousel would visibly fly off screen on
 * tab focus, which is a real bug and not a hypothetical one.
 */
export function springStep(
  state: SpringState,
  target: number,
  dtMs: number,
  spring: SpringConfig,
): SpringState {
  const dt = clamp(dtMs, 0, 32) / 1000;
  const force = -spring.stiffness * (state.position - target) - spring.damping * state.velocity;
  const velocity = state.velocity + (force / Math.max(spring.mass, 0.0001)) * dt;
  return { position: state.position + velocity * dt, velocity };
}

/** Close enough to stop integrating and pin the exact value. */
export function isAtRest(state: SpringState, target: number): boolean {
  return Math.abs(state.position - target) < 0.001 && Math.abs(state.velocity) < 0.01;
}

/**
 * Pointer velocity from a short trail of samples, in cards per second.
 *
 * Sampled over the last ~90ms rather than the whole gesture: what the hand did at the
 * moment of release is the intent, and averaging in the slow beginning of a drag turns
 * every deliberate flick into a shove.
 */
export interface DragSample {
  x: number;
  t: number;
}

export function velocityFrom(samples: readonly DragSample[], windowMs = 90): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 1; i >= 0; i--) {
    first = samples[i];
    if (last.t - samples[i].t >= windowMs) break;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  // Dragging left (negative dx) advances the ring, hence the sign flip.
  return -((last.x - first.x) / STRIDE) * (1000 / dt);
}

/** Normalise a wrapped position back into `0..count` without moving any card. */
export function normalizePosition(position: number, count: number): number {
  if (count <= 0) return 0;
  return ((position % count) + count) % count;
}

/** Step one card in either direction — the ‹ › arrows and the ← → keys. */
export function step(position: number, direction: -1 | 1): number {
  return Math.round(position) + direction;
}
