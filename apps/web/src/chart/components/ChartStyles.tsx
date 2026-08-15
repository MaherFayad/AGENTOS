/**
 * The card-expand reveal keyframes (§1.6: opacity 0→1 + translateY 12px→0, 500ms
 * `cubic-bezier(.2,.7,.2,1)` — "the app should keep it for panels/drawers only"; an
 * expanding job card is a panel).
 *
 * They live in this component and not in `globals.css` because `src/styles/**` belongs to
 * `design-system-guardian`. If they publish a shared `reveal` keyframe, delete this file
 * and point `JobCard` at theirs — that is a one-line change and the preferred end state.
 *
 * Redefining the keyframes inside the reduced-motion query is deliberate: the animation
 * still runs, it simply has no distance to travel, so the end state is identical.
 */
export function ChartStyles() {
  return (
    <style>{`
      @keyframes chart-reveal {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes chart-reveal {
          from { opacity: 1; transform: none; }
          to   { opacity: 1; transform: none; }
        }
      }
    `}</style>
  );
}
