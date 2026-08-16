import { fileURLToPath } from 'node:url';

import { defaultExclude, defineConfig } from 'vitest/config';

import { QUARANTINED_FILES } from './src/test/quarantine';

/**
 * Test config for the web app. Written by `shell-navigation-engineer` alongside the
 * §2.0 shell's co-located tests — if `infra-compose-engineer` lands a fuller one, keep
 * theirs and delete this; the only requirements are jsdom, automatic JSX, and the
 * cleanup setup file.
 *
 * No `@vitejs/plugin-react`: tests need JSX transformed, not fast-refreshed, and esbuild
 * does that on its own. One less dependency to justify.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // Mirrors tsconfig `paths`. Source under src/ imports `@/map/...`,
      // `@/drawer/...` etc.; without this nothing resolves under Vitest.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // `.mjs` suites under `__tests__/` use the `node:test` API, not Vitest's.
    // They run via `npm run test:node`. See handoff M0-fidelity-qa-reviewer-test-runner.
    include: ['src/**/*.test.{ts,tsx}'],
    // Files that hang the worker at import time. A hang makes `verify` never return,
    // which is how a suite gets dropped from CI. `src/test/quarantine.test.ts` fails for
    // as long as this list is non-empty, so nothing here is silently skipped.
    exclude: [...defaultExclude, ...QUARANTINED_FILES],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
});
