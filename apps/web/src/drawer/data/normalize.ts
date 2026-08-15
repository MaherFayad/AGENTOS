/**
 * Normalising what the API hands back.
 *
 * `comms/contracts/api-contracts.md` says `GET /api/agents/:slug` returns "parsed
 * frontmatter + body" and `GET /api/runs` returns the LAST RUNS rows, without pinning the
 * envelope. Rather than guess one shape and break on the other, the drawer accepts both
 * the wrapped (`{frontmatter, body}`) and the flat (frontmatter fields at the top level)
 * form, and both `[]` and `{runs: []}`. A question is filed with `runner-engineer`; when
 * it is answered this file loses a branch, not a feature.
 *
 * Anything that cannot be read as an agent throws, so the drawer can say so in a sentence
 * instead of rendering a half-parsed agent (Part IV validation rule).
 *
 * Owner: drawer-engineer
 */

import type { AgentDoc, AgentFrontmatter, RunRow } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class AgentParseError extends Error {}

/** Accepts `{slug, frontmatter, body}` or a flat frontmatter object with an optional `body`. */
export function normalizeAgentDoc(raw: unknown, slugHint?: string): AgentDoc {
  if (!isRecord(raw)) throw new AgentParseError('The agent response was not an object.');

  const wrapped = isRecord(raw.frontmatter) ? (raw.frontmatter as Record<string, unknown>) : null;
  const source = wrapped ?? raw;

  const name = typeof source.name === 'string' ? source.name : null;
  const department = typeof source.department === 'string' ? source.department : null;
  if (!name) throw new AgentParseError('The agent response has no `name`.');
  if (!department) throw new AgentParseError(`"${name}" has no \`department\` — Part IV requires one.`);

  const slug =
    (typeof raw.slug === 'string' && raw.slug) ||
    (typeof source.slug === 'string' && (source.slug as string)) ||
    slugHint ||
    `${department}/${name.toLowerCase().replace(/\s+/g, '-')}`;

  const frontmatter = { ...(source as unknown as AgentFrontmatter) };
  // `tier` drives the eyebrow and THE LADDER. A missing one is a validation failure
  // upstream; the drawer refuses rather than silently claiming "human-led".
  if (frontmatter.tier !== 'human-led' && frontmatter.tier !== 'assisted' && frontmatter.tier !== 'autonomous') {
    throw new AgentParseError(`"${name}" has no valid \`tier\` — the autonomy eyebrow has nothing to say.`);
  }

  const body = typeof raw.body === 'string' ? raw.body : typeof source.body === 'string' ? (source.body as string) : undefined;

  return { slug, frontmatter, body };
}

const RUN_STATUS: RunRow['status'][] = ['ok', 'error', 'running', 'awaiting-approval'];

/** Accepts `[]` or `{runs: []}`. Rows that carry no status at all are dropped, not guessed. */
export function normalizeRuns(raw: unknown, limit = 5): RunRow[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.runs) ? raw.runs : [];
  const rows: RunRow[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const status = RUN_STATUS.find((s) => s === item.status);
    if (!status) continue;
    rows.push({
      runId: typeof item.runId === 'string' ? item.runId : undefined,
      relativeTime: typeof item.relativeTime === 'string' ? item.relativeTime : undefined,
      startedAt: typeof item.startedAt === 'string' ? item.startedAt : undefined,
      status,
      costUsd: typeof item.costUsd === 'number' ? item.costUsd : undefined,
      durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
      traceUrl: typeof item.traceUrl === 'string' ? item.traceUrl : undefined,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}
