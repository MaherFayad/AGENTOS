import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUSH_SUBSCRIBE_ENDPOINT,
  enablePushNotifications,
  registerServiceWorker,
  urlBase64ToUint8Array,
} from './pwa';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../../public');

afterEach(() => {
  vi.unstubAllEnvs();
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

  it('never registers in development, whatever the caller does', async () => {
    // The costume this bug wore: a service worker under `next dev` pins one build's
    // non-hashed chunk URLs, so the server renders today's HTML against last rebuild's
    // JavaScript and React throws a hydration error on every route. The guard is inside
    // this function rather than at its one call site so a second caller cannot undo it.
    vi.stubEnv('NODE_ENV', 'development');
    const register = vi.fn().mockResolvedValue({ scope: '/' });
    withServiceWorker(register);
    await expect(registerServiceWorker()).resolves.toBeNull();
    expect(register).not.toHaveBeenCalled();
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

describe('enablePushNotifications', () => {
  it('returns a sentence when the browser has no PushManager, and does not throw', async () => {
    const outcome = await enablePushNotifications('key');
    expect(outcome.state).toBe('unsupported');
    if (outcome.state !== 'unsupported') throw new Error('expected unsupported');
    expect(outcome.message.length).toBeGreaterThan(10);
  });

  it('returns a sentence when permission is denied', async () => {
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn(), ready: Promise.resolve({ pushManager: { subscribe: vi.fn() } }) },
    });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    const outcome = await enablePushNotifications('key');
    expect(outcome.state).toBe('denied');
    if (outcome.state !== 'denied') throw new Error('expected denied');
    expect(outcome.message).toMatch(/Notifications are off/);
  });
});

describe('on-disk PWA assets', () => {
  it('serves a dark standalone manifest with 192, 512 and maskable 512 icons', () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe(manifest.background_color);
    expect(manifest.theme_color).toHaveLength(7);
    expect(manifest.theme_color.startsWith('#')).toBe(true);
    expect(existsSync(join(PUBLIC, 'icons/icon-192.png'))).toBe(true);
    expect(existsSync(join(PUBLIC, 'icons/icon-512.png'))).toBe(true);
    expect(existsSync(join(PUBLIC, 'icons/icon-maskable-512.png'))).toBe(true);
    expect(existsSync(join(PUBLIC, 'icons/badge-72.png'))).toBe(true);
  });

  it('imports the sessions push module and registers no push handler of its own', () => {
    const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8');
    expect(sw).toContain("importScripts('/sw-push.js')");
    expect(sw).not.toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toContain("pathname.startsWith('/api/')");
    expect(sw).toContain("pathname.startsWith('/ws/')");
  });
});
