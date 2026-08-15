/**
 * Animate a camera transform. Duration is a caller-supplied token (DURATION.zoom), never
 * a literal in this file — `check-tokens.mjs` greps for those.
 */

import { easeInOut, lerpTransform, type Transform } from './camera';

export function animateTransform(
  from: Transform,
  to: Transform,
  durationMs: number,
  onFrame: (next: Transform) => void,
): () => void {
  if (durationMs <= 0) {
    onFrame(to);
    return () => {};
  }
  let raf = 0;
  const start = performance.now();
  const frame = (now: number): void => {
    const t = Math.min(1, (now - start) / durationMs);
    onFrame(lerpTransform(from, to, easeInOut(t)));
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
