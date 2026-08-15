/**
 * A deliberately small YAML front-matter reader for the **layout-relevant subset** of the
 * agent schema (Part IV / `comms/contracts/frontmatter-schema.md`).
 *
 * Scope, on purpose: top-level scalars, inline flow sequences (`[a, b]`) and block
 * sequences of scalars. Nested blocks (`ladder:`, `inputs:`, `deliver:`) are skipped —
 * the map does not read them, and `agent-library-curator` owns the real validator at
 * `scripts/validate-frontmatter.mjs`. If a file fails to parse, it is **excluded from the
 * map with a warning** rather than rendered half-parsed (frontmatter contract, §Validation).
 *
 * Zero dependencies, because `scripts/build-graph.mjs` must run on a bare clone (ADR-004).
 */

const LAYOUT_KEYS = new Set([
  'name',
  'description',
  'department',
  'cluster',
  'icon',
  'tier',
  'phase',
  'status',
  'breaks_into',
  'builds_on',
  'schedule',
  'approval',
]);

function unquote(v) {
  const s = v.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('[')) {
    const inner = s.slice(1, s.lastIndexOf(']'));
    return inner.trim() === '' ? [] : inner.split(',').map((x) => unquote(x)).filter((x) => x !== '');
  }
  if (s.startsWith('{')) return {}; // flow maps are not layout-relevant
  return unquote(s);
}

/**
 * @param {string} text full SKILL.md contents
 * @returns {Record<string, unknown> | null} null when there is no `---` front-matter block
 */
export function parseFrontmatter(text) {
  const src = text.replace(/^﻿/, '');
  if (!/^---\s*$/m.test(src.split(/\r?\n/, 1)[0] ?? '')) return null;

  const lines = src.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const out = {};
  let listKey = null;

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    const indented = /^\s/.test(line);

    if (indented) {
      const item = line.trim();
      if (listKey && item.startsWith('- ')) {
        const v = item.slice(2).trim();
        if (!v.startsWith('{')) out[listKey].push(parseScalar(v));
      }
      continue; // nested map lines: not layout-relevant, skipped
    }

    listKey = null;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/);
    if (!m) continue;

    const [, key, rest] = m;
    const value = rest.replace(/\s+#.*$/, '');

    if (value.trim() === '') {
      if (LAYOUT_KEYS.has(key)) {
        out[key] = [];
        listKey = key;
      }
      continue;
    }
    if (LAYOUT_KEYS.has(key)) out[key] = parseScalar(value);
  }

  return out;
}

/** Slug-safety for ids that end up in URLs and DOM ids. */
export function kebab(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
