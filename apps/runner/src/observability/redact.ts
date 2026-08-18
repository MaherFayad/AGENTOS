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
import { NO_WITHHELD, WITHHELD_LABEL, type Withheld } from './withhold.ts';

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

/**
 * `key: value` and `key=value` inside a *string*, so the key denylist survives flattening.
 *
 * The gap this closes, stated as the demonstration that found it. `redact({client_name:
 * 'Fatima Al-Harbi'})` yields `[REDACTED:clientname]` — the key pass fires. Flatten the
 * same object into prose first, which `buildPlanSummary` does before the runner traces it
 * as `event:plan`, and you get:
 *
 *   `- client_name: Fatima Al-Harbi · - address: 12 King Fahd Road, Riyadh ·
 *    - date_of_birth: 1990-04-12 · - salary: 45000 SAR · - contact_email: [REDACTED:email]`
 *
 * Four of the five denylisted keys survive. Only the email is caught, and only because
 * its *value* happens to have a shape a regex knows. The key pass walks object keys, and a
 * string has none — so **flattening a payload into prose was a way of getting it past the
 * redactor**, which is the same defect `runner-engineer` fixed in the cross-project
 * approvals queue, arriving here under a different name.
 *
 * Deliberately blunt, in the safe direction. A match runs to the next `·`, `;`, `|`,
 * newline, or end of string — **not** to the next comma, because "address: 12 King Fahd
 * Road, Riyadh" must not leave "Riyadh" behind. That over-redacts an ordinary sentence
 * containing "email: " and that is the trade taken on purpose: over-redaction costs a
 * legible trace, under-redaction costs a client's data, and there is no unredact path.
 *
 * No rule was added or loosened. This applies `KEY_DENYLIST` — unchanged, co-owned with
 * `rtl-arabic-pdpl-specialist` — to a surface it previously could not see. The pass can
 * only ever redact more than before, never less.
 */
const KEY_SEPARATOR = /([A-Za-z][A-Za-z0-9_\- ]{0,40})[ \t]*[:=][ \t]*/g;
/** A value runs until one of these, or the end of the string. Note: not a comma. */
const VALUE_END = /[\n·;|]/;

/**
 * `Primary contact email` is three words and only the last one is denylisted, so a run of
 * words is tested suffix-first. Longest suffix wins, which keeps `client_name` matching
 * `clientname` rather than the bare `name` (which is deliberately *not* denylisted).
 */
function deniedSuffix(run: string): string | null {
  const tokens = run.trim().split(/[\s_\-]+/).filter(Boolean);
  for (let i = Math.max(0, tokens.length - 3); i < tokens.length; i++) {
    const norm = normaliseKey(tokens.slice(i).join(''));
    if (DENY.has(norm)) return norm;
  }
  return null;
}

function redactKeysInString(
  input: string,
  path: string,
  hits: RedactionHit[],
  withheld: Withheld,
): string {
  KEY_SEPARATOR.lastIndex = 0;
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  // Scanned rather than `String.replace`d on purpose. `replace` consumes the value it
  // matched, so `notes: whatever address: 12 King Fahd Rd` would have the outer,
  // permitted `notes` swallow the inner, denylisted `address` and never test it.
  // Resuming the scan immediately after each separator means every key gets asked.
  while ((match = KEY_SEPARATOR.exec(input)) !== null) {
    const norm = deniedSuffix(match[1]);
    if (!norm) continue;

    const valueStart = match.index + match[0].length;
    const offset = input.slice(valueStart).search(VALUE_END);
    let valueEnd = offset === -1 ? input.length : valueStart + offset;
    // Give back trailing spaces so ` · ` keeps its spacing and the line still reads.
    while (valueEnd > valueStart && input[valueEnd - 1] === ' ') valueEnd -= 1;
    if (valueEnd === valueStart) continue;

    // The key stays visible: *which* field was redacted is operationally useful and is
    // not itself client data. Only the value goes.
    //
    // The value is also registered as withheld before it is dropped, so the *same* text
    // arriving later in this run under no key at all — in an error message, in a composed
    // frame — is caught by characters instead of by a key it no longer has.
    withheld.add(input.slice(valueStart, valueEnd));
    out += input.slice(cursor, valueStart) + placeholder(norm);
    cursor = valueEnd;
    KEY_SEPARATOR.lastIndex = valueEnd;
    hits.push({ rule: `key-in-string:${norm}`, label: norm, path });
  }

  return out + input.slice(cursor);
}

