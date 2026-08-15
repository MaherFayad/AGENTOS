import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUSH_SUBSCRIBE_ENDPOINT, registerServiceWorker, urlBase64ToUint8Array } from './pwa';

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'serviceWorker');
});

const withServiceWorker = (register: () => Promise<unknown>): void => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
};

describe('registerServiceWorker', () => {
  it('is a no-op when the browser has no service worker support', async () => {
    await expect(registerServiceWorker()).resolves.toBeNull();
  });

  it('registers /sw.js at the root scope', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    withServiceWorker(register);
    await registerServiceWorker();
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('swallows a registration failure — a dead SW must not break the app', async () => {
    withServiceWorker(vi.fn().mockRejectedValue(new Error('nope')));
    await expect(registerServiceWorker()).resolves.toBeNull();
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes url-safe base64 into raw bytes', () => {
    // "hi" -> aGk=, url-safe and unpadded.
    expect(Array.from(urlBase64ToUint8Array('aGk'))).toEqual([104, 105]);
  });
});

describe('push subscribe endpoint', () => {
  it('matches the relay contract', () => {
    // contracts/api-contracts.md — POST /api/push/subscribe
    expect(PUSH_SUBSCRIBE_ENDPOINT).toBe('/api/push/subscribe');
  });
});
