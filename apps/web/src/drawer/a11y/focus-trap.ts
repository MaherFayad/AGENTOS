/**
 * Focus-trap arithmetic, kept out of React so it can be tested as arithmetic.
 *
 * §2.3 behaviour: while the drawer is open, Tab cycles inside it, Esc closes it, and focus
 * returns to whatever opened it. The focus ring is monochrome — it is styled in
 * `drawer.module.css`, never left as the browser default blue (§1.3).
 *
 * Owner: drawer-engineer
 */

/** Everything a keyboard can land on. `[hidden]` and `disabled` are excluded by the query. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type KeyIntent = 'close' | 'cycle-forward' | 'cycle-back' | null;

/** Which of the three things a keydown inside the drawer means, if any. */
export function keyIntent(event: Pick<KeyboardEvent, 'key' | 'shiftKey'>): KeyIntent {
  if (event.key === 'Escape' || event.key === 'Esc') return 'close';
  if (event.key === 'Tab') return event.shiftKey ? 'cycle-back' : 'cycle-forward';
  return null;
}

/**
 * Next index in a wrapping cycle. `current === -1` (focus outside the trap) enters at the
 * first element going forward and the last going back.
 */
export function nextIndex(current: number, count: number, back: boolean): number {
  if (count <= 0) return -1;
  if (current === -1) return back ? count - 1 : 0;
  return back ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Visible, focusable descendants in DOM order.
 *
 * **All three exclusions ask the ancestor chain, and that is the whole point of this
 * comment.** For most of M17 the first two used `closest()` and the third used
 * `getAttribute('inert')` — which inspects the element and nothing above it. So a control
 * inside an `inert` *container* stayed in this list while the browser had already dropped
 * it from the tab order, and the boundary arithmetic below (`current === items.length - 1`)
 * was computed against phantom entries. `DiffScreen` is the first inert container this repo
 * ever mounted inside an *active* trap root, which is why nothing caught it earlier.
 *
 * The shape is worth naming because it is the house defect in miniature: an instrument that
 * checks ancestry for two attributes and the element alone for a third is an include-list —
 * it is blind to exactly the case nobody wrote down.
 */
export function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest('[hidden]')) return false;
    if (element.closest('[aria-hidden="true"]')) return false;
    if (element.closest('[inert]')) return false;
    // getComputedStyle rather than offsetParent: jsdom has no layout engine and reports
    // offsetParent as null for everything, which would make the trap untestable.
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
}
