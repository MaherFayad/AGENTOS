'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * Keeps `--shell-bar-t` / `--shell-bar-b` equal to the chrome's *rendered* height.
 *
 * `tokens.css` declares the band from first principles (14px padding + a 32px pill,
 * plus the safe area), which is right for SSR and for plain CSS. It cannot know that
 * the breadcrumb strip appears only in a drill-in, or that a wrapped bottom-right
 * cluster is two rows tall on a phone. So once the chrome has painted, the shell
 * measures itself and publishes the truth over the declared value.
 *
 * That is the mechanism by which "the view must clear the bar" stops being a number
 * anyone can get wrong: `--shell-inset-t` is derived from a measurement of the actual
 * element, and every flow view reads it. Change the bar, and the offset changes with
 * it, in every view, with nothing to remember.
 *
 * `useEffect`, not `useLayoutEffect`: this only ever *refines* a value that is already
 * correct to within a few pixels, so there is nothing to flash, and a layout effect
 * would warn during SSR.
 *
 * The variables are written on the shell root, which carries `data-shell-root` — the
 * selector `tokens.css` uses to re-derive `--shell-inset-*` from them. Writing them
 * anywhere else would be a no-op.
 */
export interface ShellInsetRefs {
  /** The element the variables are written on — the shell root. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** Wraps TopBar + BreadcrumbStrip. */
  topRef: RefObject<HTMLDivElement | null>;
  /** Wraps BottomBar. */
  bottomRef: RefObject<HTMLDivElement | null>;
}

export function useShellInsets(): ShellInsetRefs {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const publish = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const top = topRef.current?.getBoundingClientRect().height;
    const bottom = bottomRef.current?.getBoundingClientRect().height;
    // A zero height means "not laid out yet" (jsdom, or a hidden tree). Leaving the
    // declared token in place beats publishing a 0 that would let a view slide back
    // under the bar.
    if (top) root.style.setProperty('--shell-bar-t', `${Math.round(top)}px`);
    if (bottom) root.style.setProperty('--shell-bar-b', `${Math.round(bottom)}px`);
  }, []);

  useEffect(() => {
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    if (topRef.current) observer.observe(topRef.current);
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [publish]);

  return { rootRef, topRef, bottomRef };
}
