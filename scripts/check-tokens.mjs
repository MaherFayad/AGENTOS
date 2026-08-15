#!/usr/bin/env node
/**
 * check-tokens.mjs
 *
 * Part I is a set of values, and a set of values only stays true if something
 * checks it. This is that something.
 *
 * The design system survives contact with thirteen parallel agents for exactly
 * as long as these five rules hold:
 *
 *   1. Color literals live in ONE file. `apps/web/src/styles/tokens.css` is the
 *      only place a hex, an rgb()/rgba()/hsl(), or a named CSS color may appear.
 *   2. Chrome is monochrome; color is data ink (§1.3). A `--ink-*` data token on
 *      a background or a border inside a chrome component is the violation the
 *      whole rule exists to prevent.
 *   3. Type comes from the named scale. No `text-[13px]`, no `fontSize:`,
 *      no `letter-spacing:` outside tailwind.config.ts — under-tracked caps are
 *      the most common fidelity miss in this system.
 *   4. Durations come from §1.6, typed once, in
 *      `apps/web/src/components/primitives/motion.ts`.
 *   5. No component branches on theme. The tokens branch; components do not.
 *
 * Escape hatch, on purpose:
 *   /* token-exempt: reason *​/         → exempts that line (or the next one)
 *   /* token-exempt-file: reason *​/    → exempts the whole file (first 30 lines)
 * Every exemption is printed on every run. An exemption you have to read out
 * loud in CI is a decision; a silent one is rot.
 *
 * Usage: node scripts/check-tokens.mjs [--json]
 * Owner: design-system-guardian
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOT = join(ROOT, 'apps', 'web');

/**
 * Files that are allowed to be the exception, because they ARE the source —
 * together with the test that asserts each one's contents. A test that pins
 * `--bg: #111114` has to be able to write `#111114`.
 */
const TOKENS_CSS = 'apps/web/src/styles/tokens.css';
const TOKENS_TEST = 'apps/web/src/styles/tokens.test.ts';
const MOTION_TS = 'apps/web/src/components/primitives/motion.ts';
const MOTION_TEST = 'apps/web/src/components/primitives/motion.test.ts';
const THEME_TS = 'apps/web/src/components/primitives/theme.ts';
const THEME_TEST = 'apps/web/src/components/primitives/theme.test.ts';
const TW_CONFIG = 'apps/web/tailwind.config.ts';

/** The token file and its own test. Neither can obey the rules they define. */
const isTokenSource = (f) => f === TOKENS_CSS || f === TOKENS_TEST;

