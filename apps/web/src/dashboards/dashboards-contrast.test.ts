/**
 * REQ-DASH-CONTRAST — no required reading in the disabled colour, and it stays that way.
 *
 * Adapted from `src/drawer/drawer-contrast.test.ts` (`drawer-engineer`), which
 * `fidelity-qa-reviewer` recommended promoting into this module and which the token owner
 * declined to mandate across modules they do not own. Taken up here on the arithmetic: the
 * drawer had five sites, DASHBOARDS had twenty.
 *
 * **It is not a copy, and the difference is the whole reason it earns its place.** The drawer
 * expresses its greys as `color: var(--ink-3)` in a CSS module, so parsing CSS finds all of
 * them. This module expresses sixteen of its twenty as the Tailwind utility `text-ink-3` in
 * `.tsx`, and two more as a *default prop value* on a shared primitive with no `ink-3` token
 * anywhere in the call site's source. A CSS-only guard would have caught 4 of 20 here. So
 * this file checks three surfaces:
 *
 *   1. `color: var(--ink-3)` in `dashboards.module.css`      (4 sites)
 *   2. `text-ink-3` in every `.tsx` under `src/dashboards/`   (14 sites)
 *   3. `<RailLabel>` rendered without an explicit `tone`      (2 sites, invisible to 1 and 2)
 *
 * Check 3 is the one worth stealing back. `RailLabel`'s default is `tone="faint"` =
 * `text-ink-3`, so `<RailLabel>{title}</RailLabel>` renders required reading in the disabled
 * colour while containing no string any grep for "ink-3" will ever match. Both dashboard rail
 * labels — the only visible thing telling you the screen edges are navigation — were in that
 * state, and neither the review nor the token owner's own fourteen-site enumeration listed
 * them, because both were produced by reading.
 *
 * `check-tokens.mjs` cannot check any of this and should not try: `var(--ink-3)` and
 * `text-ink-3` are legal token references with four genuine homes in contract §9.3. The
 * violation is semantic, so the check has to be too.
 *
 * Owner: dashboards-engineer · Contract: comms/contracts/design-tokens.md §9
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the Vitest root (`apps/web`) rather than `import.meta.url`: under jsdom the
// module URL is not a `file:` URL and `fileURLToPath` throws.
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const DIR = resolve(process.cwd(), 'src/dashboards');
const CSS = read('src/dashboards/dashboards.module.css');
const TOKENS = read('src/styles/tokens.css');

/**
 * Every CSS class still allowed to set `color: var(--ink-3)`, each with the reason it is not
 * required reading. Adding a key is deliberately annoying: you have to write why, and the
 * reason has to survive the delete-the-text test in tokens contract §9.2.
 *
 * **It is empty, and that is the finding.** All four CSS sites and all sixteen TSX sites were
 * required reading — not one survived the test. A module where the disabled token is 0-for-20
 * was not making twenty judgement calls; it was using `--ink-3` to mean "small", which is what
 * §9 exists to stop. If you are about to add an entry here, that history is the reason the bar
 * is a written sentence rather than a comment.
 */
const INK3_CSS_ALLOWLIST: Record<string, string> = {};

/**
 * Same, for the `text-ink-3` Tailwind utility in `.tsx`. Key is `<file>:<what it colours>`.
 * Also empty, for the same reason.
 */
const INK3_TSX_ALLOWLIST: Record<string, string> = {};

/* ------------------------------------------------------------------ parsing */

/** Strip comments, then split into `selector { declarations }` pairs. */
function rules(css: string): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
}

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) acc.push(full);
  }
  return acc;
}

/** `//` and `/* *\/` comments, so a comment explaining a fix cannot itself fail the test. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ------------------------------------------------------- contrast, measured */

