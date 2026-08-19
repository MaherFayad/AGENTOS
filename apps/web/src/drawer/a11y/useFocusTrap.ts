'use client';

/**
 * Trap focus inside the drawer while it is open; give it back when it closes.
 *
 * The element that opened the drawer is captured at open time rather than passed in, so
 * the map and the chart do not have to know they are openers — they dispatch an event and
 * forget (§2.3, ADR-004).
 *
 * Owner: drawer-engineer
 */

import { useEffect, useRef, type RefObject } from 'react';
import { focusables, keyIntent, nextIndex } from './focus-trap';

export interface FocusTrapOptions {
  active: boolean;
  onClose: () => void;
  /** Skipped when the drawer opens under a pointer, so we never steal a click's focus. */
  autoFocus?: boolean;
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, { active, onClose, autoFocus = true }: FocusTrapOptions): void {
  /**
   * `onClose` is held in a ref and deliberately kept out of the effect's dependencies.
   *
   * It is not a micro-optimisation. The drawer's `onEscape` is a `useCallback` keyed on
   * `reviewing`, so with `onClose` in the dependency array this whole effect tore down and
   * re-ran every time the review screen opened or closed — and its setup **autofocuses**.
   * The visible symptom was that closing the review threw focus onto the drawer's ✕ instead
   * of returning it to the `Review` pill, because a trap that re-arms treats an unchanged
   * drawer as a newly opened one. Re-arming a focus trap is never what a changed callback
   * identity means.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const opener = document.activeElement as HTMLElement | null;

    if (autoFocus) {
      const first = focusables(root)[0];
      (first ?? root).focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent): void {
      const intent = keyIntent(event);
      if (!intent) return;
      if (intent === 'close') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      const items = focusables(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const back = intent === 'cycle-back';
      const leaving = current === -1 || (back ? current === 0 : current === items.length - 1);
      // Only intercept at the boundary. Inside the drawer the browser's own tab order is
      // better than anything re-implemented here.
      if (!leaving) return;
      event.preventDefault();
      items[nextIndex(current, items.length, back)].focus({ preventScroll: true });
    }

    /** A focus that escaped the drawer entirely (browser chrome, a stray programmatic focus). */
    function onFocusIn(event: FocusEvent): void {
      const target = event.target as Node | null;
      if (target && root && !root.contains(target)) {
        const items = focusables(root);
        (items[0] ?? root).focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      // Return focus to the invoking node — the map node, the chart card, the search hit.
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
    // `onClose` is intentionally absent — see `onCloseRef` above.
  }, [active, autoFocus, ref]);
}
