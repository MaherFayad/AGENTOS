import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { QUARANTINE, QUARANTINED_FILES } from './quarantine';

/**
 * The tripwire on `quarantine.ts`.
 *
 * `npm run test:web` must never be able to report green while test files are being
 * skipped. This file fails for exactly as long as the quarantine list is non-empty, and
 * names the owner of each entry in the failure message, so the cost of leaving a file
 * excluded is paid on every run rather than discovered months later.
 *
 * To clear an entry: fix the file, delete it from `quarantine.ts`. That is the whole
 * process. When the list is empty this suite goes green on its own.
 */

// NB: not `new URL('.', import.meta.url)` — Vite rewrites that pattern into an asset URL.
const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('quarantined test files', () => {
  it('every quarantined path still exists — a stale entry hides a deleted file', () => {
    const missing = QUARANTINED_FILES.filter((f) => !existsSync(join(WEB_ROOT, f)));
    expect(missing, `quarantine.ts lists paths that no longer exist: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('the quarantine list is empty', () => {
    const summary = QUARANTINE.map(
      (q) => `\n  ${q.owner} owns ${q.files.length} excluded file(s):\n    ${q.files.join('\n    ')}\n  reason: ${q.reason}`,
    ).join('\n');

    expect(
      QUARANTINED_FILES.length,
      `${QUARANTINED_FILES.length} test file(s) are excluded from this run and are NOT being ` +
        `verified by anything. This suite is red by design until they are fixed and removed ` +
        `from src/test/quarantine.ts.${summary}\n`,
    ).toBe(0);
  });
});
