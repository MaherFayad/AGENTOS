#!/usr/bin/env node
/**
 * check-rtl.mjs
 *
 * Retrofitting RTL is the expensive path. This is the cheap one: it runs while
 * the components are being written, and it fails on the three mistakes that
 * are almost free to avoid now and cost a rewrite in M8.
 *
 *   1. PHYSICAL CSS PROPERTIES where a logical one exists. `margin-left` is a
 *      decision that the interface reads left-to-right. `margin-inline-start`
 *      is the same pixel with none of the decision.
 *
 *   2. LETTER-SPACING ON TEXT THAT CAN HOLD ARABIC. Arabic is a connected
 *      script; tracking severs the joins and the word stops being a word
 *      (§1.4). The design's wide-tracked caps are Latin-only styling.
 *
 *   3. USER-FACING STRINGS OUTSIDE THE i18n LAYER. A string typed into a
 *      component is a string nobody can translate, and finding them later
 *      means reading every JSX file by hand.
 *
 * EXEMPTIONS. Some of these are genuinely right: the map canvas has no reading
 * direction (§2.1), chart axes are LTR islands (§2.5), program output is LTR
 * (§3.1). Mark them:
 *
 *      // rtl-exempt: chart axis — a time axis does not reverse (§2.6)
 *
 * The marker covers its own line and every line up to the next blank line, and
 * every exemption is PRINTED on every run. An exemption you cannot see is
 * indistinguishable from a bug you have not noticed yet.
 *
 * Usage: node scripts/check-rtl.mjs [--json] [--quiet]
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, §2.2, §2.3, §2.6.5, Part VI row 8.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = join(ROOT, 'apps', 'web', 'src');
const I18N_DIR = join(SCAN_DIR, 'i18n');

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '__snapshots__']);
const CODE_EXT = /\.(tsx|ts|jsx|js|mjs)$/;
const CSS_EXT = /\.css$/;

/* ---------------------------------------------------------------------------
 * 1. Physical CSS properties → the logical property that replaces them.
 * ------------------------------------------------------------------------ */
const CSS_PHYSICAL = [
  [/(?<![-\w])margin-left\s*:/gi, 'margin-inline-start'],
  [/(?<![-\w])margin-right\s*:/gi, 'margin-inline-end'],
  [/(?<![-\w])padding-left\s*:/gi, 'padding-inline-start'],
  [/(?<![-\w])padding-right\s*:/gi, 'padding-inline-end'],
  [/(?<![-\w])border-left(?:-(?:width|style|color))?\s*:/gi, 'border-inline-start'],
  [/(?<![-\w])border-right(?:-(?:width|style|color))?\s*:/gi, 'border-inline-end'],
  [/(?<![-\w])border-top-left-radius\s*:/gi, 'border-start-start-radius'],
  [/(?<![-\w])border-top-right-radius\s*:/gi, 'border-start-end-radius'],
  [/(?<![-\w])border-bottom-left-radius\s*:/gi, 'border-end-start-radius'],
  [/(?<![-\w])border-bottom-right-radius\s*:/gi, 'border-end-end-radius'],
  [/(?<![-\w])left\s*:/gi, 'inset-inline-start'],
  [/(?<![-\w])right\s*:/gi, 'inset-inline-end'],
  [/(?<![-\w])scroll-(?:margin|padding)-left\s*:/gi, 'scroll-*-inline-start'],
  [/(?<![-\w])scroll-(?:margin|padding)-right\s*:/gi, 'scroll-*-inline-end'],
  [/(?<![-\w])text-align\s*:\s*left\b/gi, 'text-align: start'],
  [/(?<![-\w])text-align\s*:\s*right\b/gi, 'text-align: end'],
  [/(?<![-\w])float\s*:\s*left\b/gi, 'float: inline-start'],
  [/(?<![-\w])float\s*:\s*right\b/gi, 'float: inline-end'],
  [/(?<![-\w])clear\s*:\s*left\b/gi, 'clear: inline-start'],
  [/(?<![-\w])clear\s*:\s*right\b/gi, 'clear: inline-end'],
  // Gradients and masks ignore `dir` entirely — rtl.css publishes
  // var(--to-inline-end) / var(--to-inline-start) for exactly this.
  [/\bto\s+(?:left|right)\b/gi, 'var(--to-inline-end) / var(--to-inline-start)'],
];

