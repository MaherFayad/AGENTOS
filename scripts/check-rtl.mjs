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
 * WHAT THIS CHECKER CANNOT SEE, AND WHY IT SAYS SO OUT LOUD.
 *
 * Until 2026-08-17 rule 3 matched exactly two shapes: a quoted JSX attribute and a
 * single-line `>text<` node. Everything else was silent — not exempted, not deferred,
 * *invisible*. Four separate agents added user-facing copy that session and the counter
 * did not move: `STATUS_WORD` in the drawer (a const map), all four `BrainEmptyState`
 * strings (JSX text on its own line), eleven `CostTicker` strings (object literals) and
 * thirty-one in `dashboards/**`. `shell-navigation-engineer` put it exactly right — *"the
 * counter could not have moved however many I added."*
 *
 * A counter that cannot move is worse than no counter, because people cite it. So the
 * detector is widened below, AND — the half that keeps it honest as the codebase grows —
 * every category it still structurally cannot reach is PRINTED on every run, with a count
 * where a count is obtainable and the word `unknown` where it is not. Same shape as
 * `run-all.mjs` distinguishing "could not start" from "failed": a tool must be able to say
 * *I did not look here*, or its zero is a claim it has not earned.
 *
 * Usage: node scripts/check-rtl.mjs [--json] [--quiet]
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, §2.2, §2.3, §2.6.5, Part VI row 8.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provenanceLine } from './lib/provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = join(ROOT, 'apps', 'web', 'src');
const I18N_DIR = join(SCAN_DIR, 'i18n');

