import { isDepartment, PHASES, TIERS, type Phase, type Tier } from './contracts';
import type { AgentRecord } from './agents';

/**
 * Layout-relevant subset of a SKILL.md, enough to project a `ChartAgent`.
 * Nested blocks (`ladder`, `inputs`, `deliver`) are skipped — CHART does not read them.
 * A file that does not parse is excluded, never half-rendered (frontmatter-schema.md,
 * Validation).
 */

const CHART_KEYS = new Set([
  'name',
  'description',
  'department',
  'icon',
  'tier',
  'phase',
  'breaks_into',
]);

function unquote(value: string): string {
  const s = value.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('[')) {
    const close = s.lastIndexOf(']');
    const inner = close >= 0 ? s.slice(1, close) : s.slice(1);
    return inner.trim() === '' ? [] : inner.split(',').map((x) => unquote(x)).filter((x) => x !== '');
  }
  if (s.startsWith('{')) return {};
  return unquote(s);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

/** Parse SKILL.md text into the frontmatter projection CHART consumes, or `null`. */
export function parseSkillMarkdown(text: string, slug: string): AgentRecord | null {
  const src = text.replace(/^\uFEFF/, '');
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

  const out: Record<string, unknown> = {};
  let listKey: string | null = null;

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    if (/^\s/.test(line)) {
      const item = line.trim();
      if (listKey && item.startsWith('- ') && Array.isArray(out[listKey])) {
        const v = item.slice(2).trim();
        if (!v.startsWith('{')) (out[listKey] as unknown[]).push(parseScalar(v));
      }
      continue;
    }

    listKey = null;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/);
    if (!m) continue;

    const key = m[1];
    const value = m[2].replace(/\s+#.*$/, '');

    if (value.trim() === '') {
      if (CHART_KEYS.has(key)) {
        out[key] = [];
        listKey = key;
      }
      continue;
    }
    if (CHART_KEYS.has(key)) out[key] = parseScalar(value);
  }

  const name = asString(out.name);
  const description = asString(out.description);
  const department = asString(out.department);
  const icon = asString(out.icon);
  const tier = asString(out.tier);
  const phase = asString(out.phase);

  if (!name || !description || !icon) return null;
  if (!isDepartment(department) || !isTier(tier) || !isPhase(phase)) return null;

  const pathDepartment = slug.split('/')[0];
  if (pathDepartment !== department) return null;

  return {
    slug,
    frontmatter: {
      name,
      description,
      department,
      icon,
      tier,
      phase,
      breaks_into: asStringArray(out.breaks_into),
    },
  };
}