/**
 * The two chrome blocks of `tokens.css`, in file order: dark `:root` first, light second.
 *
 * Indexed rather than branched on purpose. `check-tokens.mjs` flags `theme === '…'` under
 * `no-theme-branch` (§1.2 — the tokens branch, components never do). A lookup table expresses
 * the same thing without a theme comparison, and nothing here renders.
 */
const BLOCK_SELECTORS = [':root', 'body.light'] as const;
const BLOCK_OF: Record<'dark' | 'light', number> = { dark: 0, light: 1 };

type Rgba = [number, number, number, number];

function tokenValue(name: string, theme: 'dark' | 'light'): string {
  const start = TOKENS.indexOf(BLOCK_SELECTORS[BLOCK_OF[theme]]);
  const end = TOKENS.indexOf('}', start);
  const found = TOKENS.slice(start, end).match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!found) throw new Error(`token ${name} not found in the ${theme} block of tokens.css`);
  return found[1].trim();
}

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = hex[1];
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).concat(1) as unknown as Rgba;
  }
  const rgba = value.match(/rgba?\(([^)]+)\)/);
  if (!rgba) throw new Error(`cannot parse colour "${value}"`);
  const parts = rgba[1].split(',').map((p) => Number(p.trim()));
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

/**
 * Surface tokens are not all opaque: dark `--card` is `rgba(255,255,255,.025)` and dark
 * `--card-2` is `rgba(255,255,255,.05)`. Contrast against the literal token would flatter
 * every result, so alpha surfaces are composited over `--bg` exactly as §9.1 measured them.
 */
function surface(name: string, theme: 'dark' | 'light'): Rgba {
  const c = parse(tokenValue(name, theme));
  if (c[3] === 1) return c;
  const bg = parse(tokenValue('--bg', theme));
  return [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3])).concat(1) as unknown as Rgba;
}

