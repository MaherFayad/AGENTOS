import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * rtl.test.ts — the type-literal and direction guards on styles/rtl.css.
 *
 * check-tokens.mjs fails the build on `font-size:` / `letter-spacing:` literals
 * outside the §1.4 scale. This file pins the same rule on the RTL stylesheet
 * so a later "just this once" cannot land as a token-exempt comment.
 */

// NB: see tokens.test.ts — Vite rewrites `new URL('./x', import.meta.url)` into an
// asset URL, which `fileURLToPath` rejects. Same path, built without the pattern.
const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'rtl.css'), 'utf8');

const TYPE_LITERAL = /\b(font-size|letter-spacing)\s*:\s*([^;!]+)/;
const TYPE_OK = /var\(|inherit|normal|unset|initial|revert|currentColor/;

describe('rtl.css token discipline', () => {
  it('has no font-size or letter-spacing literals', () => {
    const hits: string[] = [];
    for (const line of CSS.split(/\r?\n/)) {
      const stripped = line.replace(/\/\*.*?\*\//g, '');
      const m = stripped.match(TYPE_LITERAL);
      if (m && !TYPE_OK.test(m[2])) hits.push(`${m[1]}: ${m[2].trim()}`);
    }
    expect(hits).toEqual([]);
  });

  it('has no hex', () => {
    expect(CSS.match(/(?<![\w&#])#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it('flattens the four wide-tracking rungs under :lang(ar)', () => {
    expect(CSS).toMatch(/:lang\(ar\)\s*\{[^}]*--track-1:\s*normal/s);
    expect(CSS).toContain('--track-2: normal');
    expect(CSS).toContain('--track-3: normal');
    expect(CSS).toContain('--track-4: normal');
  });

  it('kills synthesised italic under Arabic', () => {
    expect(CSS).toMatch(/font-synthesis:\s*none/);
    expect(CSS).toMatch(/:lang\(ar\)[\s\S]*font-style:\s*normal/);
  });

  it('anchors drawers on logical edges, not left/right', () => {
    expect(CSS).toContain('inset-inline-start');
    expect(CSS).toContain('inset-inline-end');
    expect(CSS).not.toMatch(/\.u-drawer-\w+\s*\{[^}]*\b(left|right)\s*:/s);
  });

  it('keeps charts and numerals as LTR islands', () => {
    expect(CSS).toContain('.u-ltr-island');
    expect(CSS).toContain('.u-nums');
    expect(CSS).toMatch(/\.u-nums[\s\S]*direction:\s*ltr/);
  });
});