const SKIP_DIRS = new Set(['node_modules', '.next', '.next-build', 'dist', 'build', '__snapshots__']);
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
  // `space-x-*` and `divide-x-*` compile to margin-left / border-left-width in
  // Tailwind v3 and do NOT follow `dir`. They look direction-neutral, which is
  // what makes them the trap: the layout is quietly wrong in RTL and nothing in
  // the class name says so. `gap-*` on a flex/grid parent is the fix in almost
  // every case and is one class shorter.
  [/(?<![\w-])space-x-(?=[\w[.])/g, 'gap-* on the flex/grid parent'],
  [/(?<![\w-])divide-x(?![\w-])/g, 'gap-* + border-s-* on the children'],
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
  // Capture the VALUE, never a lookahead. `letter-spacing\s*:\s*(?!normal)` looks
  // correct and is not: the engine backtracks `\s*` to zero width, the lookahead
  // then reads " normal" instead of "normal", and `letter-spacing: normal` — the
  // Arabic reset itself — reports as a violation. Read the value, then judge it.
  [/(?<![-\w])letter-spacing\s*:([^;{}\n]+)/gi, 'css'],
  [/(?<![\w$])letterSpacing\s*:\s*['"]?([^,'"}\n]+)/g, 'js'],
  // Longest alternative first: `wide` would otherwise match the head of
  // `wider-4` and judge a 0.45em label as 0.025em of optical relief.
  [/(?<![\w-])tracking-(wider-[1-4]|widest|wider|wide|\[[^\]]+\])(?![\w-])/g, 'tailwind'],
];

/** Tailwind's default rungs, in em, so one function can judge every source. */
const TW_TRACK_EM = { wide: 0.025, wider: 0.05, widest: 0.1 };

/**
 * The four sanctioned rungs (§1.4, +0.25em…+0.45em). They carry their own Arabic
 * branch: tokens.css publishes them as --track-1…4 and rtl.css re-points all four
 * at `normal` under :lang(ar), then puts the emphasis back as size, weight and
 * word-spacing. Using them IS the fix, so using them is not a finding.
 */
const TOKEN_RUNG = /tracking-wider-[1-4]\b|var\(\s*--track-[1-4]\s*\)/;

/** The role classes, for text that carries tracking without a token utility. */
const COMPENSATED = /\bu-(?:label|eyebrow|tab)\b/;

/** A rule already scoped to Latin is fine — that is the sanctioned pattern. */
const LATIN_SCOPED = /:lang\(en\)|\.u-latin\b|\[lang=['"]?en/i;

/**
 * Is this tracking WIDE — i.e. is the tracking itself the emphasis?
 *
 * The distinction is not pedantry, it is the whole rule:
 *
 *   +0.25em…+0.45em on a caps label → the emphasis IS the tracking. Under
 *     :lang(ar) it resets to normal and the label is left with nothing. It needs
 *     the compensation. REPORT IT.
 *
 *   −0.028em on an 86px display headline, or +0.025em of optical relief → the
 *     emphasis is the SIZE. Arabic wants the reset and nothing else; tightening
 *     Arabic display type is wrong anyway. SILENT — rtl.css already handles it.
 */
const WIDE_EM = 0.05;

export function isWideTracking(value) {
  const v = String(value).trim().replace(/!important/i, '').trim();
  if (!v || /^(normal|inherit|initial|unset|revert)\b/i.test(v)) return false;
  if (v in TW_TRACK_EM) return TW_TRACK_EM[v] >= WIDE_EM;
  const num = v.match(/(-?\d*\.?\d+)\s*(em|rem|px|%)/);
  if (!num) return false; // a var() we do not recognise, a calc() — judged by TOKEN_RUNG
  const n = parseFloat(num[1]);
  if (n <= 0) return false; // negative or zero: the reset is the entire answer
  if (num[2] === 'px') return n >= 0.8; // ~0.05em at a 16px body
  if (num[2] === '%') return n >= WIDE_EM * 100;
  return n >= WIDE_EM;
}

const TRACKING_FIX =
  'Arabic is a connected script — tracking severs the joins (§1.4). rtl.css resets it under ' +
  ':lang(ar), so a hardcoded track leaves the label with no emphasis at all. Use the token ' +
  'rung (tracking-wider-1…4 / var(--track-N)), which rtl.css flattens and compensates in one ' +
  'place, or add a role class (.u-label / .u-eyebrow / .u-tab), or scope the rule to ' +
  ':lang(en) if the text is genuinely Latin-only.';

/* ---------------------------------------------------------------------------
 * 3. Hardcoded user-facing copy.
 * ------------------------------------------------------------------------ */
const USER_FACING_PROPS =
  /\b(placeholder|title|aria-label|aria-description|aria-placeholder|aria-roledescription|alt|label|heading|caption|emptyMessage|errorMessage)\s*=\s*["']([^"']{2,})["']/g;

/**
 * A TEMPLATE LITERAL WITH NO `${}` IS A PLAIN STRING LITERAL. It differs from a
 * quoted string in one character of syntax and in nothing a reader can see.
 *
 * This was the hole that let three sentences ship untranslated in the shell's
 * highest-frequency control (`ProjectSwitcher.tsx:185-186`, M15 verdict item 2).
 * Identical prose was a FAIL as `aria-label="…"` and silent as ``aria-label={`…`}``.
 *
 * The sharp part, and the reason this is a fix rather than a widening: the
 * `assembled-template` blind spot is declared with the justification *"because
 * some are genuinely `${a} · ${b}` joins"*. A template with zero interpolations
 * has no such defence. It is not an assembled sentence, it is a sentence. The
 * blind spot was honest about the undecidable case and was covering a decidable
 * one, and **a declared blind spot is not a licence over the part of the class
 * that is decidable.**
 *
 * `[^`\\$]` excludes `$` from the body and `\$(?!\{)` lets a literal `$` back in,
 * so `` `Total: $${n}` `` is still an assembled template and `` `costs $5` `` is
 * still a plain string.
 */
const PLAIN_TEMPLATE_BODY = String.raw`(?:[^\`\\$]|\\.|\$(?!\{))*`;
const PLAIN_TEMPLATE = new RegExp('`(' + PLAIN_TEMPLATE_BODY + ')`', 'g');
const USER_FACING_PROPS_TEMPLATE = new RegExp(
  '\\b(placeholder|title|aria-label|aria-description|aria-placeholder|aria-roledescription|alt|label|heading|caption|emptyMessage|errorMessage)' +
    '\\s*=\\s*\\{\\s*`(' +
    PLAIN_TEMPLATE_BODY +
    ')`\\s*\\}',
  'g',
);

/**
 * JSX text nodes: >Some words< with no braces, i.e. not an expression.
 *
 * NO `\n` IN THE CHARACTER CLASS, and that is the fix rather than an oversight.
 * The original was `/>([^<>{}\n]{2,})</g`, which required the tag, the copy and
 * the closing tag to be on ONE line. Prettier does not format JSX that way, so
 *
 *     <text …>
 *       Second brain
 *     </text>
 *
 * — a rendered, user-facing string — produced **zero** findings, and
 * `map-galaxy-engineer` reasonably read that silence as a pass. Every string in
 * `BrainEmptyState.tsx` hid in that gap.
 *
 * Only ever run against .tsx/.jsx. In a .ts file the same `>…<` sandwich is a
 * generic — `Promise<void>`, `Record<string, Resource>` — and reporting
 * "Promise" as untranslated copy trains people to ignore the checker, which is
 * worse than not running it.
 *
 * **AND A .tsx FILE DECLARES GENERICS TOO.** Reported by `drawer-engineer`,
 * 2026-08-18, from the mailbox composer:
 *
 *     export type Sender = (
 *       threadId: string,
 *       input: { body: string; interrupt: ComposableLevel },
 *     ) => Promise<PostThreadMessageResponse>;
 *
 * `=> Promise<` is a `>`, then text, then a `<` — so the arrow's own `>` opened a
 * text node and `Promise` was reported as uncatalogued copy. Rule 3a's dropping of
 * `\n` from the class is what made it reachable: the arrow only lands on its own
 * line because Prettier wraps a wide signature, so the trigger is FORMATTING, and
 * any `.tsx` declaring an async callback type wide enough to wrap will hit it.
 *
 * `JSX_ARROW` refuses a match whose `>` is the second half of `=>`. This is the
 * narrower half of the pair the standing findings warn about: a checker that fires
 * on something no reader will ever see costs a baseline raise, and a baseline
 * raised for a word nobody reads is how a ratchet stops meaning anything. The
 * reporter did not work around it — they moved the type to a `.ts` module, where it
 * belonged — so this fix buys the NEXT person the honest fix instead of a contorted
 * declaration.
 */
const JSX_TEXT = />([^<>{}]{2,}?)</g;
/** `=` immediately before the opening `>`: a fat arrow, never a closing tag. */
const JSX_ARROW = /=$/;
const JSX_FILE = /\.(tsx|jsx)$/;

/** Two consecutive letters in either script — the bar for "this is copy". */
const HAS_WORDS = /[A-Za-z؀-ۿ]{2,}/;

/** Things that look like copy but are not: entities, units, keys, paths. */
const NOT_COPY =
  /^(?:\s|&[a-z]+;|&#\d+;|[·•—–|/\\,.:;!?()[\]{}'"`+*=<>%$#@~^_-]|\d)*$/;

/**
 * `Promise<T>` and `Record<K, V>` also produce a `>…<` sandwich, so the naive
 * JSX text scan reads TypeScript generics as English prose. Punctuation is the
 * tell — but the tell has to be *specific*, because the previous blanket ban on
 * `(` and `:` also silenced real copy like `Run now (beta)` and
 * `Permission · tool: summary`. What marks code is a call, an assignment, an
 * arrow, an interpolation or a brace — not a lone bracket in a sentence.
 */
const LOOKS_LIKE_CODE =
  /[{}<>|&;]|=>|\$\{|\w+\(|\)\s*[;.]|::|\s=\s|\w+\s*:\s*\w+\s*[,)]|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|deg|ms|fr|ch)\b|[A-Za-z]\.[A-Za-z]|\?\s*\(/;

/* ---------------------------------------------------------------------------
 * 3b. Copy that is NOT in JSX — const maps, object literals, arguments.
 *
 * This is the widening. Two mechanisms, because two different things went
 * missing and one rule cannot catch both:
 *
 *   A. PROSE ANYWHERE. Any string literal whose *content* reads as a sentence or
 *      a multi-word label is copy, wherever it sits — an object value, an array
 *      element, a default parameter, a call argument. `'spend unknown'` is copy
 *      in `const LABEL = {…}` for the same reason it is copy in JSX. The test is
 *      strict enough to run everywhere: two real words, no code punctuation, not
 *      a class list, not a path or URL.
 *
 *   B. SINGLE WORDS WITH A COPY-SHAPED HOME. `queued`, `finished`, `denied` are
 *      one word each and mechanism A must not fire on every enum value in the
 *      repo. What makes those seven copy is where they live: a `Record<…, string>`
 *      called STATUS_WORD, rendered into the accessibility tree. So a lone word
 *      is reported when its KEY names copy (`…Message`, `title`, `hint`) or its
 *      CONTAINER does (`const COPY`, `const LABEL`, `const STATUS_WORD`).
 *
 * Both skip the places a literal is machinery, not language.
 * ------------------------------------------------------------------------ */

/** A property key that names copy: `errorMessage`, `title`, `hint`, `emptyLabel`. */
const COPY_KEY =
  /^(?:'|")?(?:[a-z][\w$]*)?(?:label|title|text|message|msg|hint|description|caption|summary|body|heading|placeholder|tooltip|blurb|word|note|sentence|copy|prompt|help|legend|announce|announcement)$/i;

/**
 * A container whose NAME says it holds words. Matched on the declaration line;
 * membership then runs to the matching brace, counted, so a nested object does
 * not end it early.
 */
const COPY_CONTAINER =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:\{|\[)\s*$/;

/**
 * An object PROPERTY that opens a block of machinery: `headers: {`, `style: {`.
 * Judged by `MACHINE_CONTEXT` on the key alone.
 *
 * Without it, machine suppression depended on Prettier: `headers: { 'cache-control':
 * 'no-store, no-transform' }` on one line was suppressed by the word `headers`, and
 * the identical object wrapped onto four lines was not — the header VALUE reported
 * as untranslated copy. The context is the object, not the column width.
 */
const MACHINE_PROPERTY_CONTAINER = /(?:^|[{,(])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?:\{|\[)\s*$/;
const COPY_CONTAINER_NAME =
  /(?:^|_)(?:COPY|LABELS?|TEXTS?|MESSAGES?|WORDS?|STRINGS?|TITLES?|HINTS?|BLURBS?|CAPTIONS?|SENTENCES?|NOTES?|PROSE|EMPTY|WORDING|PHRASES?)(?:$|_)/i;

/** `key: 'value'` in an object literal, both quote styles. */
const OBJ_ENTRY = /(?:^|[{,[(])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(['"])((?:[^\\]|\\.)*?)\4/g;

/** Any bare string literal, for mechanism A. */
const ANY_STRING = /(['"])((?:[^\\\n]|\\.)*?)\1/g;

/**
 * Where a literal is machinery. Reporting these would train people to ignore the
 * checker, which is the failure mode this file exists to avoid.
 *
 * TESTED AGAINST THE CODE SKELETON, NEVER THE PROSE. This list holds `to`, `it`,
 * `as`, `id`, `key`, `name`, `type`, `role`, `path`, `url`, `test` and `content` —
 * every one of them an ordinary English word as well as an identifier. Matched
 * against the raw line, the sentence *being judged* could suppress its own
 * finding: `'Everything on screen is scoped to it.'` contains both `to` and `it`
 * and was silent, while `'Everything on screen is scoped.'` was a FAIL. Two
 * sentences, one rule, opposite verdicts, decided by whether the copy happened to
 * contain a preposition. `blankLiterals()` empties every literal before this runs,
 * so `className="…"` still suppresses and the copy inside it no longer votes.
 */
const MACHINE_CONTEXT =
  /\b(?:className|class|classNames?|clsx|cn|id|htmlFor|href|src|srcSet|to|path|url|key|role|type|as|name|dataTestId|data-testid|testId|method|charset|encoding|env|process\.env|require|import|from|localStorage|sessionStorage|getItem|setItem|setAttribute|getAttribute|querySelector|addEventListener|removeEventListener|dispatchEvent|createElement|console|Error|TypeError|RangeError|assert|describe|it|test|expect|matchMedia|fetch|new URL|JSON\.parse|toContain|toMatch)\b|(?:cache|content|user)-(?:control|type|agent|disposition)|\b(?:headers|authorization|fontFamily|font-family|localFont)\b/;

/**
 * A container whose name says its values are machinery. Suppresses mechanism A
 * as well as B, because `FONT_FAMILY.sans = 'Plus Jakarta Sans'` is three real
 * words and is still not a sentence anybody translates.
 */
const MACHINE_CONTAINER_NAME =
  /(?:^|_)(?:FONT|FAMILY|FAMILIES|CLASS|CLASSES|STYLE|STYLES|TOKEN|TOKENS|URL|URLS|PATH|PATHS|ROUTE|ROUTES|KEY|KEYS|ID|IDS|HEADER|HEADERS|MIME|QUERY|QUERIES|SQL|ENV|COLOR|COLOURS?|COLORS|ICON|ICONS|SELECTOR|SELECTORS|EVENT|EVENTS|ATTR|ATTRS|TONE|VARIANT|VARIANTS)(?:$|_)/i;

/** `'use client'` and friends are directives to the bundler, not to a reader. */
const DIRECTIVE = /^use (?:client|server|strict)$/;

/** A lowercase kebab identifier — a slug, an enum value or a Tailwind class. */
const KEBAB_IDENT = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/** A trailing `// …` comment is not code, and its prose is not copy. */
const stripLineComment = (line) => line.replace(/(^|[^:\w])\/\/.*$/, '$1');

/**
 * The line with every literal's CONTENTS blanked and its delimiters kept.
 * `foo({ title: 'Scoped to it' })` → `foo({ title: '' })`. Used only to ask
 * *what kind of code is this line*, never to read anything out of it.
 */
export function blankLiterals(line) {
  return blankQuoted(line).replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * The same, for quoted strings only — templates survive.
 *
 * Needed before the plain-template scan, because a backtick can also be ordinary
 * punctuation *inside* a quoted sentence:
 * `setError('Paste the recovery secret from ‵happy auth‵ on the machine…')`
 * has two backticks and no template, and reading between them yields the
 * non-sentence "happy auth" alongside the real finding.
 */
export function blankQuoted(line) {
  return line.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/** A URL, a path, a selector, a MIME type, a query string, a CSS declaration. */
const NOT_LANGUAGE =
  /^(?:https?:|mailto:|tel:|\/|\.{1,2}\/|#|\?|@|--|\$\{|[A-Za-z]+\/[A-Za-z]|\w+=|[.#][A-Za-z][\w-]*\s*[,{]|\w[\w-]*\s*:\s*[^ ])/;

/** `flex items-center gap-2` is not a sentence. Every token kebab/colon-shaped. */
function looksLikeClassList(tokens) {
  return tokens.every((t) => /^-?[a-z0-9]+[\w:./[\]()%#-]*$/.test(t)) && tokens.some((t) => /[-:[]/.test(t));
}

/** Two real words, no code, no class list, no path. The bar for mechanism A. */
export function looksLikeProse(value) {
  const v = String(value).trim();
  if (v.length < 3 || !HAS_WORDS.test(v) || NOT_COPY.test(v)) return false;
  if (DIRECTIVE.test(v) || KEBAB_IDENT.test(v)) return false;
  if (NOT_LANGUAGE.test(v)) return false;
  if (LOOKS_LIKE_CODE.test(v)) return false;
  if (!/\s/.test(v)) return false;
  const tokens = v.split(/\s+/);
  if (looksLikeClassList(tokens)) return false;
  // SCREAMING_SNAKE or camelCase identifier lists are code even when spaced.
  if (tokens.every((t) => /^[A-Z][A-Z0-9_]*$/.test(t))) return false;
  return tokens.filter((t) => /[A-Za-z؀-ۿ]{2,}/.test(t)).length >= 2;
}

/** A single word that is copy only because of where it lives. Mechanism B. */
function isWordish(value) {
  const v = String(value).trim();
  return (
    v.length >= 2 &&
    HAS_WORDS.test(v) &&
    !NOT_COPY.test(v) &&
    !NOT_LANGUAGE.test(v) &&
    !LOOKS_LIKE_CODE.test(v) &&
    !DIRECTIVE.test(v) &&
    !KEBAB_IDENT.test(v) &&
    /^[\p{L}\p{M}][\p{L}\p{M}\s'’·—–-]*$/u.test(v)
  );
}

const COPY_FIX = "move it to apps/web/src/i18n/strings.en.ts and use t('key')";

/* ---------------------------------------------------------------------------
 * 3c. The blind spots — categories this checker structurally cannot reach.
 *
 * Printed on every run whether or not the run is green. A category with a count
 * is one we can measure but not judge; a category with `unknown` is one we
 * cannot even measure from source. Both beat silence, which is what the previous
 * version offered and which is how four agents each concluded, reasonably, that
 * their strings had been checked.
 * ------------------------------------------------------------------------ */

/** `title={sentence}` — the value is an expression, so there is no literal to read. */
const EXPR_ATTR =
  /\b(?:title|aria-label|aria-description|aria-placeholder|aria-roledescription|placeholder|alt|label|heading|caption|emptyMessage|errorMessage|summary)\s*=\s*\{/g;

/** A template literal with an interpolation and words in its static halves. */
const TEMPLATE_COPY = /`((?:[^`\\]|\\.)*?\$\{(?:[^`\\]|\\.)*?)`/g;

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
 * Rejoin a sentence Prettier broke across lines with `+`.
 *
 * Without this, one sentence wrapped at 100 columns is reported as two findings
 * and half of each is quoted in the output. The count then exceeds the number of
 * strings, which is the same class of error as the count being too low: a number
 * you cannot act on. Continuations are blanked rather than removed so every line
 * number in the file still means what it says.
 */
function joinConcatenations(lines) {
  const out = lines.slice();
  for (let i = out.length - 2; i >= 0; i--) {
    const head = out[i].match(/^(.*)(['"])((?:[^\\]|\\.)*?)\2\s*\+\s*$/);
    if (!head) continue;
    const tail = out[i + 1].match(/^\s*(['"])((?:[^\\]|\\.)*?)\1(.*)$/);
    if (!tail) continue;
    // Prettier alternates quote styles across a wrapped concatenation, so the
    // two halves rarely agree. Merge on content and pick a quote neither half
    // contains; if both are present, leave it alone rather than mangle it.
    const merged = head[3] + tail[2];
    const q = !merged.includes("'") ? "'" : !merged.includes('"') ? '"' : null;
    if (!q) continue;
    out[i] = `${head[1]}${q}${merged}${q}${tail[3]}`;
    out[i + 1] = '';
  }
  return out;
}

/**
 * The safe-area insets are the one place where a physical side is the CORRECT
 * answer: the notch is on a physical edge of a physical device and does not move
 * when the reader's language changes. What is wrong is *mixing* them — a
 * `pl-[calc(20px+env(safe-area-inset-left))]` welds a logical design decision
 * (20px of inline padding) to a physical device fact, and the pair cannot be
 * right in both directions at once. Split them, and the physical half earns an
 * `rtl-exempt:` comment.
 */
const SAFE_AREA = /safe-area-inset-(?:left|right)|--\w*safe[-_]?[lr]\b/i;

const fixFor = (logical, line) =>
  SAFE_AREA.test(line)
    ? `use ${logical} for the design padding, and keep the device inset on its own physical ` +
      `declaration with an "rtl-exempt: safe-area inset is a physical edge" comment — the notch ` +
      `does not move when the language does, but the 20px beside it does`
    : `use ${logical}`;

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
  const joined = joinConcatenations(lines);
  const covered = exemptionMap(lines);
  const isCss = CSS_EXT.test(path);
  const isCode = CODE_EXT.test(path);
  const inI18n = path.includes(`i18n${sep}`) || path.includes('i18n/');
  // Tests assert class names and stream bytes. A test cannot render Arabic
  // wrong, and `expect(cls).toContain('tracking-wider-1')` is not a design
  // decision — it is a description of one made somewhere else.
  // Test material, widened 2026-08-17. Fixtures are the sharpest case: a fixture
  // agent called "Creative Fatigue Detector" is a *description of data*, and
  // reporting twelve of them as untranslated product copy is exactly the noise
  // that teaches people to stop reading the output.
  const isTest =
    /\.(test|spec)\.[cm]?[tj]sx?$/.test(path) ||
    /(?:^|[\\/])(?:__tests__|__fixtures__|__mocks__|test)[\\/]/.test(path) ||
    /(?:^|[\\/])(?:test-(?:harness|mocks)|mocks?)\.[tj]sx?$/.test(path);

  let inBlockComment = false;
  /** Mechanism B's context: which copy-named container we are inside, if any. */
  let containerName = null;
  let containerDepth = 0;
  let machineContainer = false;

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
    if (!commented && !isTest) {
      const table = isCss ? CSS_PHYSICAL : isCode ? JS_PHYSICAL : [];
      for (const [re, logical] of table) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) record('physical-property', `physical CSS "${m[0].trim()}"`, fixFor(logical, line));
      }
      if (isCode) {
        for (const [re, logical] of TW_PHYSICAL) {
          re.lastIndex = 0;
          const m = re.exec(line);
          if (m) record('physical-utility', `physical Tailwind utility "${m[0]}"`, fixFor(logical, line));
        }
      }
    }

    /* --- 2. tracking on translatable text ------------------------------ */
    if (!commented && !LATIN_SCOPED.test(line) && !COMPENSATED.test(line)) {
      for (const [re, kind] of TRACKING) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          const value = m[1] ?? '';
          // A token rung is the sanctioned answer, not a violation.
          if (TOKEN_RUNG.test(m[0])) continue;
          const literal = kind === 'tailwind' ? value.replace(/^\[|\]$/g, '') : value;
          if (!isWideTracking(literal)) continue;
          record(
            'tracking-on-arabic',
            `wide tracking (${kind}) on text that can hold Arabic: "${m[0].trim()}"`,
            TRACKING_FIX,
          );
        }
      }
    }

    /* --- 3. hardcoded copy --------------------------------------------- */
    if (isCode && !inI18n && !isTest && !commented && !/^\s*import\b/.test(line)) {
      // One string, one finding. `aria-label="Focus next department"` is matched by the
      // attribute rule AND by the prose rule below; reporting it twice inflates the number
      // this file exists to make trustworthy.
      const reported = new Set();

      let m;
      for (const re of [USER_FACING_PROPS, USER_FACING_PROPS_TEMPLATE]) {
        re.lastIndex = 0;
        while ((m = re.exec(line))) {
          if (HAS_WORDS.test(m[2]) && !NOT_COPY.test(m[2])) {
            reported.add(m[2].trim());
            record(
              'hardcoded-string',
              `user-facing ${m[1]}="${m[2]}" is not in the string catalogue`,
              COPY_FIX,
            );
          }
        }
      }

      /* --- 3b. copy outside JSX: const maps and object literals --------- */

      // Container membership. Opened by name, closed by brace count, so a
      // nested object inside COPY does not end it three lines early.
      const code = stripLineComment(joined[i]);
      if (containerDepth > 0) {
        containerDepth += (code.match(/[{[]/g) || []).length - (code.match(/[}\]]/g) || []).length;
        if (containerDepth <= 0) {
          containerName = null;
          machineContainer = false;
        }
      } else {
        const open = code.match(COPY_CONTAINER);
        const prop = code.match(MACHINE_PROPERTY_CONTAINER);
        const propKey = prop ? (prop[1] ?? prop[2] ?? prop[3] ?? '') : '';
        if (open && MACHINE_CONTAINER_NAME.test(open[1])) {
          machineContainer = true;
          containerDepth = 1;
        } else if (open && COPY_CONTAINER_NAME.test(open[1])) {
          containerName = open[1];
          containerDepth = 1;
        } else if (prop && MACHINE_CONTEXT.test(propKey)) {
          machineContainer = true;
          containerDepth = 1;
        }
      }

      // A. prose anywhere — an object value, an array element, an argument.
      // A zero-interpolation template is a string literal, so it is scanned by the
      // same mechanism rather than deferred to the blind-spot count.
      if (!machineContainer && !MACHINE_CONTEXT.test(blankLiterals(code))) {
        // A line carrying an interpolation is left to `assembled-template`: the
        // plain-template pattern would otherwise start matching at the escaped
        // backtick inside `` `"${name}" has no \`department\` — …` `` and quote
        // half a sentence. One `${` on the line and the whole line is that
        // category's, which is where it was already being counted.
        const hasInterpolation = code.includes('${');
        for (const [re, group, source] of [
          [ANY_STRING, 2, code],
          [PLAIN_TEMPLATE, 1, hasInterpolation ? '' : blankQuoted(code)],
        ]) {
          re.lastIndex = 0;
          while ((m = re.exec(source))) {
            const candidate = m[group].trim();
            if (!looksLikeProse(candidate) || reported.has(candidate)) continue;
            reported.add(candidate);
            record('hardcoded-string', `user-facing text "${candidate}" is not in the string catalogue`, COPY_FIX);
          }
        }
      }

      // B. a lone word whose key or container names it as copy.
      OBJ_ENTRY.lastIndex = 0;
      while (!machineContainer && (m = OBJ_ENTRY.exec(code))) {
        const key = m[1] ?? m[2] ?? m[3] ?? '';
        const candidate = m[5].trim();
        if (reported.has(candidate)) continue;
        if (MACHINE_CONTEXT.test(key)) continue;
        const named = COPY_KEY.test(key) || containerName !== null;
        if (!named || !isWordish(candidate)) continue;
        reported.add(candidate);
        record(
          'hardcoded-string',
          containerName !== null
            ? `user-facing word "${candidate}" in ${containerName} is not in the string catalogue`
            : `user-facing ${key}: "${candidate}" is not in the string catalogue`,
          COPY_FIX,
        );
      }
    }
  });

  /* --- 3a. JSX text, across lines ------------------------------------- */
  // Run over the whole file rather than per line, because Prettier puts the copy
  // on its own line and the per-line version could only ever see `>text<`.
  if (isCode && JSX_FILE.test(path) && !inI18n && !isTest) {
    const stripped = stripComments(text);
    JSX_TEXT.lastIndex = 0;
    let m;
    while ((m = JSX_TEXT.exec(stripped))) {
      const raw = m[1];
      // `=> Promise<T>` is not a text node. See JSX_ARROW.
      if (JSX_ARROW.test(stripped.slice(0, m.index ?? 0))) continue;
      const candidate = raw.replace(/\s+/g, ' ').trim();
      if (!candidate || !HAS_WORDS.test(candidate) || NOT_COPY.test(candidate)) continue;
      if (LOOKS_LIKE_CODE.test(candidate)) continue;
      // Attribute the finding to the line the words start on, not the tag.
      const at = (m.index ?? 0) + 1 + raw.search(/\S/);
      const idx = lineIndexOf(stripped, at);
      if (covered.has(idx)) {
        exemptions.push({
          path,
          line: idx + 1,
          rule: 'hardcoded-string',
          reason: covered.get(idx),
          text: candidate,
        });
        continue;
      }
      findings.push({
        path,
        line: idx + 1,
        rule: 'hardcoded-string',
        message: `user-facing text "${candidate}" is not in the string catalogue`,
        fix: COPY_FIX,
        text: candidate,
      });
    }
  }

  return { findings, exemptions, blind: blindSpotCounts(path, text, { isCode, inI18n, isTest }) };
}

/** Comments, blanked but not removed — offsets and line numbers must not shift. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\w])\/\/[^\n]*/g, (c, p) => p + ' '.repeat(c.length - p.length));
}

const lineIndexOf = (text, offset) => {
  let n = 0;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++;
  return n;
};

/**
 * What this file contains that the rules above cannot judge. Counted, never
 * reported as a finding: a count that a human has to look at is the honest
 * middle ground between a false pass and a false failure.
 */
function blindSpotCounts(path, text, { isCode, inI18n, isTest }) {
  const zero = { exprAttr: 0, template: 0, multilinePlain: 0 };
  if (!isCode || inI18n || isTest) return zero;
  const stripped = stripComments(text);
  let m;
  let exprAttr = 0;
  let template = 0;
  let multilinePlain = 0;

  EXPR_ATTR.lastIndex = 0;
  while ((m = EXPR_ATTR.exec(stripped))) exprAttr++;
  // A zero-interpolation `attr={`…`}` is now READ rather than deferred. Leaving
  // it in this count would report one string twice: once as a finding and once
  // as a thing nobody looked at.
  USER_FACING_PROPS_TEMPLATE.lastIndex = 0;
  while ((m = USER_FACING_PROPS_TEMPLATE.exec(stripped))) exprAttr--;

  // The residue of the plain-template fix, named rather than left implied: the
  // copy scan runs per line, so a plain template Prettier broke across lines is
  // still unread. Counted, so its zero is one this file went looking for.
  PLAIN_TEMPLATE.lastIndex = 0;
  while ((m = PLAIN_TEMPLATE.exec(stripped))) {
    if (m[1].includes('\n') && looksLikeProse(m[1].replace(/\s+/g, ' '))) multilinePlain++;
  }

  TEMPLATE_COPY.lastIndex = 0;
  while ((m = TEMPLATE_COPY.exec(stripped))) {
    // Only templates whose STATIC halves carry words — `${a}-${b}` is machinery,
    // `Run ${when} — ${status}` is a sentence built from fragments (rule 2 of
    // strings.en.ts) and cannot be translated as one.
    const statics = m[1].replace(/\$\{[^}]*\}/g, ' ');
    const words = statics.split(' ').join(' ').match(/[A-Za-z؀-ۿ]{3,}/g) ?? [];
    if (words.length >= 2) template++;
  }

  return { exprAttr: Math.max(0, exprAttr), template, multilinePlain };
}

/* ---------------------------------------------------------------------------
 * Catalogue parity.
 *
 * THE COMMENT THAT USED TO STAND HERE SAID *"type-checking already forbids a
 * missing Arabic key"*. That is TRUE AT KEY GRANULARITY AND FALSE AT PLURAL-CLASS
 * GRANULARITY — which is the only granularity that is Arabic-specific, and the one
 * `entry.ts:25` itself documents as the thing English has no equivalent of.
 * `Plural` makes `zero/one/two/few/many` optional, so deleting the Arabic dual and
 * both plural forms of a count-bearing sentence compiled cleanly, passed the gate,
 * and did not move `arabic 212 (97%)` by one (M15 verdict item 3b). A count-bearing
 * Arabic sentence with no `two` renders the dual as the singular-genitive `other`,
 * which is not a near miss — it is the wrong word.
 *
 * So the parse below reads ENTRIES, not just keys:
 *
 *   'k': 'sentence'            scalar
 *   'k': { one: …, other: … }  plural — its declared classes are read
 *   'k': todo('English')       an admitted gap
 *
 * and every number this file prints is named for exactly what it counted.
 * ------------------------------------------------------------------------ */
const CATALOGUE_KEY = /^\s*'([^']+)'\s*:\s*(.*)$/;
const PLURAL_CLASS = /^\s*(zero|one|two|few|many|other)\s*:/;

/**
 * The five classes Arabic distinguishes for a nonzero count. `zero` is NOT here:
 * CLDR gives Arabic a `zero` class, but with none declared a count of 0 falls
 * through to `other` (singular genitive), which is the correct MSA form for zero.
 * Requiring it would be taste dressed as grammar. The three that are NOT optional
 * are `two` (the dual — English has no equivalent), `few` (3–10, plural genitive)
 * and `many` (11–99, singular accusative): each is a different word, and `other`
 * is the right answer for none of them.
 *
 * Any class ENGLISH declares is required on top, because a class English bothered
 * to separate is a copy decision, not a grammatical one, and it has to be answered.
 */
const AR_REQUIRED_CLASSES = ['one', 'two', 'few', 'many', 'other'];

/** Parse one catalogue file into `key -> {kind, classes}`. */
export function parseCatalogue(text) {
  const entries = new Map();
  const lines = stripComments(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CATALOGUE_KEY);
    if (!m) continue;
    const [, key, rest] = m;
    if (/^\{/.test(rest)) {
      const classes = [];
      let depth = 1;
      for (let j = i + 1; j < lines.length && depth > 0; j++) {
        depth += (lines[j].match(/[{[]/g) || []).length - (lines[j].match(/[}\]]/g) || []).length;
        if (depth <= 0) break;
        const c = lines[j].match(PLURAL_CLASS);
        if (c) classes.push(c[1]);
      }
      entries.set(key, { kind: 'plural', classes });
    } else if (/^todo\s*\(/.test(rest)) {
      entries.set(key, { kind: 'todo', classes: [] });
    } else {
      entries.set(key, { kind: 'scalar', classes: [] });
    }
  }
  return entries;
}

export function catalogueReport(enText, arText) {
  const enEntries = parseCatalogue(enText);
  const arEntries = parseCatalogue(arText);
  const enKeys = new Set(enEntries.keys());
  const arKeys = new Set(arEntries.keys());
  const missing = [...enKeys].filter((k) => !arKeys.has(k));
  const orphan = [...arKeys].filter((k) => !enKeys.has(k));

  /* A `todo(` CALL SITE, after comments are blanked. The old count was
   * `/\btodo\(/g` over the raw text, case-sensitive and anywhere in the file:
   * it scored four occurrences of the characters `todo()` inside PROSE COMMENTS
   * as untranslated keys, and missed the one genuine human marker `// TODO(ar):`
   * because that one is uppercase. Seven reported, three real — a declared value
   * read as an observed one, on a headline figure, moving in whichever direction
   * the prose happened to fall. Two different things, so now two counters. */
  const todoKeys = [...arEntries].filter(([, e]) => e.kind === 'todo').map(([k]) => k);
  const markers = (arText.match(/\bTODO\(ar\)/g) || []).length;

  /* Plural-class parity — the check nothing performed. */
  const pluralGaps = [];
  for (const [key, en] of enEntries) {
    if (en.kind !== 'plural') continue;
    const ar = arEntries.get(key);
    if (!ar || ar.kind === 'todo') continue; // missing / admitted, already counted
    if (ar.kind !== 'plural') {
      pluralGaps.push({ key, missing: ['(not a plural entry)'] });
      continue;
    }
    const required = new Set([...AR_REQUIRED_CLASSES, ...en.classes]);
    const gaps = [...required].filter((c) => !ar.classes.includes(c));
    if (gaps.length) pluralGaps.push({ key, missing: gaps });
  }

  const count = (entries, kind) => [...entries.values()].filter((e) => e.kind === kind).length;
  const classes = (entries) => [...entries.values()].reduce((n, e) => n + e.classes.length, 0);

  return {
    /* `keys` is what `strings` used to be called, and the rename is the point:
     * it counted catalogue keys and printed the word "strings", so 19 English and
     * 43 Arabic plural-class sentences were outside every number on the report. */
    keys: enKeys.size,
    pluralKeys: count(enEntries, 'plural'),
    enStrings: enKeys.size - count(enEntries, 'plural') + classes(enEntries),
    arStrings: arKeys.size - count(arEntries, 'plural') + classes(arEntries),
    enClasses: classes(enEntries),
    arClasses: classes(arEntries),
    missing,
    orphan,
    todos: todoKeys.length,
    todoKeys,
    markers,
    pluralGaps,
    translated: enKeys.size - missing.length - todoKeys.length,
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

/**
 * The categories this checker cannot judge, assembled for printing.
 *
 * `count: null` means *not measurable from source* — which is a different fact
 * from `count: 0` and must never print as one. That distinction is the whole
 * point of this block, and it is the same one `run-all.mjs` now draws between
 * "could not start" and "failed".
 */
async function blindSpots(seen) {
  const panelFiles = await readdir(join(ROOT, 'panels')).catch(() => []);
  let panelStrings = 0;
  for (const f of panelFiles.filter((n) => n.endsWith('.json'))) {
    const raw = await readFile(join(ROOT, 'panels', f), 'utf8').catch(() => '');
    panelStrings += (raw.match(/"(?:title|subtitle|label|caption|empty|hint|description)"\s*:\s*"[^"]+"/g) || [])
      .length;
  }

  return [
    {
      id: 'expression-attribute',
      count: seen.exprAttr,
      what: 'title={…} / aria-label={…} — the value is an expression, so there is no literal to read',
      why: 'the string may be catalogued, composed, or hardcoded three files away. Only a human can tell.',
    },
    {
      id: 'assembled-template',
      count: seen.template,
      what: '`…${x}…` template literals whose static halves carry words',
      why: 'a sentence built from fragments cannot be translated as one (strings.en.ts rule 2). Reported as a count, not a failure, because some are genuinely `${a} · ${b}` joins.',
    },
    {
      id: 'server-copy',
      count: null,
      what: 'English prose produced by the API and rendered verbatim',
      why: 'it is not in this tree. Known today: ledger.hint on /api/cost/today, rendered by CostTicker; run error messages via api-contracts.md. No scan of apps/web can find the next one.',
    },
    {
      id: 'multiline-plain-template',
      count: seen.multilinePlain,
      what: 'a backtick string with no ${} that Prettier broke across lines',
      why: 'a single-line one is now read as the string literal it is; the copy scan runs per line, so a wrapped one is not. Split so this zero is one the file went looking for rather than one it inherited.',
    },
    {
      /* SPLIT FROM `unscanned-roots` 2026-08-17. One id carried a count of ONE
       * root and a `why` naming three more with no count — a number that did not
       * name what it counted, which is the same defect as the two above it. */
      id: 'panels-json',
      count: panelStrings,
      what: `panels/*.json copy-bearing fields (${panelFiles.filter((n) => n.endsWith('.json')).length} files) — dashboards are data (§2.5), so their titles are copy in a data file`,
      why: 'measurable, and outside the walk. §2.5 makes a dashboard title copy that lives in a data file, so no scan of apps/web/src can reach it.',
    },
    {
      id: 'unscanned-roots',
      count: null,
      what: 'apps/runner/**, packages/** and agents/**/SKILL.md',
      why: 'this checker walks apps/web/src only. These roots have never been counted, and printing panels/*.json’s number beside their name made it look as though they had.',
    },
    {
      id: 'arabic-quality',
      count: null,
      what: 'whether the Arabic is right',
      why: 'catalogue parity proves a key exists, never that the register is MSA noun-form (§1.4), that the sentence is a rewrite rather than a translation, or that nothing was faux-italicised. A human reads it or nobody does.',
    },
  ];
}

/* ---------------------------------------------------------------------------
 * The ratchet — how this checker became a gate instead of a file.
 *
 * `check-rtl` exited 1 all session and was in no npm script that anything ran,
 * so four agents shipped uncatalogued copy and nothing objected. Putting it into
 * `verify` as-is would turn the build red for every agent on debt that predates
 * them, which gets the checker removed from `verify` within a day.
 *
 * So `--gate` (what `verify` runs) fails on **new** debt only, per rule and per
 * module. Existing debt is a scheduled migration with named owners; new debt is
 * a build failure. Raising a baseline number is a file edit somebody reviews,
 * which is the same reason `rtl-exempt:` markers are printed rather than silent.
 * ------------------------------------------------------------------------ */
const RATCHET_FILE = 'scripts/rtl-baseline.json';

/**
 * Rules the ratchet does not get a vote on.
 *
 * The ratchet asks *did this number go up*, which is the wrong question for a
 * property whose only acceptable value is zero. It holds as long as the count
 * does not rise — so **the moment a baseline ever RECORDS one of these, the gate
 * accepts it forever, and accepts a different one in its place.**
 *
 * Falsified rather than reasoned: with `missing-translation: 1` recorded in
 * `rtl-baseline.json`, deleting `'shell.tab.chart'` from `strings.ar.ts` gives
 * ratchet regressions `[]`, the word `holding`, and — before this set existed —
 * exit 0, with an English key untranslated. Baselines are hand-edited, so that is
 * one well-meant re-record away, which is the same distance the coverage gate's
 * bare-`—` guard was found to be.
 *
 * These four are not debt on a migration schedule with a named owner. They are
 * the catalogue disagreeing with itself, and there is no number of them that is
 * acceptable-for-now.
 */
const HARD_FAIL_RULES = new Set([
  'missing-catalogue',
  'missing-translation',
  'missing-plural-class',
  'orphan-translation',
]);

/** `apps/web/src/components/shell/x.tsx` → `components/shell`. The unit an owner owns. */
export function moduleOf(path) {
  const parts = path.replace(/\\/g, '/').replace(/^apps\/web\/src\//, '').split('/');
  return parts.length > 1 ? parts.slice(0, 2).join('/') : parts[0];
}

export function ratchetReport(current, baseline) {
  const regressions = [];
  const improvements = [];
  const compare = (scope, now, was) => {
    if (was === undefined) {
      // A module the baseline has never seen. Everything in it is new debt — a new
      // surface arriving uncatalogued is precisely the event this gate exists for.
      if (now > 0) regressions.push({ scope, was: 0, now });
      return;
    }
    if (now > was) regressions.push({ scope, was, now });
    else if (now < was) improvements.push({ scope, was, now });
  };

  compare('total', current.total, baseline.total);
  for (const rule of new Set([...Object.keys(current.byRule), ...Object.keys(baseline.byRule ?? {})])) {
    compare(`rule:${rule}`, current.byRule[rule] ?? 0, baseline.byRule?.[rule]);
  }
  for (const mod of new Set([...Object.keys(current.byModule), ...Object.keys(baseline.byModule ?? {})])) {
    compare(`module:${mod}`, current.byModule[mod] ?? 0, baseline.byModule?.[mod]);
  }
  return { baseline, regressions, improvements };
}

async function compareToBaseline(current) {
  let baseline;
  try {
    baseline = JSON.parse(await readFile(join(ROOT, RATCHET_FILE), 'utf8'));
  } catch {
    // No baseline is not "zero debt" and must not pass as it. Same distinction the
    // blind-spot block draws, applied to the gate's own input.
    return {
      baseline: { total: 0, recordedAt: 'never', sha: 'none', byRule: {}, byModule: {} },
      regressions: [{ scope: `${RATCHET_FILE} is missing`, was: 0, now: current.total }],
      improvements: [],
    };
  }
  return ratchetReport(current, baseline);
}

async function main() {
  const findings = [];
  const exemptions = [];
  const seen = { exprAttr: 0, template: 0, multilinePlain: 0 };
  let scanned = 0;

  for await (const file of walk(SCAN_DIR)) {
    const rel = relative(ROOT, file);
    const text = await readFile(file, 'utf8');
    const r = scanText(rel, text);
    findings.push(...r.findings);
    exemptions.push(...r.exemptions);
    if (r.blind) {
      seen.exprAttr += r.blind.exprAttr;
      seen.template += r.blind.template;
      seen.multilinePlain += r.blind.multilinePlain;
    }
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
    for (const { key, missing } of catalogue.pluralGaps) {
      findings.push({
        path: 'apps/web/src/i18n/strings.ar.ts',
        line: 0,
        rule: 'missing-plural-class',
        message: `"${key}" is count-bearing and its Arabic entry declares no ${missing.join(', ')}`,
        fix:
          'Arabic distinguishes one · two · few (3–10) · many (11–99) · other, and an undeclared class ' +
          'falls through to `other` — the singular genitive, which is the wrong word for a dual and for ' +
          '3–10. Write the class, or admit the whole key with todo(). See i18n/entry.ts.',
        text: '',
      });
    }
    for (const k of catalogue.orphan) {
      findings.push({
        path: 'apps/web/src/i18n/strings.ar.ts',
        line: 0,
        rule: 'orphan-translation',
        message: `key "${k}" exists in Arabic and not in English`,
        fix: 'delete it, or add the English key it is answering',
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
  const byModule = findings.reduce((acc, f) => ((acc[moduleOf(f.path)] = (acc[moduleOf(f.path)] || 0) + 1), acc), {});
  const blind = await blindSpots(seen);
  const gate = process.argv.includes('--gate');
  const ratchet = gate ? await compareToBaseline({ total: findings.length, byRule, byModule }) : null;
  const hardFails = findings.filter((f) => HARD_FAIL_RULES.has(f.rule));

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          provenance: provenanceLine(ROOT, 'apps/web'),
          scanned,
          findings,
          exemptions,
          catalogue,
          byRule,
          byModule,
          blind,
          ratchet,
        },
        null,
        2,
      ),
    );
  } else if (!process.argv.includes('--quiet')) {
    console.log(`\nRTL / i18n check`);
    console.log(`  scanned at        ${provenanceLine(ROOT, 'apps/web')}`);
    console.log(`  files scanned     ${scanned}`);
    if (catalogue) {
      const pct = catalogue.keys ? Math.round((catalogue.translated / catalogue.keys) * 100) : 0;
      // Every line below names what it counted. The line that used to stand here
      // said `strings 219` and counted KEYS, which put 19 English and 43 Arabic
      // plural-class sentences outside every number on this report.
      console.log(`  keys              ${catalogue.keys}  (${catalogue.pluralKeys} count-bearing)`);
      console.log(
        `  strings           en ${catalogue.enStrings} · ar ${catalogue.arStrings}` +
          `   (a plural key is one key and ${catalogue.enClasses}/${catalogue.arClasses} class sentences)`,
      );
      console.log(`  arabic            ${catalogue.translated} keys (${pct}%)`);
      console.log(
        `  admitted gaps     ${catalogue.todos} todo() · ${catalogue.markers} TODO(ar) note` +
          `${catalogue.markers === 1 ? '' : 's'} in comments`,
      );
    }
    console.log(`  findings          ${findings.length}`);
    console.log(`  exemptions        ${exemptions.length}`);

    console.log(`\n  Not looked at — this is what the number above does NOT cover.`);
    console.log(`  A category with a count is measurable and unjudgeable; "unknown" is`);
    console.log(`  not measurable from source at all. Neither is zero.`);
    for (const b of blind) {
      console.log(`    ${String(b.count ?? 'unknown').padStart(7)}  ${b.id} — ${b.what}`);
      console.log(`             ${b.why}`);
    }

    if (exemptions.length) {
      console.log(`\n  Exemptions in force — every one of these is a promise that the`);
      console.log(`  surface genuinely does not mirror. Read them; they should be few.`);
      for (const e of exemptions) console.log(`    ${e.path}:${e.line}  ${e.rule} — ${e.reason}`);
    }

    for (const f of findings.length && !gate ? findings : hardFails) {
      console.log(`\n  FAIL  ${f.path}:${f.line}  ${f.message}`);
      console.log(`        → ${f.fix}`);
    }

    if (hardFails.length) {
      console.log(`\n  ${hardFails.length} catalogue-integrity failure(s). The ratchet does not`);
      console.log(`  get a vote on these: they are not debt with an owner and a date, they are`);
      console.log(`  the catalogue disagreeing with itself. No baseline number excuses one.`);
    }

    if (ratchet) {
      console.log(`\n  Ratchet — ${RATCHET_FILE}`);
      console.log(`  baseline ${ratchet.baseline.total} recorded ${ratchet.baseline.recordedAt} · ${ratchet.baseline.sha}`);
      if (ratchet.regressions.length) {
        console.log(`\n  NEW DEBT. These went up since the baseline:`);
        for (const r of ratchet.regressions) console.log(`    ${r.scope}  ${r.was} → ${r.now}`);
        console.log(`\n  Run \`node scripts/check-rtl.mjs\` for the list. If the new strings are`);
        console.log(`  deliberate, catalogue them; a baseline is only ever raised by a person`);
        console.log(`  writing down why, in scripts/rtl-baseline.json.`);
      } else if (ratchet.improvements.length) {
        console.log(`  ${ratchet.improvements.length} scope(s) improved. Re-record the baseline so the`);
        console.log(`  ratchet holds the ground you just took.`);
        for (const r of ratchet.improvements) console.log(`    ${r.scope}  ${r.was} → ${r.now}`);
      } else {
        console.log(`  holding.`);
      }
    }
    console.log('');
  }

  if (gate) process.exit(hardFails.length || (ratchet && ratchet.regressions.length) ? 1 : 0);
  process.exit(findings.length ? 1 : 0);
}

// Run only when invoked directly; importing this file for tests must not exit.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
