import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaRegistrar } from './PwaRegistrar';
import { DEV_SERVICE_WORKER_EVICTION } from '../../lib/pwa';

/**
 * §3.6 — and specifically the half of §3.6 that has to *undo* itself.
 *
 * Read the limit of these tests before trusting them. Everything here is a **declaration
 * check**: it reads our own markup back to us in jsdom, which has no service worker, no
 * `caches`, and no way to be poisoned. Every one of these would have passed on
 * 2026-08-21 with the cache-first bug fully live, because the bug was never in what we
 * render — it was in what an already-registered worker does to a request.
 *
 * The observation that means something is `scripts/check-sw-poisoning.mjs`: it registers
 * the worker in a real Chrome with a persistent profile, seeds the cache with a body that
 * differs from the server's, and reads back what the browser actually gets. These tests
 * exist to keep the *wiring* from silently disappearing between runs of that probe.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PwaRegistrar (§3.6)', () => {
  it('renders nothing at all in production, and registers the worker', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
    const { container } = render(<PwaRegistrar />);
    expect(container.innerHTML).toBe('');
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'serviceWorker');
  });

  it('ships the eviction script in development, inline and server-rendered', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { container } = render(<PwaRegistrar />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    // An inline script, not `src`: a `src` would be a request the poisoned worker could
    // answer from its own cache, which is the one thing we cannot let it do here.
    expect(script?.getAttribute('src')).toBeNull();
    expect(script?.innerHTML).toBe(DEV_SERVICE_WORKER_EVICTION);
  });

  it('does not register a worker in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const register = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
    render(<PwaRegistrar />);
    expect(register).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'serviceWorker');
  });
});

describe('the eviction snippet itself', () => {
  it('unregisters, clears caches, and reloads — all three, or it rescues nobody', () => {
    // Named individually because each one alone is insufficient, and that is the whole
    // finding: unregistering without clearing caches leaves the next worker a poisoned
    // store to serve from, and clearing without reloading leaves *this* page running the
    // stale chunks it already took from the cache.
    expect(DEV_SERVICE_WORKER_EVICTION).toContain('unregister()');
    expect(DEV_SERVICE_WORKER_EVICTION).toContain('caches.delete');
    expect(DEV_SERVICE_WORKER_EVICTION).toContain('location.reload()');
  });

  it('cannot become a reload loop', () => {
    expect(DEV_SERVICE_WORKER_EVICTION).toContain('sessionStorage.getItem');
    expect(DEV_SERVICE_WORKER_EVICTION).toContain('sessionStorage.setItem');
  });

  it('is safe as the body of a <script> element', () => {
    // `dangerouslySetInnerHTML` does no escaping. A `</` anywhere in here would close the
    // element early and put the rest of the snippet into the document as text.
    expect(DEV_SERVICE_WORKER_EVICTION).not.toContain('</');
  });

  it('actually evicts, run against a fake registration', async () => {
    // The closest jsdom can get to the real thing: run the snippet with a stub
    // `navigator.serviceWorker` and `caches`, and assert on what it called. This does not
    // prove the browser recovers — see the file header — it proves the snippet is not
    // inert, which is the failure mode a string constant invites.
    const unregister = vi.fn().mockResolvedValue(true);
    const cacheDelete = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
    });
    vi.stubGlobal('caches', { keys: async () => ['cc-shell-v1-static'], delete: cacheDelete });
    const session = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => session.set(k, v),
    });
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('console', { ...console, warn: vi.fn() });

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(DEV_SERVICE_WORKER_EVICTION)();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledWith('cc-shell-v1-static');
  });

  it('does nothing when there is nothing to evict', async () => {
    const reload = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [] } });
    vi.stubGlobal('caches', { keys: async () => [], delete: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal('location', { reload });

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(DEV_SERVICE_WORKER_EVICTION)();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).not.toHaveBeenCalled();
  });
});
