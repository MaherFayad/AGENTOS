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
import { provenance } from './lib/provenance.mjs';

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

/**
 * A test is not a component, and `no-theme-branch` is a rule about components.
 *
 * Any test that checks a token's contrast in both themes has to name both themes:
 * it reads tokens.css, slices it at `body.light`, and says `theme === 'dark'`.
 * That is the test doing its job, not a component branching. Flagging it makes the
 * *correct* thing to write fail CI, which teaches people to write the wrong thing
 * or to reach for a whole-file exemption that also silences the hex rule.
 *
 * Nothing is lost by exempting tests here. A real theme branch has to exist in a
 * component before a test can assert it, and the component file is still checked.
 * This started as a hardcoded pair (theme.ts / theme.test.ts); it is the general
 * form of that same intent, prompted by drawer-engineer's drawer-contrast.test.ts.
 *
 * Deliberately narrow: tests remain subject to every other rule, including no-hex.
 */
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

/**
 * Where chrome lives — **everything under `apps/web/src/` that is not named below.**
 *
 * This was an include-list of four directories until 2026-08-18, and
 * `fidelity-qa-reviewer` retired it with an argument that has a date on it: *"an
 * include-list cannot see a directory that does not exist yet."* Both halves were
 * demonstrated on the tree that carried the finding —
 * `apps/web/src/app/(views)/p/[project]/threads/` and
 * `apps/web/src/dashboards/components/ThreadFeed.tsx` were created **during** the
 * review, and `apps/web/src/drawer/` had never been covered at all. The failure mode
 * was never that someone widens the list badly; it is that nobody remembers the list
 * exists, which is the repo's *checkers go blind silently* on a schedule.
 *
 * So the default is now what §1.3 actually states — **chrome** — and a directory
 * earns an exception by being named here with the reason, the way the two `Chip`
 * exemptions read in the banner. Three, and each one is a place where a fill or a
 * border legitimately *is* the datum rather than decorating one.
 *
 * `Chip` is deliberately not in this list. It is data ink and it lives in
 * `primitives/`, and it is exempted as a **file** (§1.3's sanctioned status-chip
 * exemption) so that exempting it cannot silently exempt its neighbours.
 */
const DATA_INK_DIRS = [
  ['apps/web/src/map/', 'node fills, department hues and the copper live-ring ARE the datum (§2.1)'],
  ['apps/web/src/chart/', 'series colour is the series (§2.6)'],
  ['apps/web/src/dashboards/', 'widget internals paint values — bars, deltas, sparkline fills (§2.5)'],

  /**
   * PROVISIONAL — these two were never scanned under the old include-list, and
   * inverting it surfaced **ten** lines in them on 2026-08-18. Read rather than
   * assumed: every one is a `data-status` dot fill (`.dot[data-status='ok'|'error'|
   * 'running'|'awaiting-approval']`) or a copper live-session fill/line. That is
   * sanctioned data ink under §1.3, not a breach — but it is a *file*-shaped judgement
   * in someone else's directory, and the right resolution is a `token-exempt:` line
   * comment on each, written by the owner who knows which fill carries which value.
   *
   * They are here rather than failing the build because turning two concurrent agents'
   * trees red for ten lines that are probably all correct is how a checker gets
   * disabled. They are here rather than *silent* because the whole point of retiring
   * the include-list was that a blind spot must be readable. Both are printed on every
   * run, with the owner and the count.
   *
   * REMOVE THESE TWO LINES once the exemptions land. That is the deliverable, and it
   * is somebody else's; filed to both owners 2026-08-18.
   */
  ['apps/web/src/drawer/', 'PROVISIONAL — 5 lines, all status-dot / autonomy fills. Owner: drawer-engineer. Filed 2026-08-18; delete this entry when they carry token-exempt comments'],
  ['apps/web/src/sessions/', 'PROVISIONAL — 5 lines, all copper live-session fills and lines. Owner: sessions-relay-engineer. Filed 2026-08-18; delete this entry when they carry token-exempt comments'],
];

const isChrome = (f) =>
  f.startsWith('apps/web/src/') && !DATA_INK_DIRS.some(([d]) => f.startsWith(d));

const SKIP_DIRS = new Set(['node_modules', '.next', '.next-build', 'dist', 'build', 'coverage', '.turbo', 'public']);
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
    only: isChrome,
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
    skip: (f) => isTokenSource(f) || f === THEME_TS || f === THEME_TEST || isTest(f),
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

  // What this result is a result ABOUT. See scripts/lib/provenance.mjs — two runs of this
  // exact script once reported 31 and 0 and were mistaken for two disagreeing instruments.
  const prov = provenance(ROOT, 'apps/web');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ provenance: prov, scanned, violations, exemptions }, null, 2));
  } else {
    console.log('\nToken discipline');
    console.log(`  scanned at        ${prov.line}`);
    console.log(`  files scanned     ${scanned}`);
    console.log(`  violations        ${violations.length}`);
    console.log(`  exemptions        ${exemptions.length}`);
    // Rule 1's scope, printed rather than assumed. §8b.1 exists because a "0
    // violations" that never looked is indistinguishable from one that did.
    console.log(`  rule 1 scope      all of apps/web/src/ except ${DATA_INK_DIRS.length} named dirs`);
    for (const [dir, why] of DATA_INK_DIRS) console.log(`  not-chrome  ${dir} — ${why}`);
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
