/**
 * The redaction layer (spec Part VII.4, standing constraint 6).
 *
 * Everything that leaves the runner as observability data passes through `redact()`
 * first. Not the viewer. Not a Langfuse project setting. Here — in the process that
 * holds the data — so that a trace which was never written cannot be leaked.
 *
 * Pure and synchronous: no I/O, no imports beyond the rule list, so the redaction
 * test can hold the whole thing in one assertion.
 */

import {
  KEY_ALLOWLIST,
  KEY_DENYLIST,
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_STRING_LENGTH,
  VALUE_RULES,
  normaliseKey,
  placeholder,
} from './redaction-rules.ts';

export type RedactionHit = { rule: string; label: string; path: string };

export type RedactionResult<T = unknown> = {
  value: T;
  hits: RedactionHit[];
};

const DENY = new Set(KEY_DENYLIST.map(normaliseKey));
const ALLOW = new Set(KEY_ALLOWLIST.map(normaliseKey));

/**
 * Literal secret values read from the environment at module load.
 *
 * The regex rules catch key *shapes*. This catches the actual key, whatever shape it
 * has — including a rotated key with a format we have never seen. Belt and braces,
 * because "never log the API key" has to hold even when the format changes.
 */
const SECRET_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'LANGFUSE_SECRET_KEY',
  'LANGFUSE_PUBLIC_KEY',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'GITHUB_TOKEN',
  'SLACK_BOT_TOKEN',
];

let literalSecrets: string[] = [];

/** Re-read the environment. Called at module load and by tests. */
export function refreshEnvSecrets(env: Record<string, string | undefined> = process.env): void {
  literalSecrets = SECRET_ENV_VARS.map((name) => env[name])
    .filter((v): v is string => typeof v === 'string' && v.length >= 8)
    // longest first, so a key that contains another key's prefix is fully consumed
    .sort((a, b) => b.length - a.length);
}

refreshEnvSecrets();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply the value rules (and the literal-secret scrub) to one string. */
export function redactString(input: string, path: string, hits: RedactionHit[]): string {
  let out = input;

  for (const secret of literalSecrets) {
    if (out.includes(secret)) {
      out = out.replace(new RegExp(escapeRegExp(secret), 'g'), placeholder('credential'));
      hits.push({ rule: 'env_secret', label: 'credential', path });
    }
  }

  for (const rule of VALUE_RULES) {
    rule.pattern.lastIndex = 0;
    out = out.replace(rule.pattern, (match) => {
      if (rule.confirm && !rule.confirm(match)) return match;
      hits.push({ rule: rule.id, label: rule.label, path });
      return placeholder(rule.label);
    });
  }

  if (out.length > MAX_STRING_LENGTH) {
    out = `${out.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED ${out.length - MAX_STRING_LENGTH} chars]`;
    hits.push({ rule: 'max_length', label: 'truncated', path });
  }

  return out;
}

function walk(value: unknown, path: string, depth: number, hits: RedactionHit[], skipValueRules: boolean): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return skipValueRules ? value : redactString(value, path, hits);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'bigint') return value.toString();

  // A function, symbol or class instance in a trace payload is a bug upstream; drop it
  // rather than serialising whatever it happens to expose.
  if (typeof value === 'function' || typeof value === 'symbol') return placeholder('unsupported');

  if (value instanceof Date) return value.toISOString();

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, `${path}.message`, hits),
    };
  }

  if (depth >= MAX_DEPTH) {
    hits.push({ rule: 'max_depth', label: 'truncated', path });
    return placeholder('depth-limit');
  }

  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ARRAY_LENGTH);
    const out: unknown[] = kept.map((item, i) => walk(item, `${path}[${i}]`, depth + 1, hits, false));
    if (value.length > kept.length) {
      hits.push({ rule: 'max_array', label: 'truncated', path });
      out.push(`[TRUNCATED ${value.length - kept.length} items]`);
    }
    return out;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const norm = normaliseKey(key);
      const childPath = path ? `${path}.${key}` : key;

      if (DENY.has(norm)) {
        hits.push({ rule: `key:${norm}`, label: norm, path: childPath });
        out[key] = placeholder(norm);
        continue;
      }

      out[key] = walk(child, childPath, depth + 1, hits, ALLOW.has(norm) && typeof child === 'string');
    }
    return out;
  }

  return placeholder('unsupported');
}

/**
 * Redact an arbitrary payload. The returned value is a fresh structure — the caller's
 * object is never mutated, so a run's real inputs stay intact for the run itself.
 */
export function redact<T = unknown>(value: T, rootPath = ''): RedactionResult {
  const hits: RedactionHit[] = [];
  return { value: walk(value, rootPath, 0, hits, false), hits };
}

/** Convenience for the many places that only need the cleaned value. */
export function redacted<T>(value: T): unknown {
  return redact(value).value;
}
