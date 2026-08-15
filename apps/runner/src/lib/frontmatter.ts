/**
 * Frontmatter parsing for `agents/**​/SKILL.md` (Part IV, `contracts/frontmatter-schema.md`).
 *
 * Deliberately a small, dependency-free parser rather than a YAML library. Two reasons:
 * the runner's `package.json` belongs to `infra-compose-engineer` and adding a dependency
 * to it mid-milestone is a cross-owner edit; and the schema contract uses a fixed, small
 * subset of YAML (scalars, flow sequences, flow maps, one level of block nesting, a block
 * sequence of flow maps) that is cheaper to parse exactly than to parse generally.
 *
 * It fails loudly on anything outside that subset. A half-parsed agent must never reach
 * the map — the schema contract says such a file is *excluded* with a warning, and a
 * parser that guesses would turn that rule into a lie.
 */

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  /** Everything after the closing `---`: the agent's system prompt body. */
  body: string;
  /** Raw text between the fences, byte-for-byte. Used for surgical edits. */
  raw: string;
}

const FENCE = '---';

export class FrontmatterError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`${message} (line ${line + 1})`);
    this.name = 'FrontmatterError';
    this.line = line;
  }
}

/** Split a flow collection body on top-level commas, respecting quotes and nesting. */
function splitFlow(input: string, line: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let current = '';
  for (const ch of input) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    if (ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (quote) throw new FrontmatterError('Unterminated quote', line);
  if (depth !== 0) throw new FrontmatterError('Unbalanced [ ] or { }', line);
  if (current.trim() !== '') parts.push(current);
  return parts.map((p) => p.trim());
}

/** Strip an unquoted trailing `# comment`. Quoted `#` (e.g. a Slack channel) survives. */
function stripComment(input: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(input[i - 1] ?? ''))) {
      return input.slice(0, i);
    }
  }
  return input;
}

function parseScalar(rawValue: string, line: number): unknown {
  const value = stripComment(rawValue).trim();
  if (value === '') return '';

  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    return value.slice(1, -1);
  }

  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new FrontmatterError('Unclosed flow sequence', line);
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner, line).map((item) => parseScalar(item, line));
  }

  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new FrontmatterError('Unclosed flow mapping', line);
    const inner = value.slice(1, -1).trim();
    const out: Record<string, unknown> = {};
    if (inner === '') return out;
    for (const pair of splitFlow(inner, line)) {
      const idx = pair.indexOf(':');
      if (idx === -1) throw new FrontmatterError(`Flow mapping entry "${pair}" has no ":"`, line);
      const key = parseScalar(pair.slice(0, idx), line);
      out[String(key)] = parseScalar(pair.slice(idx + 1), line);
    }
    return out;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isBlank = (line: string): boolean => line.trim() === '' || line.trim().startsWith('#');

/** Parse a block (mapping or sequence) at `indent`, returning the value and next index. */
function parseBlock(lines: string[], start: number, indent: number): [unknown, number] {
  let i = start;
  while (i < lines.length && isBlank(lines[i] as string)) i += 1;
  if (i >= lines.length || indentOf(lines[i] as string) < indent) return ['', start];

  const isSequence = (lines[i] as string).trimStart().startsWith('- ');
  return isSequence ? parseSequence(lines, i, indent) : parseMapping(lines, i, indent);
}

function parseSequence(lines: string[], start: number, indent: number): [unknown[], number] {
  const items: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (isBlank(line)) {
      i += 1;
      continue;
    }
    const currentIndent = indentOf(line);
    if (currentIndent < indent) break;
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('- ')) {
      throw new FrontmatterError('Expected a "- " sequence item', i);
    }
    const rest = trimmed.slice(2).trim();
    if (rest === '') {
      const [value, next] = parseBlock(lines, i + 1, currentIndent + 2);
      items.push(value);
      i = next;
    } else {
      items.push(parseScalar(rest, i));
      i += 1;
    }
  }
  return [items, i];
}

function parseMapping(
  lines: string[],
  start: number,
  indent: number,
): [Record<string, unknown>, number] {
  const out: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (isBlank(line)) {
      i += 1;
      continue;
    }
    const currentIndent = indentOf(line);
    if (currentIndent < indent) break;
    const trimmed = line.trimStart();
    if (trimmed.startsWith('- ')) break;

    const sep = trimmed.indexOf(':');
    if (sep === -1) throw new FrontmatterError(`Line "${trimmed}" is not "key: value"`, i);
    const key = trimmed.slice(0, sep).trim();
    const rest = trimmed.slice(sep + 1).trim();

    if (stripComment(rest).trim() === '') {
      // Value is a nested block on the following lines — or genuinely empty.
      let peek = i + 1;
      while (peek < lines.length && isBlank(lines[peek] as string)) peek += 1;
      if (peek < lines.length && indentOf(lines[peek] as string) > currentIndent) {
        const [value, next] = parseBlock(lines, peek, indentOf(lines[peek] as string));
        out[key] = value;
        i = next;
        continue;
      }
      out[key] = '';
      i += 1;
      continue;
    }

    out[key] = parseScalar(rest, i);
    i += 1;
  }
  return [out, i];
}

/**
 * Parse a SKILL.md. Throws `FrontmatterError` when the file has no frontmatter fence or
 * the block is outside the supported subset — callers turn that into `invalid_frontmatter`.
 */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  const normalised = source.replace(/^﻿/, '');
  const lines = normalised.split(/\r?\n/);

  let firstFence = 0;
  while (firstFence < lines.length && lines[firstFence]?.trim() === '') firstFence += 1;
  if (lines[firstFence]?.trim() !== FENCE) {
    throw new FrontmatterError('File does not start with a --- frontmatter fence', firstFence);
  }

  let closing = -1;
  for (let i = firstFence + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === FENCE) {
      closing = i;
      break;
    }
  }
  if (closing === -1) throw new FrontmatterError('Frontmatter fence is never closed', firstFence);

  const block = lines.slice(firstFence + 1, closing);
  const [data] = parseMapping(block, 0, 0);

  return {
    data,
    body: lines.slice(closing + 1).join('\n').replace(/^\n+/, ''),
    raw: block.join('\n'),
  };
}

/**
 * Set (or remove, with `null`) the `schedule:` key, touching **only** that line.
 *
 * A parse-and-re-serialise round trip would reformat quoting, key order and comments
 * across the whole file, which would make every schedule change an unreviewable diff in
 * the git history that §3.2 relies on as the audit trail. So this is a line edit: replace
 * the existing `schedule:` line in place, or insert one immediately before the closing
 * fence. Every other byte of the file is preserved.
 */
export function setScheduleInSource(source: string, cron: string | null): string {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);

  let firstFence = 0;
  while (firstFence < lines.length && lines[firstFence]?.trim() === '') firstFence += 1;
  if (lines[firstFence]?.trim() !== FENCE) {
    throw new FrontmatterError('File does not start with a --- frontmatter fence', firstFence);
  }
  let closing = -1;
  for (let i = firstFence + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === FENCE) {
      closing = i;
      break;
    }
  }
  if (closing === -1) throw new FrontmatterError('Frontmatter fence is never closed', firstFence);

  const existing = lines.findIndex(
    (line, idx) => idx > firstFence && idx < closing && /^schedule\s*:/.test(line.trimStart()),
  );

  if (cron === null) {
    if (existing === -1) return source;
    lines.splice(existing, 1);
    return lines.join(eol);
  }

  const rendered = `schedule: "${cron}"`;
  if (existing === -1) {
    lines.splice(closing, 0, rendered);
  } else {
    lines[existing] = rendered;
  }
  return lines.join(eol);
}
