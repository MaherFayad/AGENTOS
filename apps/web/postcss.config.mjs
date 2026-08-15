/**
 * Tailwind v3 pipeline. `tailwind.config.ts` is owned by `design-system-guardian`
 * (comms/contracts/design-tokens.md §7) — this file only wires the plugins.
 *
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
