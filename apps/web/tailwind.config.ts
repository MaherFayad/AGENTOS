import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * tailwind.config.ts — spec Part I, expressed as utilities.
 *
 * Every design decision in Part I has exactly one utility here. That is the
 * point: a component writes `bg-card border-line rounded-card text-small` and
 * never `bg-[#1B1B21]`, never `var(--card)` inline, never `text-[13px]`.
 * `node scripts/check-tokens.mjs` enforces it.
 *
 * The colors resolve to CSS variables from src/styles/tokens.css, so the light
 * theme is a class on <body> and no utility, component or variant knows which
 * theme is active.
 *
 * NAMING, and it is load-bearing (§1.3):
 *   chrome  → bg / bg-2 / bg-3 / ivory / ivory-2 / ink-2 / ink-3 / line / card …
 *   data ink→ ink-copper / ink-teal / ink-coral / ink-lavender / ink-amber / ink-blue
 * `bg-ink-teal` on a panel is a review failure. `bg-ink-teal` on a progress bar
 * that means "on track" is correct. The checker knows the difference by path.
 *
 * Owner: design-system-guardian
 */

/**
 * Tailwind's `dark:` variant is pointed at our real selector so that a stray
 * `dark:` at least produces truthful CSS — but using it is still a review
 * failure. §1.2: no component branches on theme; the tokens do the branching.
 */
