/**
 * fonts.ts — §1.4 typography, self-hosted. Zero external requests at runtime.
 *
 * Standing constraint (BOARD, item 7): the app makes no network request to
 * fonts.googleapis.com, fonts.gstatic.com or any CDN. These packages ship the
 * woff2 files inside node_modules; the bundler emits them from our own origin.
 * If you ever see a `<link href="https://fonts.…">` in this app, it is a bug.
 *
 * Every @fontsource stylesheet declares `font-display: swap` and a
 * `unicode-range` per subset, so a browser downloads only the subsets it needs
 * — the Arabic faces cost a Latin-only reader nothing.
 *
 * Consumed by apps/web/src/app/layout.tsx (owner: infra-compose-engineer):
 *
 *   import '@/styles/fonts';
 *
 * That single side-effect import is the whole integration. Families reach
 * components through --font-sans / --font-serif / --font-arabic in tokens.css
 * and the Tailwind `font-sans` / `font-serif` / `font-arabic` utilities.
 *
 * Owner: design-system-guardian
 */

/* Plus Jakarta Sans — the workhorse. 400 body, 500 wide-tracked labels,
 * 600 KPI numerals and pills, 700 display and H2 (§1.4). */
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

/* Instrument Serif — the brand signature. Italic is what we actually use:
 * headline accent words, watermarks, rail caps. Upright 400 is loaded because
 * the italic face is only correct next to it in a fallback chain. */
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

/* IBM Plex Sans Arabic — Arabic body and labels (§1.4 Arabic note).
 * No italic face exists and none is wanted: MSA uses weight contrast, not
 * slant. 600 is the emphasis face; Instrument Serif never touches Arabic. */
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';

/**
 * The family names, for the rare place a family must reach JS — a canvas
 * `ctx.font`, a PDF export, an SVG <text> measured off-DOM. DOM code uses the
 * Tailwind utility instead.
 */
export const FONT_FAMILY = {
  sans: 'Plus Jakarta Sans',
  serif: 'Instrument Serif',
  arabic: 'IBM Plex Sans Arabic',
} as const;

/** CSS variable names these families are wired to in tokens.css. */
export const FONT_VAR = {
  sans: '--font-sans',
  serif: '--font-serif',
  arabic: '--font-arabic',
} as const;

/**
 * Faces that are worth a `<link rel="preload">` because they paint above the
 * fold on first render: body copy and the wide-tracked shell labels.
 *
 * Deliberately data, not markup. Emitting the tags needs the bundler's hashed
 * asset URL, which means either importing the .woff2 files (requires a
 * `*.woff2` module declaration in apps/web — infra's file) or copying them to
 * /public at postinstall. Recorded here so whoever wires it does not have to
 * re-derive which faces matter. See the handoff, "Deliberately not done".
 */
export const PRELOAD_FACES = [
  { family: FONT_FAMILY.sans, weight: 400, style: 'normal' },
  { family: FONT_FAMILY.sans, weight: 500, style: 'normal' },
  { family: FONT_FAMILY.sans, weight: 700, style: 'normal' },
  { family: FONT_FAMILY.serif, weight: 400, style: 'italic' },
] as const;