/** Apply the key-in-string pass, the value rules and the literal-secret scrub to one string. */
export function redactString(
  input: string,
  path: string,
  hits: RedactionHit[],
  withheld: Withheld = NO_WITHHELD,
): string {
  let out = input;

  for (const secret of literalSecrets) {
    if (out.includes(secret)) {
      out = out.replace(new RegExp(escapeRegExp(secret), 'g'), placeholder('credential'));
      hits.push({ rule: 'env_secret', label: 'credential', path });
    }
  }

  // Withheld literals run before every rule below, because they are the only pass that does
  // not need the text to have kept a shape. A body interpolated into an error string has no
  // key for the key pass and no pattern for the value pass; it still has its characters.
  const scrubbed = withheld.scrub(out);
  out = scrubbed.out;
  for (let i = 0; i < scrubbed.count; i++) {
    hits.push({ rule: 'withheld_literal', label: WITHHELD_LABEL, path });
  }

  // Before the value rules: a denylisted key's value goes whatever shape it has, and the
  // value rules should then only see what survived.
  out = redactKeysInString(out, path, hits, withheld);

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

function walk(
  value: unknown,
  path: string,
  depth: number,
  hits: RedactionHit[],
  skipValueRules: boolean,
  withheld: Withheld,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (!skipValueRules) return redactString(value, path, hits, withheld);
    // `KEY_ALLOWLIST` exempts a string from the *value rules*, because a pattern written for
    // an IBAN means nothing on a model name. It does not exempt it from the withheld
    // register, which matches characters rather than shapes: an allowlist is a decision to
    // be blind to everything it names, and "the leak was in a field we had allowlisted" is
    // that decision's bill.
    const scrubbed = withheld.scrub(value);
    for (let i = 0; i < scrubbed.count; i++) {
      hits.push({ rule: 'withheld_literal', label: WITHHELD_LABEL, path });
    }
    return scrubbed.out;
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
      message: redactString(value.message, `${path}.message`, hits, withheld),
    };
  }

  if (depth >= MAX_DEPTH) {
    hits.push({ rule: 'max_depth', label: 'truncated', path });
    return placeholder('depth-limit');
  }

  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ARRAY_LENGTH);
    const out: unknown[] = kept.map((item, i) =>
      walk(item, `${path}[${i}]`, depth + 1, hits, false, withheld),
    );
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

      out[key] = walk(
        child,
        childPath,
        depth + 1,
        hits,
        ALLOW.has(norm) && typeof child === 'string',
        withheld,
      );
    }
    return out;
  }

  return placeholder('unsupported');
}

/**
 * Register every denylisted key's *string* value before anything is rewritten.
 *
 * A separate pass rather than a line inside `walk`, and the reason is an ordering bug that
 * would otherwise be silent. `redact({ body: X, note: 'halted: ' + X })` walks its keys in
 * insertion order; registering during the walk means the same payload with the keys the
 * other way round leaks. A defence whose result depends on `Object.entries` order is a
 * defence that works on the example it was written against.
 *
 * The trade this takes is the file's existing one, stated at `KEY_SEPARATOR`:
 * over-redaction costs a legible trace, under-redaction costs a client's data, and there is
 * no unredact path. So `{ auth: 'not required' }` does make the string "not required"
 * disappear elsewhere in the same run. That is the price, it is bounded by one run, and it
 * is the right way round.
 */
function collectWithheld(value: unknown, depth: number, withheld: Withheld): void {
  if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) return;

  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_ARRAY_LENGTH)) collectWithheld(item, depth + 1, withheld);
    return;
  }
  if (value instanceof Date || value instanceof Error) return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DENY.has(normaliseKey(key)) && typeof child === 'string') withheld.add(child);
    else collectWithheld(child, depth + 1, withheld);
  }
}

/**
 * Redact an arbitrary payload. The returned value is a fresh structure — the caller's
 * object is never mutated, so a run's real inputs stay intact for the run itself.
 *
 * `withheld` is the run's literal register (`withhold.ts`). Omitted, redaction behaves
 * exactly as it did before that file existed — which is what every caller outside
 * `instrument.ts` wants, and what keeps `redact()` a pure function in tests.
 */
export function redact<T = unknown>(
  value: T,
  rootPath = '',
  withheld: Withheld = NO_WITHHELD,
): RedactionResult {
  const hits: RedactionHit[] = [];
  if (withheld !== NO_WITHHELD) collectWithheld(value, 0, withheld);
  return { value: walk(value, rootPath, 0, hits, false, withheld), hits };
}

/** Convenience for the many places that only need the cleaned value. */
export function redacted<T>(value: T): unknown {
  return redact(value).value;
}
