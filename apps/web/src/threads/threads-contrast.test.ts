/**
 * REQ-THR-CONTRAST — `--ink-3` may dim a glyph that repeats structure, and nothing else.
 *
 * `fidelity-qa-reviewer` failed `ThreadView.tsx` for rendering *"still in the mailbox"* —
 * the only thing on a turn's header row that says the turn has **not been read yet** — in
 * `.sep`, the class the decorative `·` beside it uses. `contracts/design-tokens.md` §9.3,
 * `--ink-3` NEVER column: *"any sentence; any caveat; any empty state; anything with no
 * second copy on screen"*, and the same contract measures the token at 3.18–3.83, *"fails
 * AA on every surface, in both themes"*. `deliveredAt` is drawn nowhere else, so it was
 * exactly that case: the least legible text on the row carrying the only state on it.
 *
 * **The distinction this file exists to keep usable.** The fix is not "no `--ink-3` in
 * threads" — the `·` two lines above is `--ink-3` and is correct, because it repeats
 * structure and is `aria-hidden`. Collapsing the two would make §9.3's separator home
 * unusable and the next author would simply stop believing the rule. So the mechanism is
 * the distinction itself: **a resting `--ink-3` class may only be worn by an element that
 * is hidden from the accessibility tree.** An element AT never announces cannot be the
 * only carrier of anything; an element it does announce can be, and must not be faint.
 *
 * `check-tokens.mjs` cannot catch this — `var(--ink-3)` is a legal token reference and
 * `className={s.sep}` is legal JSX. The violation is semantic, so the check has to be.
 * Modelled on `drawer/drawer-contrast.test.ts`, which came from the same finding one
 * milestone earlier.
 *
 * **What this file cannot see** (BRIEF: *"an include-list is a decision to be blind"*):
 * a faint colour arriving as a Tailwind utility (`text-ink-3`) rather than through this
 * stylesheet — `check-tokens` owns that surface; a class set by a `data-` attribute rule
 * rather than at rest; and any file outside `src/threads/`. The `.tsx` list is read from
 * the directory, not typed out, so a new file in this folder is covered the day it lands.
 *
 * Owner: sessions-relay-engineer
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the Vitest root (`apps/web`), not `import.meta.url`: under jsdom the module
// URL is not a `file:` URL and `fileURLToPath` throws. Same reason as drawer-contrast.
const DIR = 'src/threads';
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const CSS = read(`${DIR}/threads.module.css`);
const TOKENS = read('src/styles/tokens.css');

/**
 * Every class in `threads.module.css` still allowed a resting `color: var(--ink-3)`, each
 * with the reason it is not required reading. Adding a key is deliberately annoying: the
 * reason has to survive §9.2's delete-the-text test, and the assertion below fails on an
 * unlisted class *and* on a listed one that no longer exists, so this list cannot rot into
 * a blanket permission.
 */
const INK3_ALLOWLIST: Record<string, string> = {
  '.sep':
    'The `·` between an author and a kind. §9.3 names decorative separator glyphs as this ' +
    "token's home, and it is `aria-hidden` at its only call site, so it carries nothing " +
    'a reader could lose. It sits between two things that are themselves legible.',
  '.input::placeholder':
    '§9.3 names `::placeholder` explicitly. The composer\'s field has a real <label> and ' +
    'the placeholder is an example of the address grammar, never the only copy of it — ' +
    'the hint under the field states the grammar in words.',
  '.send:disabled':
    'A literally `disabled` control, which is the other name in §9.3\'s "use it for" ' +
    'column. WCAG 1.4.3 exempts inactive components, and the reason the button is ' +
    'disabled is stated in the hint beside it rather than by its colour.',
};

/** Strip comments, then split into `selector { declarations }` pairs. */
function rules(css: string): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
}

const colorIs = (body: string, token: string) =>
  new RegExp(`(^|[;\\s])color:\\s*var\\(${token}\\)`).test(body);

const ink3Selectors = () =>
  rules(CSS)
    .filter((r) => colorIs(r.body, '--ink-3'))
    .map((r) => r.selector)
    .sort();

/**
 * The classes a component can *wear at rest* — bare `.name`, no pseudo-class and no
 * pseudo-element. `.input::placeholder` and `.send:disabled` are excluded here on purpose:
 * they colour a state the platform owns, not the element's resting text.
 */
const restingInk3Classes = () =>
  ink3Selectors()
    .filter((sel) => /^\.[A-Za-z][\w-]*$/.test(sel))
    .map((sel) => sel.slice(1));

interface Site {
  file: string;
  cls: string;
  tag: string;
}

/**
 * Every JSX element in `src/threads/**.tsx` wearing one of those classes, with the opening
 * tag it was found in.
 *
 * The extraction is deliberately loud rather than lenient: if the enclosing tag cannot be
 * recovered, the test **fails**. A scanner that silently skips what it cannot parse is the
 * defect this repo has now shipped six times.
 */
function ink3Sites(): Site[] {
  const classes = restingInk3Classes();
  const files = readdirSync(resolve(process.cwd(), DIR)).filter((f) => f.endsWith('.tsx'));
  const sites: Site[] = [];

  for (const file of files) {
    const src = read(`${DIR}/${file}`);
    for (const cls of classes) {
      const ref = new RegExp(`\\bs\\.${cls}\\b`, 'g');
      for (const m of src.matchAll(ref)) {
        const open = src.lastIndexOf('<', m.index);
        const close = src.indexOf('>', m.index);
        const tag = open === -1 || close === -1 ? '' : src.slice(open, close + 1);
        expect(
          /^<[A-Za-z]/.test(tag),
          `could not recover the opening tag around s.${cls} in ${file} at index ${m.index}. ` +
            'This scanner has gone blind rather than found nothing — fix the extraction, ' +
            'do not delete the assertion.',
        ).toBe(true);
        sites.push({ file, cls, tag });
      }
    }
  }
  return sites;
}

