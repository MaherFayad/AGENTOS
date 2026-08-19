/**
 * REQ-DRW-CONTRAST — no required reading in the disabled colour, and it stays that way.
 *
 * `--ink-3` is glossed in `comms/contracts/design-tokens.md` as *"faint text / disabled"*
 * and measures **3.57:1** on `--bg` in dark, **3.00:1** in light — below WCAG AA for the
 * 11-13px sizes this drawer uses. `cc-fidelity-check` §5: never put required information
 * in it.
 *
 * `fidelity-qa-reviewer` found `.empty` — the honest empty state, the sentence BOARD rule 9
 * exists to put on screen *instead of* a plausible fake number — painted in exactly that
 * token. A one-line CSS edit fixes an instance; this file is what stops the next one, by
 * making every remaining `--ink-3` a decision someone had to type a reason for.
 *
 * `check-tokens.mjs` cannot catch this: `var(--ink-3)` is a perfectly legal token
 * reference. The violation is semantic, so the check has to be too.
 *
 * Owner: drawer-engineer
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the Vitest root (`apps/web`) rather than `import.meta.url`: under jsdom the
// module URL is not a `file:` URL and `fileURLToPath` throws.
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const CSS = read('src/drawer/drawer.module.css');
const TOKENS = read('src/styles/tokens.css');

/**
 * Every class still allowed to set `color: var(--ink-3)`, each with the reason it is not
 * required reading. Adding a key here is deliberately annoying: you have to write why, and
 * the reason has to survive the delete-the-text test in tokens contract §9.2.
 *
 * Two entries were in this list and are not any more. `.ladderText` and `.runMetaAbsent`
 * were corrected to `--ink-2` by the token owner (`design-system-guardian`,
 * `comms/inbox/drawer-engineer/20260816-2112-design-system-guardian-ink3-ruling-two-corrections.md`).
 * Both of my reasons were wrong in the same way — they argued from *relative* hierarchy
 * ("dimmer than the numbers", "the active rung is legible") when §9.2 asks an absolute
 * question about the text in front of you.
 */
const INK3_COLOR_ALLOWLIST: Record<string, string> = {
  '.ladderLabel':
    '§2.3.9 prescribes it in words — "active row ivory, others --ink-3" — and §9.3 has a ' +
    'matching home: a label redundant with its own position. The triad is fixed and ordered. ' +
    'Ratified by design-system-guardian 20260816-2112.',
  '.control::placeholder':
    'A placeholder is never the only carrier — every INPUTS field renders its frontmatter ' +
    '`label` as a real <label>.',
  '.toggle':
    'The §2.6.5 autonomy segments are literally `disabled` buttons (ChartSections.tsx:39) ' +
    'and this is literally the disabled token. WCAG 1.4.3 exempts inactive components; ' +
    'the selected segment overrides to --copper-ink on --copper.',
  '.workCell + .workCell::before':
    'Generated punctuation — the middot between roster cells. It carries no information and ' +
    'survives §9.2’s delete-the-text test outright: remove it and a reader loses spacing, ' +
    'not a fact. Every cell it separates is its own element with its own text, and the one ' +
    'thing on that line that IS required reading — the recorded/unknown qualifier — is a ' +
    'sentence in --ink-2 below it, never this glyph. M17.',
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

/**
 * The two chrome blocks of `tokens.css`, in file order: dark `:root` first, light second.
 *
 * Indexed rather than branched on purpose. `check-tokens.mjs` flags `theme === '…'` under
 * `no-theme-branch` (§1.2 — the tokens branch, components never do), and an earlier draft of
 * this file tripped it three times. The rule is right and the file did not need an exemption:
 * a lookup table expresses the same thing without a theme comparison, and nothing here
 * renders — it reads the stylesheet and asserts BOTH blocks clear AA, which is the guarantee
 * the rule exists to protect. `validate:tokens` is 0 violations / 2 exemptions, unchanged.
 */
const BLOCK_SELECTORS = [':root', 'body.light'] as const;
const BLOCK_OF: Record<'dark' | 'light', number> = { dark: 0, light: 1 };

function tokenHex(name: string, theme: 'dark' | 'light'): string {
  const i = BLOCK_OF[theme];
  const start = TOKENS.indexOf(BLOCK_SELECTORS[i]);
  const end = TOKENS.indexOf('}', start);
  const found = TOKENS.slice(start, end).match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`token ${name} not found in the ${theme} block of tokens.css`);
  return found[1];
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = parts.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('drawer token contrast', () => {
  it('reproduces the measurement the FAIL was written against', () => {
    // Not a tautology: it pins the numbers so a future token edit that quietly darkens
    // --ink-2 or lightens --bg fails here rather than in someone's screen reader.
    expect(contrast(tokenHex('--ink-3', 'dark'), tokenHex('--bg', 'dark'))).toBeCloseTo(3.57, 1);
    expect(contrast(tokenHex('--ink-3', 'light'), tokenHex('--bg', 'light'))).toBeCloseTo(3.0, 1);
  });

  /**
   * Read this assertion narrowly. It covers `--ink-2` on **`--bg`** only.
   *
   * Tokens contract §9.5: light `--ink-2` (#6E6E76) is 4.28:1 on `--bg-2` and 4.25:1 on
   * `--card-2` — about 5% short of AA — and the fix is an ADR on a value transcribed
   * verbatim from spec §1.2, which a bug fix may not smuggle in. So a green result here does
   * **not** mean `--ink-2` is safe on every surface. The rule that keeps this drawer clear of
   * §9.5 is behavioural, not measured: required prose must not sit on `--bg-2` / `--card-2`,
   * and nothing in `drawer/**` puts an empty state inside a `Card interactive`.
   */
  it('keeps --ink-2 at WCAG AA on --bg in BOTH themes — the surface the drawer prose sits on', () => {
    for (const theme of ['dark', 'light'] as const) {
      expect(contrast(tokenHex('--ink-2', theme), tokenHex('--bg', theme))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('paints the honest empty state as content, not as disabled text', () => {
    // `.ladderText` is in this loop because the token owner corrected it here; keeping it in
    // the list is what stops the next edit walking it back to --ink-3.
    for (const cls of ['.empty', '.consoleTrimmed', '.sectionNote', '.ladderText', '.runMetaAbsent']) {
      const rule = rules(CSS).find((r) => r.selector === cls);
      expect(rule, `${cls} should exist in drawer.module.css`).toBeDefined();
      expect(rule!.body, `${cls} must not use the disabled token`).not.toContain('var(--ink-3)');
      expect(rule!.body).toContain('var(--ink-2)');
    }
  });

  it('lets the active ladder rung be read — §2.3.9 says the active row is ivory', () => {
    const active = rules(CSS).find((r) => r.selector === ".ladderRow[data-active='true'] .ladderText");
    expect(active?.body).toContain('var(--ivory-2)');
    expect(contrast(tokenHex('--ivory-2', 'dark'), tokenHex('--bg', 'dark'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenHex('--ivory-2', 'light'), tokenHex('--bg', 'light'))).toBeGreaterThanOrEqual(4.5);
  });

  it('has a written reason for every remaining --ink-3 text colour', () => {
    const users = rules(CSS)
      .filter((r) => /(^|[;\s])color:\s*var\(--ink-3\)/.test(r.body))
      .map((r) => r.selector)
      .sort();

    expect(users).toEqual(Object.keys(INK3_COLOR_ALLOWLIST).sort());
    for (const reason of Object.values(INK3_COLOR_ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(40);
    }
  });
});
