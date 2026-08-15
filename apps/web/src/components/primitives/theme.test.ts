/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  currentTheme,
  resolveTheme,
  setTheme,
  storedTheme,
  toggleTheme,
} from './theme';

function mockPrefersLight(light: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-color-scheme: light') ? light : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.className = '';
});

afterEach(() => {
  // @ts-expect-error — restore jsdom.
  delete window.matchMedia;
});

describe('theme (§1.2)', () => {
  it('the product default is dark', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('follows prefers-color-scheme on a first visit', () => {
    mockPrefersLight(true);
    expect(storedTheme()).toBeNull();
    expect(resolveTheme()).toBe('light');

    mockPrefersLight(false);
    expect(resolveTheme()).toBe('dark');
  });

  it('a stored choice outranks the OS', () => {
    mockPrefersLight(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(resolveTheme()).toBe('dark');
  });

  it('the switch is exactly one class on <body>', () => {
    setTheme('light');
    expect(document.body.classList.contains('light')).toBe(true);
    setTheme('dark');
    expect(document.body.classList.contains('light')).toBe(false);
  });

  it('persists the choice', () => {
    setTheme('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('toggles and reports the new theme', () => {
    expect(toggleTheme()).toBe('light');
    expect(currentTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
  });

  it('notifies canvas consumers, which cannot read CSS variables', () => {
    let seen: string | undefined;
    const onChange = (e: Event) => {
      seen = (e as CustomEvent<{ theme: string }>).detail.theme;
    };
    window.addEventListener('cc:themechange', onChange);
    setTheme('light');
    window.removeEventListener('cc:themechange', onChange);
    expect(seen).toBe('light');
  });

  it('the no-flash script runs before React and never throws', () => {
    mockPrefersLight(true);
    // eslint-disable-next-line no-eval
    expect(() => eval(THEME_INIT_SCRIPT)).not.toThrow();
    expect(document.body.classList.contains('light')).toBe(true);
  });
});
