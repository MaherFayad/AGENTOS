/**
 * theme.ts — the theme switch, and the only code in the app that knows a theme
 * exists (§1.2).
 *
 * The switch is one thing: class `light` on <body>. Every token flips
 * underneath. NO COMPONENT MAY BRANCH ON THEME — if you find yourself writing
 * `theme === 'light' ? … : …` inside a component, the token is missing, not the
 * branch. File a decision-request to design-system-guardian instead.
 *
 * Canvas is the one honest exception: <canvas> cannot read a CSS variable, so
 * the map and chart renderers resolve tokens through getComputedStyle and
 * re-resolve on THEME_CHANGE_EVENT. `readToken()` below is that door, and it is
 * the only sanctioned one.
 *
 * Owner: design-system-guardian
 */

import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

/** localStorage key. Namespaced so it survives alongside other app state. */
export const THEME_STORAGE_KEY = 'cc.theme';

/** Fired on <window> after the class flips, for non-React consumers (canvas). */
export const THEME_CHANGE_EVENT = 'cc:themechange';

/** Product default is dark (§1.1 "the product default"). */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Inline, blocking script for the top of <body>. Prevents the flash of the
 * wrong theme on first paint. Owned here, consumed by apps/web/src/app/layout.tsx
 * (infra-compose-engineer) as:
 *
 *   <body><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /> …
 *
 * Kept as a string, minified by hand, because it must run before React does.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark');var a=function(){document.body.classList.toggle('light',t==='light')};document.body?a():document.addEventListener('DOMContentLoaded',a)}catch(e){}})();`;

/** The stored preference, or null when the user has never chosen. */
export function storedTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // private mode / storage disabled — fall through to the OS.
  }
}

/** What the OS asks for. First visit only; a stored choice always wins. */
export function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Stored choice → OS preference → dark. */
export function resolveTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** What the DOM currently says. The class is the source of truth, not state. */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.body.classList.contains('light') ? 'light' : 'dark';
}

/** Flip the class, persist the choice, tell canvas consumers. */
export function setTheme(theme: Theme, { persist = true } = {}): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('light', theme === 'light');
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage disabled — the class still flipped, which is what matters. */
    }
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

/**
 * Resolve a CSS custom property to a concrete color string.
 * For <canvas> only — DOM elements must use the Tailwind token utility.
 * Re-call it on THEME_CHANGE_EVENT; do not cache across a theme flip.
 */
export function readToken(name: string, el?: Element): string {
  if (typeof window === 'undefined') return '';
  const target = el ?? document.body;
  return getComputedStyle(target).getPropertyValue(name).trim();
}

/** Live theme, hydration-safe (server snapshot is the product default). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => DEFAULT_THEME);
}

function subscribeTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  // Also follow the OS while the user has made no explicit choice.
  const mql = window.matchMedia?.('(prefers-color-scheme: light)');
  const onSystem = () => {
    if (storedTheme() === null) setTheme(systemTheme(), { persist: false });
    onChange();
  };
  mql?.addEventListener?.('change', onSystem);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    mql?.removeEventListener?.('change', onSystem);
  };
}