const config: Config = {
  darkMode: ['selector', 'body:not(.light)'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* -- §1.1 / §1.2 chrome. Monochrome, theme-swapping. ---------------- */
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        'bg-3': 'var(--bg-3)',
        ivory: 'var(--ivory)',
        'ivory-2': 'var(--ivory-2)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        copper: 'var(--copper)',
        'copper-ink': 'var(--copper-ink)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        card: 'var(--card)',
        'card-2': 'var(--card-2)',
        glass: 'var(--glass)',
        screen: 'var(--screen)',
        'screen-2': 'var(--screen-2)',
        scrim: 'var(--scrim)',

        /* -- §1.3 data ink. Status, deltas, chart series, "alive". ---------- */
        ink: {
          copper: 'var(--ink-copper)',
          'copper-2': 'var(--ink-copper-2)',
          'copper-line': 'var(--ink-copper-line)',
          'copper-fill': 'var(--ink-copper-fill)',
          teal: 'var(--ink-teal)',
          'teal-line': 'var(--ink-teal-line)',
          'teal-fill': 'var(--ink-teal-fill)',
          coral: 'var(--ink-coral)',
          'coral-2': 'var(--ink-coral-2)',
          'coral-line': 'var(--ink-coral-line)',
          'coral-fill': 'var(--ink-coral-fill)',
          lavender: 'var(--ink-lavender)',
          'lavender-2': 'var(--ink-lavender-2)',
          'lavender-line': 'var(--ink-lavender-line)',
          'lavender-fill': 'var(--ink-lavender-fill)',
          amber: 'var(--ink-amber)',
          'amber-line': 'var(--ink-amber-line)',
          'amber-fill': 'var(--ink-amber-fill)',
          blue: 'var(--ink-blue)',
          'blue-line': 'var(--ink-blue-line)',
          'blue-fill': 'var(--ink-blue-fill)',
        },
      },

      /* -- §1.4 families. Instrument Serif is italic-only in practice. ------ */
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        arabic: ['var(--font-arabic)'],
      },

      /**
       * §1.4 type scale — the seven verified roles, plus three shell sizes the
       * product screens need at 10/11/12px. Size, weight, tracking and leading
       * travel together so `text-h2` is the whole decision, not a third of it.
       */
      fontSize: {
        // Display H1 — 86 / 700 / −2.4px (−0.028em)
        display: ['86px', { lineHeight: '0.96', letterSpacing: '-0.028em', fontWeight: '700' }],
        // H1 accent words — Instrument Serif italic, 91 / 400 / −0.01em
        'h1-accent': ['91px', { lineHeight: '0.96', letterSpacing: 'var(--track-accent)', fontWeight: '400' }],
        // H2 — 50 / 700 / −1.4px
        h2: ['50px', { lineHeight: '1.04', letterSpacing: '-1.4px', fontWeight: '700' }],
        // Body — 16 / 400 / 1.6
        body: ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        // Small / meta — 12–13 / 400–600. `small` is the 13px end.
        small: ['13px', { lineHeight: '1.45', fontWeight: '400' }],
        meta: ['12px', { lineHeight: '1.45', fontWeight: '400' }],
        // Wide-tracked label — 11–13 / 500 / +0.25em…+0.45em, uppercase.
        // Tracking is per-use (tracking-wider-1 … -4); the size carries 500.
        label: ['11px', { lineHeight: '1', letterSpacing: '0.25em', fontWeight: '500' }],
        'label-sm': ['10px', { lineHeight: '1', letterSpacing: '0.3em', fontWeight: '500' }],
        'label-lg': ['13px', { lineHeight: '1', letterSpacing: '0.25em', fontWeight: '500' }],
        // KPI numeral — 28–32 / 600, tabular-nums (add the `tabular-nums` class).
        kpi: ['30px', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'kpi-sm': ['28px', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'kpi-lg': ['32px', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '600' }],
        // Pill / button label — 13 / 600 (§1.5)
        pill: ['13px', { lineHeight: '1', fontWeight: '600' }],
        // Chip — 11 / 500 (§2.x status chips)
        chip: ['11px', { lineHeight: '1', fontWeight: '500' }],
      },

      /**
       * §1.4 tracking. The wide end is the fidelity risk: under-tracking a caps
       * label is the single most common way this stops looking expensive.
       * Four rungs across the verified +0.25em…+0.45em range.
       */
      letterSpacing: {
        display: '-0.028em',
        accent: 'var(--track-accent)',
        h2: '-1.4px',
        kpi: '-0.01em',
        // Through tokens, so the RTL layer can flatten all four at once.
        'wider-1': 'var(--track-1)',
        'wider-2': 'var(--track-2)',
        'wider-3': 'var(--track-3)',
        'wider-4': 'var(--track-4)',
      },

      /* -- §1.5 radii ------------------------------------------------------ */
      borderRadius: {
        pill: 'var(--r-pill)',
        chip: 'var(--r-chip)',
        kpi: 'var(--r-kpi)',
        'card-sm': 'var(--r-card-sm)',
        card: 'var(--r-card)',
        'card-lg': 'var(--r-card-lg)',
        panel: 'var(--r-panel)',
        'panel-lg': 'var(--r-panel-lg)',
      },

      borderWidth: {
        hairline: 'var(--border-w)',
      },

      /* -- §1.5 depth. Dark mode has no shadow except drawers. ------------- */
      boxShadow: {
        drawer: 'var(--shadow-drawer)',
        soft: 'var(--shadow-soft)',
      },

      backdropBlur: {
        glass: 'var(--blur-glass)',
        glow: 'var(--galaxy-glow-blur)',
      },

      backgroundImage: {
        'dot-grid':
          'radial-gradient(var(--dot-color) var(--dot-size), transparent var(--dot-size))',
        'galaxy-glow': 'var(--galaxy-glow)',
      },

      backgroundSize: {
        'dot-grid': 'var(--dot-pitch) var(--dot-pitch)',
      },

      /* -- §1.6 motion ----------------------------------------------------- */
      transitionDuration: {
        reveal: 'var(--dur-reveal)',
        drawer: 'var(--dur-drawer)',
        relax: 'var(--dur-relax)',
        zoom: 'var(--dur-zoom)',
        count: 'var(--dur-count)',
        hover: 'var(--dur-hover)',
      },

      transitionTimingFunction: {
        reveal: 'var(--ease-reveal)',
        drawer: 'var(--ease-drawer)',
        zoom: 'var(--ease-zoom)',
      },

      translate: {
        reveal: 'var(--reveal-y)',
      },

      /**
       * Layering. Not in Part I — an owner addition, because thirteen agents
       * each picking a z-index is a guaranteed afternoon of debugging.
       */
      zIndex: {
        canvas: '0',
        overlay: '10',
        chrome: '20',
        scrim: '30',
        drawer: '40',
        toast: '60',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        /* §1.5 dotted-grid canvas texture — image + pitch in one class. */
        '.dot-grid': {
          backgroundImage:
            'radial-gradient(var(--dot-color) var(--dot-size), transparent var(--dot-size))',
          backgroundSize: 'var(--dot-pitch) var(--dot-pitch)',
        },
        /* Rail labels (§2.1 department rails). Vertical text without a
         * transform, so the element still takes part in layout and RTL flips
         * come from the writing mode rather than a hardcoded rotate(). */
        '.rail-up': {
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
        },
        '.rail-down': {
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        },
        /* §1.5 glass surfaces: --glass + backdrop-filter: blur(14px). */
        '.glass': {
          backgroundColor: 'var(--glass)',
          backdropFilter: 'blur(var(--blur-glass))',
          WebkitBackdropFilter: 'blur(var(--blur-glass))',
        },
      });
    }),
  ],
};

export default config;