function contrast(a: Rgba, b: Rgba): number {
  const lum = (c: Rgba) => {
    const [r, g, bl] = [c[0], c[1], c[2]]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const text = (name: string, theme: 'dark' | 'light') => parse(tokenValue(name, theme));

/* -------------------------------------------------------------------- tests */

describe('dashboards token contrast', () => {
  it('reproduces the measurement the M6 FAIL was written against', () => {
    // Not a tautology: it pins the numbers so a future token edit that quietly darkens
    // --ink-2 or lightens --bg fails here rather than in someone's screen reader.
    expect(contrast(text('--ink-3', 'dark'), surface('--bg', 'dark'))).toBeCloseTo(3.57, 1);
    expect(contrast(text('--ink-3', 'light'), surface('--bg', 'light'))).toBeCloseTo(3.0, 1);
  });

  it('keeps --ink-2 at AA on every STATIC surface this module renders prose on', () => {
    // --bg (the view), --card (WidgetChrome and KpiTile). Deliberately NOT --card-2: see the
    // next test. Contract §9.5 — light --ink-2 on --card-2 is 4.25:1 and the fix is ADR-011.
    for (const theme of ['dark', 'light'] as const) {
      for (const on of ['--bg', '--card'] as const) {
        expect(
          contrast(text('--ink-2', theme), surface(on, theme)),
          `--ink-2 on ${on} in ${theme}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the absent-reading dash at AA on the HOVER fill, which --ink-2 would not be', () => {
    // The §9.5 case, and in this module it is real rather than hypothetical: DataTable's peek
    // rows hover to --card-2 and an unpriced run's cost cell renders the dash inside one.
    // Both halves are asserted — that --ivory-2 clears, AND that --ink-2 does not — because
    // the second is the whole reason the first was chosen and it will not survive as a comment.
    for (const theme of ['dark', 'light'] as const) {
      expect(contrast(text('--ivory-2', theme), surface('--card-2', theme))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(text('--ink-2', 'light'), surface('--card-2', 'light'))).toBeLessThan(4.5);
  });

  it('paints the honest empty states as content, not as disabled text', () => {
    for (const [cls, token] of [
      ['.emptyLine', '--ink-2'], // every "No figure yet." / "Nothing in this window."
      ['.unsupported', '--ink-2'], // the failure sentence IS the box
      ['.hint', '--ink-2'], // "CLICK THE FRONT CARD TO ENTER" — said nowhere else
    ] as const) {
      const rule = rules(CSS).find((r) => r.selector === cls);
      expect(rule, `${cls} should exist in dashboards.module.css`).toBeDefined();
      expect(rule!.body, `${cls} must not use the disabled token`).not.toContain('var(--ink-3)');
      expect(rule!.body).toContain(`var(${token})`);
    }
  });

  it('has a written reason for every remaining --ink-3 text colour in the CSS module', () => {
    const users = rules(CSS)
      .filter((r) => /(^|[;\s])color:\s*var\(--ink-3\)/.test(r.body))
      .map((r) => r.selector)
      .sort();
    expect(users).toEqual(Object.keys(INK3_CSS_ALLOWLIST).sort());
  });

  it('has a written reason for every remaining text-ink-3 in the components', () => {
    const users: string[] = [];
    for (const file of tsxFiles(DIR)) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const hits = src.match(/text-ink-3/g);
      if (hits) users.push(...hits.map(() => file.slice(DIR.length + 1).replace(/\\/g, '/')));
    }
    expect(users.sort()).toEqual(
      Object.keys(INK3_TSX_ALLOWLIST)
        .map((k) => k.split(':')[0])
        .sort(),
    );
    for (const reason of Object.values(INK3_TSX_ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(40);
    }
  });

  it('never takes RailLabel’s faint default — the rails name a different dashboard', () => {
    // §9.3 allows --ink-3 for "a rail cap that repeats the heading beside it". That is the
    // MAP's rail. §2.5.6's rails carry the *neighbouring* dashboard's title and are the only
    // visible signal that the screen edges are navigation, so the carve-out does not reach
    // them. This assertion exists because these two sites contain no matchable token string
    // and were missed by every reader who looked, including the token owner's enumeration.
    for (const file of tsxFiles(DIR)) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const tag of src.match(/<RailLabel[^>]*>/g) ?? []) {
        expect(tag, `${file}: RailLabel must state its tone, not inherit "faint"`).toContain('tone=');
      }
    }
  });

  it('gives the absent reading a colour AND an accessible name, in exactly one place', () => {
    const chrome = read('src/dashboards/components/widget-chrome.tsx');
    expect(chrome).toContain('text-ivory-2');
    expect(chrome).toContain('sr-only');
    // "—" is announced as "dash", "em dash" or silence depending on the AT's punctuation
    // setting, so the glyph is aria-hidden and the sentence carries the meaning.
    expect(chrome).toMatch(/aria-hidden="true">—</);
    // One implementation, not two: DataTable's null cell delegates here rather than
    // repeating the decision at a different weight, which is how the two drifted apart.
    expect(read('src/dashboards/components/DataTable.tsx')).not.toContain('>—<');
  });

  it('keeps the unpriced caveat one rung below the figure it qualifies (§9.4a)', () => {
    // The sharpest instance in the whole finding: the sentence whose only job is to say the
    // spend figure is a FLOOR, NOT A TOTAL. KpiNumeral's `default` tone is --ivory, so §9.4a
    // puts the caveat at --ivory-2 — one rung, not two. If the numeral's tone ever changes,
    // §9.4b says raise the value, never lower the caveat.
    expect(readFileSync(resolve(process.cwd(), 'src/components/primitives/KpiNumeral.tsx'), 'utf8'))
      .toContain("default: 'text-ivory'");
    const tile = read('src/dashboards/components/KpiTile.tsx');
    expect(tile).toMatch(/<span className="text-ivory-2">\{caveat\}<\/span>/);
    // …while the plain caption stays at the tile's meta weight, matching its own label row.
    expect(tile).toContain('className="text-label text-ink-2"');
  });
});