/** `#rrggbb`, or an `rgba(255,255,255,a)` overlay composited onto `over`. */
function surface(value: string, over: [number, number, number]): [number, number, number] {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (!rgba) throw new Error(`cannot read ${value} as a colour`);
  const a = Number(rgba[4]);
  return [1, 2, 3].map((i) => Math.round(a * Number(rgba[i]) + (1 - a) * over[i - 1])) as [
    number,
    number,
    number,
  ];
}

// The two chrome blocks in file order — dark `:root` first, light second. Indexed rather
// than branched: `check-tokens.mjs` flags `theme === '…'` under `no-theme-branch` (§1.2).
const BLOCK_SELECTORS = [':root', 'body.light'] as const;
const BLOCK_OF: Record<'dark' | 'light', number> = { dark: 0, light: 1 };

function tokenValue(name: string, theme: 'dark' | 'light'): string {
  const start = TOKENS.indexOf(BLOCK_SELECTORS[BLOCK_OF[theme]]);
  const end = TOKENS.indexOf('}', start);
  const found = TOKENS.slice(start, end).match(
    new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6}|rgba\\([^)]*\\))`),
  );
  if (!found) throw new Error(`token ${name} not found in the ${theme} block of tokens.css`);
  return found[1];
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const lum = (rgb: [number, number, number]) => {
    const [r, g, bl] = rgb
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The surface a turn's header row actually sits on: `.message` is `background: var(--card)`. */
function messageCard(theme: 'dark' | 'light'): [number, number, number] {
  const bg = surface(tokenValue('--bg', theme), [0, 0, 0]);
  return surface(tokenValue('--card', theme), bg);
}

describe('threads token contrast', () => {
  it('draws the unread-turn fact in the row colour, not the separator colour', () => {
    const src = read(`${DIR}/ThreadView.tsx`);
    const at = src.indexOf("threads.one.inMailbox");
    expect(at, 'threads.one.inMailbox is no longer rendered by ThreadView').toBeGreaterThan(-1);

    const open = src.lastIndexOf('<', at);
    const tag = src.slice(open, src.indexOf('>', open) + 1);
    expect(/^<span/.test(tag), `expected a <span>, found ${tag}`).toBe(true);
    for (const cls of restingInk3Classes()) {
      expect(
        tag,
        `"still in the mailbox" is the only thing on the row that says a turn is unread ` +
          `and it must not wear .${cls} (design-tokens §9.3, --ink-3 NEVER column)`,
      ).not.toContain(`s.${cls}`);
    }
    expect(tag, 'nothing should reintroduce a faint colour by another route').not.toMatch(
      /ink-3/,
    );
  });

  it('leaves it inheriting --ink-2 from .messageHead — the fix depends on that', () => {
    // Without this, the smallest fix above is undone by a one-line edit elsewhere and
    // the span goes faint again with nothing red.
    const head = rules(CSS).find((r) => r.selector === '.messageHead');
    expect(head, '.messageHead should exist in threads.module.css').toBeDefined();
    expect(colorIs(head!.body, '--ink-2')).toBe(true);
  });

  it('lets only aria-hidden elements wear a resting --ink-3 class', () => {
    const sites = ink3Sites();
    // Non-vacuity: this scanner must be looking at something. `.sep` on the decorative `·`
    // is the site that has to survive, so its absence means the scan broke, not that the
    // code got cleaner.
    expect(
      sites.length,
      'no --ink-3 call site found at all — the scanner is blind, not the code clean',
    ).toBeGreaterThan(0);
    expect(sites.some((site) => site.file === 'ThreadView.tsx' && site.cls === 'sep')).toBe(true);

    for (const site of sites) {
      expect(
        site.tag,
        `${site.file}: .${site.cls} is --ink-3, which §9.3 allows only for decoration. ` +
          `This element is announced to a screen reader, so it can be the only copy of ` +
          `something. Either it is decoration — mark it aria-hidden — or it is content ` +
          `and the class comes off.\n  ${site.tag}`,
      ).toContain('aria-hidden');
    }
  });

  it('measures why: --ink-2 clears AA on a message card in both themes and --ink-3 does not', () => {
    for (const theme of ['dark', 'light'] as const) {
      const card = messageCard(theme);
      const ink2 = contrast(surface(tokenValue('--ink-2', theme), card), card);
      const ink3 = contrast(surface(tokenValue('--ink-3', theme), card), card);
      expect(ink2, `--ink-2 on a ${theme} message card`).toBeGreaterThanOrEqual(4.5);
      expect(ink3, `--ink-3 on a ${theme} message card`).toBeLessThan(4.5);
    }
    // Pinned, so a token edit that quietly darkens --ink-2 fails here rather than in
    // someone's eyes. Measured 2026-08-18 off tokens.css, not quoted from the contract.
    expect(contrast(surface(tokenValue('--ink-2', 'dark'), messageCard('dark')), messageCard('dark'))).toBeCloseTo(4.82, 1);
    expect(contrast(surface(tokenValue('--ink-2', 'light'), messageCard('light')), messageCard('light'))).toBeCloseTo(5.05, 1);
  });

  it('keeps a written reason for every --ink-3 text colour in the stylesheet', () => {
    expect(ink3Selectors()).toEqual(Object.keys(INK3_ALLOWLIST).sort());
    for (const reason of Object.values(INK3_ALLOWLIST)) expect(reason.length).toBeGreaterThan(40);
  });
});
