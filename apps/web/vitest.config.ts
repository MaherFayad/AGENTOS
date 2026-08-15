import { defineConfig } from 'vitest/config';

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
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
});