/** Where chrome lives. Data ink on a fill or a border here is a failure (§1.3). */
const CHROME_DIRS = [
  'apps/web/src/app/',
  'apps/web/src/components/primitives/',
  'apps/web/src/components/shell/',
  'apps/web/src/components/chrome/',
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', 'public']);
const EXTS = /\.(tsx?|jsx?|mjs|cjs|css|scss)$/;

const TAILWIND_PALETTE =
  'white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|' +
  'teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_PROPS =
  'bg|text|border|fill|stroke|ring|shadow|from|via|to|decoration|outline|accent|caret|divide|placeholder';
const CSS_NAMED =
  'white|black|red|blue|green|yellow|orange|purple|pink|brown|grey|gray|silver|gold|teal|navy|' +
  'olive|lime|aqua|fuchsia|maroon|coral|salmon|khaki|ivory|beige|crimson|indigo|violet|turquoise';
const DATA_INK = 'copper|teal|coral|lavender|amber|blue';

/* --------------------------------------------------------------------------
 * Rules. Each returns a message when the (comment-stripped) line offends.
 * ----------------------------------------------------------------------- */
const RULES = [
  {
    id: 'no-hex',
    skip: isTokenSource,
    test: (code) => {
      for (const m of code.matchAll(/(?<![\w&#])#([0-9a-fA-F]{3,8})(?![\w-])/g)) {
        if ([3, 4, 6, 8].includes(m[1].length)) return `hex literal "${m[0]}"`;
      }
      return null;
    },
    hint: `move it into ${TOKENS_CSS} and reference the Tailwind token utility`,
  },
  {
    id: 'no-rgb',
    skip: isTokenSource,
    test: (code) => {
      const m = code.match(/\b(rgba?|hsla?|color-mix|oklch|lab)\s*\(/);
      return m ? `color function "${m[1]}("` : null;
    },
    hint: `derive it as a token in ${TOKENS_CSS} instead`,
  },
  {
    id: 'no-named-color',
    skip: isTokenSource,
    test: (code, file) => {
      const util = code.match(new RegExp(`\\b(?:${COLOR_PROPS})-(?:${TAILWIND_PALETTE})(?:-\\d{2,3})?\\b`));
      if (util) return `Tailwind default palette utility "${util[0]}"`;
      if (/\.s?css$/.test(file)) {
        const css = code.match(new RegExp(`(?:color|background|border|fill|stroke)[^:;]*:\\s*(${CSS_NAMED})\\b`, 'i'));
        if (css) return `named CSS color "${css[1]}"`;
      }
      return null;
    },
    hint: 'chrome is ivory/ink/line; data is an --ink-* token',
  },
  {
    id: 'no-type-literal',
    skip: (f) => isTokenSource(f) || f === TW_CONFIG,
    test: (code, file) => {
      const arb = code.match(/\b(?:text|tracking|leading)-\[[^\]]+\]/);
      if (arb) return `arbitrary type value "${arb[0]}"`;
      const js = code.match(/\b(fontSize|letterSpacing|lineHeight|fontWeight)\s*:/);
      if (js && !/\.s?css$/.test(file)) return `inline type style "${js[1]}"`;
      // In CSS the declaration itself is fine — the literal is not. A rule that
      // reads `letter-spacing: var(--track-label)` is doing exactly the right
      // thing and must not be nagged at.
      const css = code.match(/\b(font-size|letter-spacing)\s*:\s*([^;!]+)/);
      if (css && !/var\(|inherit|normal|unset|initial|revert|currentColor/.test(css[2])) {
        return `type literal "${css[1]}: ${css[2].trim()}"`;
      }
      return null;
    },
    hint: 'use the §1.4 scale: text-display / h1-accent / h2 / body / small / label / kpi + tracking-wider-1…4',
  },
  {
    id: 'no-duration-literal',
    skip: (f) => isTokenSource(f) || f === MOTION_TS || f === MOTION_TEST || f === TW_CONFIG,
    test: (code) => {
      const arb = code.match(/\b(?:duration|delay|ease)-\[[^\]]+\]/);
      if (arb) return `arbitrary motion value "${arb[0]}"`;
      const ms = code.match(/\b\d+(?:\.\d+)?m?s\b(?!-)/);
      if (ms && /transition|animation|duration|delay/i.test(code)) return `hardcoded duration "${ms[0]}"`;
      const obj = code.match(/\bduration\s*:\s*[\d.]+/);
      if (obj) return `hardcoded duration "${obj[0]}"`;
      const bez = code.match(/cubic-bezier\s*\(/);
      if (bez) return 'inline cubic-bezier';
      return null;
    },
    hint: `import DURATION / EASE / reveal / drawer / zoom from ${MOTION_TS}, or use duration-* / ease-* utilities`,
  },
  {
    id: 'chrome-is-monochrome',
    only: (f) => CHROME_DIRS.some((d) => f.startsWith(d)),
    test: (code) => {
      const util = code.match(new RegExp(`\\b(?:bg|border|ring|divide|outline|from|via|to)-ink-(?:${DATA_INK})`));
      if (util) return `data ink on chrome: "${util[0]}"`;
      const css = code.match(new RegExp(`(?:background|border)[^;]*var\\(--ink-(?:${DATA_INK})`));
      if (css) return `data ink on a chrome ${css[0].split(/[^a-z-]/)[0]}`;
      return null;
    },
    hint: '§1.3 — chrome is monochrome. Color must communicate a status, a delta or a series. Text-only data ink (text-ink-teal) is fine; fills and borders are not.',
  },
  {
    id: 'no-theme-branch',
    skip: (f) => isTokenSource(f) || f === THEME_TS || f === THEME_TEST,
    test: (code) => {
      const variant = code.match(/\b(?:dark|light):[a-z][a-z0-9-]*/);
      if (variant) return `theme variant "${variant[0]}"`;
      const branch = code.match(/\b(?:theme|mode|isLight|isDark)\b[^\n]{0,20}===\s*['"](?:light|dark)['"]/);
      if (branch) return 'a component branching on theme';
      if (/body\.light/.test(code)) return 'body.light selector outside the token file';
      return null;
    },
    hint: '§1.2 — the tokens branch, components never do. Missing behaviour means a missing token: file a decision-request.',
  },
];

/* --------------------------------------------------------------------------
 * Scanning
 * ----------------------------------------------------------------------- */
const violations = [];
const exemptions = [];
let scanned = 0;

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.storybook') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(full, out);
    } else if (EXTS.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Strip comments so prose about a hex is not mistaken for a hex. */
function stripComments(lines) {
  let inBlock = false;
  return lines.map((raw) => {
    let out = '';
    let i = 0;
    while (i < raw.length) {
      if (inBlock) {
        const end = raw.indexOf('*/', i);
        if (end === -1) return out;
        inBlock = false;
        i = end + 2;
        continue;
      }
      const block = raw.indexOf('/*', i);
      const line = raw.indexOf('//', i);
      if (line !== -1 && (block === -1 || line < block)) return out + raw.slice(i, line);
      if (block !== -1) {
        out += raw.slice(i, block);
        inBlock = true;
        i = block + 2;
        continue;
      }
      return out + raw.slice(i);
    }
    return out;
  });
}

const EXEMPT_LINE = /token-exempt:\s*(.+?)(?:\*\/|-->|$)/m;
const EXEMPT_FILE = /token-exempt-file:\s*(.+?)(?:\*\/|-->|$)/m;

async function check(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = await readFile(file, 'utf8');
  const raw = text.split(/\r?\n/);
  const code = stripComments(raw);
  scanned++;

  const head = raw.slice(0, 30).join('\n');
  const fileExempt = head.match(EXEMPT_FILE);
  if (fileExempt) {
    exemptions.push({ file: rel, line: 0, scope: 'file', reason: fileExempt[1].trim() });
    return;
  }

  for (let i = 0; i < code.length; i++) {
    const line = code[i];
    if (!line.trim()) continue;

    const near = `${raw[i] ?? ''}\n${raw[i - 1] ?? ''}`;
    const exempt = near.match(EXEMPT_LINE);

    for (const rule of RULES) {
      if (rule.skip?.(rel)) continue;
      if (rule.only && !rule.only(rel)) continue;
      const found = rule.test(line, rel);
      if (!found) continue;
      if (exempt) {
        exemptions.push({ file: rel, line: i + 1, scope: rule.id, reason: exempt[1].trim() });
        continue;
      }
      violations.push({ file: rel, line: i + 1, rule: rule.id, found, hint: rule.hint, src: raw[i].trim() });
    }
  }
}

async function main() {
  const files = await walk(SCAN_ROOT);

  if (files.length === 0) {
    console.log('\nToken discipline');
    console.log('  apps/web has no source files yet — nothing to check.\n');
    process.exit(0);
  }

  const hasTokens = files.some((f) => relative(ROOT, f).split(sep).join('/') === TOKENS_CSS);
  if (!hasTokens) violations.push({ file: TOKENS_CSS, line: 0, rule: 'tokens-missing', found: 'the token file does not exist', hint: 'Part I has no home', src: '' });

  for (const f of files) await check(f);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ scanned, violations, exemptions }, null, 2));
  } else {
    console.log('\nToken discipline');
    console.log(`  files scanned     ${scanned}`);
    console.log(`  violations        ${violations.length}`);
    console.log(`  exemptions        ${exemptions.length}`);
    for (const e of exemptions) {
      const where = e.scope === 'file' ? `${e.file} (whole file)` : `${e.file}:${e.line} [${e.scope}]`;
      console.log(`  exempt  ${where} — ${e.reason}`);
    }
    for (const v of violations) {
      console.log(`  FAIL  ${v.file}:${v.line}  [${v.rule}] ${v.found}`);
      if (v.src) console.log(`          ${v.src.slice(0, 100)}`);
      console.log(`          → ${v.hint}`);
    }
    console.log('');
  }

  process.exit(violations.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
