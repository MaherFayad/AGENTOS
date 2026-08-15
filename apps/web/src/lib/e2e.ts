/* =============================================================================
 * lib/e2e.ts — THE DECRYPTION BOUNDARY (spec §3.1, ADR-005)
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ EVERYTHING BELOW THIS LINE RUNS IN THE USER'S BROWSER AND NOWHERE ELSE.   │
 * │                                                                           │
 * │ The key never leaves the browser. It is not sent to our server, not to    │
 * │ the relay, not into a log line, not into a Langfuse trace, not into a     │
 * │ push notification payload, and not into an error report. The relay is     │
 * │ transport; it never sees plaintext.                                       │
 * │                                                                           │
 * │ This is enforced structurally, not by convention: the key is imported     │
 * │ with `extractable: false`, so `crypto.subtle.exportKey` REJECTS for it    │
 * │ and no script — ours, a dependency's, or an injected one — can serialise  │
 * │ it into a request body. `e2e.test.mjs` asserts exactly that.              │
 * │                                                                           │
 * │ Any design that decrypts server-side is rejected on sight, no matter how  │
 * │ convenient. If a feature needs plaintext the server cannot have, the      │
 * │ feature changes — not the threat model. (§3.1, BOARD standing constraint) │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * NODE-LOADABLE LEAF: no local imports, so the boundary test can load it
 * directly under `node --test`.
 * ========================================================================== */

/** Wire format for an encrypted value. Opaque to every server on the path. */
export interface SealedBox {
  /** Envelope version — lets us change cipher suite without ambiguity. */
  v: 1;
  /** Cipher suite. See ADR-005 "hard now" about matching upstream's NaCl. */
  alg: 'AES-GCM';
  /** Base64 nonce. Fresh per message; never reused with the same key. */
  iv: string;
  /** Base64 ciphertext with the auth tag appended. */
  ct: string;
}

/**
 * The pluggable cipher slot.
 *
 * happy-server's own clients use NaCl secretbox (XSalsa20-Poly1305), which
 * WebCrypto does not implement. Matching it byte-for-byte needs a dependency
 * (`tweetnacl` / `libsodium-wrappers`) that `apps/web/package.json` does not
 * yet carry — see the decision-request in comms/inbox. Until that lands, the
 * shipped implementation is WebCrypto AES-GCM, which is a real cipher with the
 * right shape but is NOT wire-compatible with a live happy container.
 *
 * The boundary, the key handling and the tests are final. Only the suite moves,
 * and it moves here, in one object.
 */
export interface SecretBox {
  seal(key: CryptoKey, plaintext: string): Promise<SealedBox>;
  open(key: CryptoKey, box: SealedBox): Promise<string>;
}

/* ------------------------------------------------------------------ base64 */

const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  // Explicit ArrayBuffer backing — WebCrypto's BufferSource rejects SharedArrayBuffer
  // under TS 5.7+ DOM typings.
  const out = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/* --------------------------------------------------------------------- key */

/**
 * OWASP's floor for PBKDF2-HMAC-SHA256. Deliberately not a "fast" number: the
 * derivation runs once per unlock, on a device the user is holding, and the
 * thing it protects is every transcript they have ever had.
 */
export const PBKDF2_ITERATIONS = 310_000;

/** Fixed application salt, mixed with the user's own salt. Not a secret. */
const CONTEXT = 'agnetos/sessions/v1';

/**
 * Derive the session key from the user's recovery secret.
 *
 * `extractable: false` is the load-bearing argument in this file. Removing it
 * would make every other guarantee here a promise instead of a property.
 */
export async function deriveSessionKey(
  recoverySecret: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (!recoverySecret) throw new Error('e2e: empty recovery secret');
  if (salt.byteLength < 16) throw new Error('e2e: salt must be >= 16 bytes');

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(recoverySecret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const context = new TextEncoder().encode(CONTEXT);
  const fullSalt = new Uint8Array(context.length + salt.length) as Uint8Array<ArrayBuffer>;
  fullSalt.set(context, 0);
  fullSalt.set(salt, context.length);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fullSalt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  );
}

/* -------------------------------------------------------------- seal / open */

export const webCryptoBox: SecretBox = {
  async seal(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    return { v: 1, alg: 'AES-GCM', iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  },

  async open(key, box) {
    if (box.v !== 1 || box.alg !== 'AES-GCM') {
      throw new Error(`e2e: unsupported envelope ${box.v}/${box.alg}`);
    }
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(box.iv) },
      key,
      unb64(box.ct),
    );
    return new TextDecoder().decode(plain);
  },
};

/** Encrypt before anything leaves the browser. */
export const seal = (key: CryptoKey, plaintext: string): Promise<SealedBox> =>
  webCryptoBox.seal(key, plaintext);

/** ← THE BOUNDARY. Ciphertext in, plaintext out, in the user's browser only. */
export const open = (key: CryptoKey, box: SealedBox): Promise<string> =>
  webCryptoBox.open(key, box);

/** Convenience for the metadata/transcript envelopes, which are JSON. */
export async function openJson<T>(key: CryptoKey, box: SealedBox): Promise<T> {
  return JSON.parse(await open(key, box)) as T;
}

/** Convenience for input the user typed — sealed before it is ever POSTed. */
export async function sealJson(key: CryptoKey, value: unknown): Promise<SealedBox> {
  return seal(key, JSON.stringify(value));
}

/** Parse a base64 envelope string (how the relay stores boxes) into a box. */
export function parseSealed(encoded: string): SealedBox {
  const parsed = JSON.parse(new TextDecoder().decode(unb64(encoded))) as SealedBox;
  if (parsed?.v !== 1 || typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') {
    throw new Error('e2e: malformed sealed envelope');
  }
  return parsed;
}

/** Inverse of `parseSealed` — what we hand to the relay. */
export function encodeSealed(box: SealedBox): string {
  return b64(new TextEncoder().encode(JSON.stringify(box)));
}

/* ------------------------------------------------------- key at rest, local */

const DB = 'agnetos-e2e';
const STORE = 'keys';
const KEY_ID = 'session-key';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return idb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Persist the key locally.
 *
 * A non-extractable `CryptoKey` is structured-cloneable, so IndexedDB can hold
 * the *handle* while the key material itself stays inside the platform's crypto
 * store. The service worker reads the same handle to render detailed
 * notifications without our server ever being involved (§3.6).
 *
 * Note what is NOT here: no `localStorage`, because that is a string store and
 * a string is exportable.
 */
export async function persistSessionKey(key: CryptoKey): Promise<void> {
  await tx('readwrite', (s) => s.put(key, KEY_ID) as IDBRequest<unknown>);
}

/** Load the key, or `null` if this device has never been unlocked. */
export async function loadSessionKey(): Promise<CryptoKey | null> {
  try {
    return (await tx('readonly', (s) => s.get(KEY_ID) as IDBRequest<CryptoKey>)) ?? null;
  } catch {
    return null;
  }
}

/** Forget the key on this device. The relay's copy stays unreadable forever. */
export async function forgetSessionKey(): Promise<void> {
  await tx('readwrite', (s) => s.delete(KEY_ID) as IDBRequest<undefined>);
}

/**
 * Assert a key is safe to hold. Called at the unlock path so a regression in
 * `deriveSessionKey` fails loudly at runtime and not just in CI.
 */
export function assertNonExtractable(key: CryptoKey): void {
  if (key.extractable) {
    throw new Error(
      'e2e: refusing an extractable key — the key must not be serialisable (ADR-005)',
    );
  }
}