/** Inline style objects in TSX. Unambiguously CSS, so no context needed. */
const JS_PHYSICAL = [
  [/(?<![\w$])marginLeft\s*:/g, 'marginInlineStart'],
  [/(?<![\w$])marginRight\s*:/g, 'marginInlineEnd'],
  [/(?<![\w$])paddingLeft\s*:/g, 'paddingInlineStart'],
  [/(?<![\w$])paddingRight\s*:/g, 'paddingInlineEnd'],
  [/(?<![\w$])borderLeft(?:Width|Style|Color)?\s*:/g, 'borderInlineStart'],
  [/(?<![\w$])borderRight(?:Width|Style|Color)?\s*:/g, 'borderInlineEnd'],
  [/(?<![\w$])textAlign\s*:\s*['"](?:left|right)['"]/g, "textAlign: 'start' | 'end'"],
  [/(?<![\w$])borderTopLeftRadius\s*:/g, 'borderStartStartRadius'],
  [/(?<![\w$])borderTopRightRadius\s*:/g, 'borderStartEndRadius'],
  [/(?<![\w$])borderBottomLeftRadius\s*:/g, 'borderEndStartRadius'],
  [/(?<![\w$])borderBottomRightRadius\s*:/g, 'borderEndEndRadius'],
];

/**
 * Tailwind physical utilities → their logical twin.
 *
 * `border-l` is matched with a lookahead that refuses a following letter, so
 * `border-line` (this repo's border-color token class) is not a false hit.
 */
const TW_PHYSICAL = [
  [/(?<![\w-])-?ml-(?=[\w[.])/g, 'ms-*'],
  [/(?<![\w-])-?mr-(?=[\w[.])/g, 'me-*'],
  [/(?<![\w-])-?pl-(?=[\w[.])/g, 'ps-*'],
  [/(?<![\w-])-?pr-(?=[\w[.])/g, 'pe-*'],
  [/(?<![\w-])-?left-(?=[\w[.])/g, 'start-*'],
  [/(?<![\w-])-?right-(?=[\w[.])/g, 'end-*'],
  [/(?<![\w-])text-(?:left|right)(?![\w-])/g, 'text-start / text-end'],
  [/(?<![\w-])float-(?:left|right)(?![\w-])/g, 'float-start / float-end'],
  [/(?<![\w-])border-[lr](?![a-z])/g, 'border-s-* / border-e-*'],
  [/(?<![\w-])rounded-(?:tl|tr|bl|br|l|r)(?![a-z])/g, 'rounded-s* / rounded-e*'],
  [/(?<![\w-])origin-(?:left|right)(?![\w-])/g, 'origin-start / origin-end'],
  [/(?<![\w-])scroll-m[lr]-(?=[\w[.])/g, 'scroll-ms-* / scroll-me-*'],
  [/(?<![\w-])scroll-p[lr]-(?=[\w[.])/g, 'scroll-ps-* / scroll-pe-*'],
];

/* ---------------------------------------------------------------------------
 * 2. Tracking on translatable text.
 *
 * Only WIDE tracking is reported, and the distinction is not pedantry:
 *
 *   +0.25em…+0.45em on a label  → the emphasis IS the tracking. Under :lang(ar)
 *     rtl.css resets it to normal, and the label loses the thing that made it a
 *     label. It needs the compensation the .u-label/.u-eyebrow/.u-tab roles
 *     apply: size, weight and word-spacing. So: report it.
 *
 *   −0.028em on an 86px display headline → the emphasis is the SIZE. Arabic
 *     wants the reset and nothing else; tightening Arabic display type is
 *     wrong anyway. So: silent, the reset in rtl.css already handles it.
 * ------------------------------------------------------------------------ */
const TRACKING = [
  [/(?<![-\w])letter-spacing\s*:\s*(?!-|normal|inherit|initial|unset|revert)/gi, 'css'],
  [/(?<![\w$])letterSpacing\s*:\s*['"]?(?!-|normal)/g, 'js'],
  [/(?<![\w-])tracking-(?:wide(?:r|st)?(?:-\d)?|\[\.?\d[^\]]*\])/g, 'tailwind'],
];

const TRACKING_FIX =
  'Arabic is a connected script — tracking severs the joins (§1.4). rtl.css already resets ' +
  'it under :lang(ar), so the label silently loses its emphasis. Add the role class ' +
  '(.u-label / .u-eyebrow / .u-tab) so Arabic gets size + weight + word-spacing instead, ' +
  'or scope the rule to :lang(en) if the text is genuinely Latin-only.';

/** A rule already scoped to Latin is fine — that is the sanctioned pattern. */
const LATIN_SCOPED = /:lang\(en\)|\.u-latin\b|\[lang=['"]?en/i;

/* ---------------------------------------------------------------------------
 * 3. Hardcoded user-facing copy.
 * ------------------------------------------------------------------------ */
const USER_FACING_PROPS =
  /\b(placeholder|title|aria-label|aria-description|aria-placeholder|aria-roledescription|alt|label|heading|caption|emptyMessage|errorMessage)\s*=\s*["']([^"']{2,})["']/g;

/** JSX text nodes: >Some words< with no braces, i.e. not an expression. */
const JSX_TEXT = />([^<>{}\n]{2,})</g;

/** Two consecutive letters in either script — the bar for "this is copy". */
const HAS_WORDS = /[A-Za-z؀-ۿ]{2,}/;

/** Things that look like copy but are not: entities, units, keys, paths. */
const NOT_COPY =
  /^(?:\s|&[a-z]+;|&#\d+;|[·•—–|/\\,.:;!?()[\]{}'"`+*=<>%$#@~^_-]|\d)*$/;

/**
 * `Promise<T>` and `Record<K, V>` also produce a `>…<` sandwich, so the naive
 * JSX text scan reads TypeScript generics as English prose. Punctuation is the
 * tell: prose in this product does not contain `:`, `=`, `(` or `&&`, and a
 * label that does is code.
 */
const LOOKS_LIKE_CODE = /[:;=(){}[\]|&$<>]|=>/;

const EXEMPT_MARK = /rtl-exempt:\s*(.*)$/i;

/* ------------------------------------------------------------------------ */

/**
 * Lines covered by an `rtl-exempt:` marker: the marker's own line, and every
 * line after it until the next blank line. Blank-line-terminated because it is
 * a rule a person can hold in their head — "put the marker in the comment
 * directly above the block, and keep the block together".
 */
function exemptionMap(lines) {
  const covered = new Map(); // line index -> reason
  lines.forEach((line, i) => {
    const m = line.match(EXEMPT_MARK);
    if (!m) return;
    const reason = m[1].replace(/\*\/\s*$/, '').replace(/-->\s*$/, '').trim() || '(no reason given)';
    for (let j = i; j < lines.length; j++) {
      if (j > i && lines[j].trim() === '') break;
      if (!covered.has(j)) covered.set(j, reason);
    }
  });
  return covered;
}

const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*|\{\s*\/\*)/.test(line);

/**
 * Scan one file's text. Exported so the tests can exercise the rules on
 * fixtures without touching the filesystem.
 *
 * @returns {{findings: object[], exemptions: object[]}}
 */
export function scanText(path, text) {
  const findings = [];
  const exemptions = [];
  const lines = text.split(/\r?\n/);
  const covered = exemptionMap(lines);
  const isCss = CSS_EXT.test(path);
  const isCode = CODE_EXT.test(path);
  const inI18n = path.includes(`i18n${sep}`) || path.includes('i18n/');
  const isTest = /\.(test|spec)\.[tj]sx?$/.test(path);

  let inBlockComment = false;

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // Track /* … */ so a commented-out example is not reported as real code.
    const opens = (line.match(/\/\*/g) || []).length;
    const closes = (line.match(/\*\//g) || []).length;
    const startedInComment = inBlockComment;
    inBlockComment = inBlockComment ? closes < opens || closes === 0 : opens > closes;

    const reason = covered.get(i);
    const record = (rule, message, fix) => {
      if (reason !== undefined) {
        exemptions.push({ path, line: lineNo, rule, reason, text: line.trim() });
      } else {
        findings.push({ path, line: lineNo, rule, message, fix, text: line.trim() });
      }
    };

    const commented = startedInComment || isCommentLine(line);

    /* --- 1. physical properties ---------------------------------------- */
    if (!commented) {
      const table = isCss ? CSS_PHYSICAL : isCode ? JS_PHYSICAL : [];
      for (const [re, logical] of table) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) record('physical-property', `physical CSS "${m[0].trim()}"`, `use ${logical}`);
      }
      if (isCode) {
        for (const [re, logical] of TW_PHYSICAL) {
          re.lastIndex = 0;
          const m = re.exec(line);
          if (m) record('physical-utility', `physical Tailwind utility "${m[0]}"`, `use ${logical}`);
        }
      }
    }

    /* --- 2. tracking on translatable text ------------------------------ */
    if (!commented && !LATIN_SCOPED.test(line)) {
      for (const [re, kind] of TRACKING) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          record(
            'tracking-on-arabic',
            `letter-spacing (${kind}) on text that can hold Arabic: "${m[0]}"`,
            'Arabic is connected — scope the rule to :lang(en)/.u-latin, or use the .u-label class whose :lang(ar) branch swaps tracking for size, weight and word-spacing',
          );
        }
      }
    }

    /* --- 3. hardcoded copy --------------------------------------------- */
    if (isCode && !inI18n && !isTest && !commented && !/^\s*import\b/.test(line)) {
      USER_FACING_PROPS.lastIndex = 0;
      let m;
      while ((m = USER_FACING_PROPS.exec(line))) {
        if (HAS_WORDS.test(m[2]) && !NOT_COPY.test(m[2])) {
          record(
            'hardcoded-string',
            `user-facing ${m[1]}="${m[2]}" is not in the string catalogue`,
            "move it to apps/web/src/i18n/strings.en.ts and use t('key')",
          );
        }
      }

      JSX_TEXT.lastIndex = 0;
      while ((m = JSX_TEXT.exec(line))) {
        const candidate = m[1].trim();
        if (candidate && HAS_WORDS.test(candidate) && !NOT_COPY.test(candidate)) {
          record(
            'hardcoded-string',
            `user-facing text "${candidate}" is not in the string catalogue`,
            "move it to apps/web/src/i18n/strings.en.ts and use t('key')",
          );
        }
      }
    }
  });

  return { findings, exemptions };
}

/* ---------------------------------------------------------------------------
 * Catalogue parity. Type-checking already forbids a missing Arabic key; this
 * reports the number, because a coverage percentage gets looked at and a
 * compiler error only gets fixed.
 * ------------------------------------------------------------------------ */
const CATALOGUE_KEY = /^\s*'([^']+)'\s*:/gm;

export function catalogueReport(enText, arText) {
  const keys = (text) => new Set([...text.matchAll(CATALOGUE_KEY)].map((m) => m[1]));
  const enKeys = keys(enText);
  const arKeys = keys(arText);
  const missing = [...enKeys].filter((k) => !arKeys.has(k));
  const orphan = [...arKeys].filter((k) => !enKeys.has(k));
  const todos = (arText.match(/\btodo\(/g) || []).length;
  return {
    total: enKeys.size,
    missing,
    orphan,
    todos,
    translated: enKeys.size - missing.length - todos,
  };
}

/* ------------------------------------------------------------------------ */

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(join(dir, e.name));
    } else if (CODE_EXT.test(e.name) || CSS_EXT.test(e.name)) {
      yield join(dir, e.name);
    }
  }
}

async function main() {
  const findings = [];
  const exemptions = [];
  let scanned = 0;

  for await (const file of walk(SCAN_DIR)) {
    const rel = relative(ROOT, file);
    const text = await readFile(file, 'utf8');
    const r = scanText(rel, text);
    findings.push(...r.findings);
    exemptions.push(...r.exemptions);
    scanned++;
  }

  let catalogue = null;
  try {
    const [enText, arText] = await Promise.all([
      readFile(join(I18N_DIR, 'strings.en.ts'), 'utf8'),
      readFile(join(I18N_DIR, 'strings.ar.ts'), 'utf8'),
    ]);
    catalogue = catalogueReport(enText, arText);
    for (const k of catalogue.missing) {
      findings.push({
        path: 'apps/web/src/i18n/strings.ar.ts',
        line: 0,
        rule: 'missing-translation',
        message: `key "${k}" exists in English and not in Arabic`,
        fix: "add it, or admit the gap with todo('English text')",
        text: '',
      });
    }
  } catch {
    findings.push({
      path: 'apps/web/src/i18n/',
      line: 0,
      rule: 'missing-catalogue',
      message: 'the string catalogue is missing',
      fix: 'strings.en.ts and strings.ar.ts must both exist',
      text: '',
    });
  }

  const byRule = findings.reduce((acc, f) => ((acc[f.rule] = (acc[f.rule] || 0) + 1), acc), {});

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ scanned, findings, exemptions, catalogue, byRule }, null, 2));
  } else if (!process.argv.includes('--quiet')) {
    console.log(`\nRTL / i18n check`);
    console.log(`  files scanned     ${scanned}`);
    if (catalogue) {
      const pct = catalogue.total ? Math.round((catalogue.translated / catalogue.total) * 100) : 0;
      console.log(`  strings           ${catalogue.total}`);
      console.log(`  arabic            ${catalogue.translated} (${pct}%) · ${catalogue.todos} TODO(ar)`);
    }
    console.log(`  findings          ${findings.length}`);
    console.log(`  exemptions        ${exemptions.length}`);

    if (exemptions.length) {
      console.log(`\n  Exemptions in force — every one of these is a promise that the`);
      console.log(`  surface genuinely does not mirror. Read them; they should be few.`);
      for (const e of exemptions) console.log(`    ${e.path}:${e.line}  ${e.rule} — ${e.reason}`);
    }

    if (findings.length) {
      console.log('');
      for (const f of findings) {
        console.log(`  FAIL  ${f.path}:${f.line}  ${f.message}`);
        console.log(`        → ${f.fix}`);
      }
    }
    console.log('');
  }

  process.exit(findings.length ? 1 : 0);
}

// Run only when invoked directly; importing this file for tests must not exit.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
