/**
 * Shim so the root `npm test` glob (`scripts/__tests__/*.test.mjs`) picks up the layout
 * engine's suite, which lives next to the engine it tests at `scripts/lib/layout.test.mjs`.
 * Root `package.json` is owned by `infra-compose-engineer`; this avoids editing it.
 */
import './../lib/layout.test.mjs';
