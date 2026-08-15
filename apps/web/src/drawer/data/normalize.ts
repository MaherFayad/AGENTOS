/**
 * Normalising what the API hands back.
 *
 * The envelopes are now pinned by `comms/contracts/api-contracts.md`:
 *   `GET /api/agents/:slug` → `{slug, path, frontmatter, body, runnable}`
 *   `GET /api/runs`         → `{runs: [...]}`
 * so the guessing this file used to do is gone. It still accepts the flat forms
 * (frontmatter at the top level, a bare array of runs) because a normaliser that tolerates
 * a shape it is not surprised by costs four lines and saves an afternoon.
 *
 * Anything that cannot be read as an agent throws, so the drawer can say so in a sentence
 * instead of rendering a half-parsed agent (Part IV validation rule). The three fields it
 * refuses to guess are `name`, `department` and `tier` — the title, the breadcrumb and the
 * autonomy eyebrow. Everything else is optional and collapses (§2.3).
 *
 * Owner: drawer-engineer
 */

import type { AgentDoc, AgentFrontmatter, RunRow, RunStatus, Runnable } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class AgentParseError extends Error {}

/** Accepts `{slug, frontmatter, …}` or a flat frontmatter object with an optional `body`. */
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

  return {
    slug,
    path: typeof raw.path === 'string' ? raw.path : undefined,
    frontmatter,
    body,
    runnable: normalizeRunnable(raw.runnable),
  };
}

/**
 * `runnable` is *derived by the runner* (allowlist, missing connectors, approval gate,
 * schedule) precisely so the drawer does not re-derive it. An older runner that does not
 * send it yields `undefined`, and the drawer falls back to frontmatter for the two facts
 * it can see for itself — it never fabricates `missingConnectors`, because an empty array
 * would read as "everything is wired", which is a claim we would not have checked.
 */
export function normalizeRunnable(raw: unknown): Runnable | undefined {
  if (!isRecord(raw)) return undefined;
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  return {
    tools: strings(raw.tools),
    missingConnectors: strings(raw.missingConnectors),
    approvalRequired: raw.approvalRequired === true,
    scheduled: raw.scheduled === true,
  };
}

const RUN_STATUS: RunStatus[] = ['queued', 'running', 'awaiting-approval', 'ok', 'error', 'denied', 'canceled'];

/**
 * Accepts `{runs: []}` or a bare `[]`. Rows carrying no recognised status are dropped
 * rather than guessed — an unknown status rendered as a grey dot is a run whose outcome we
 * have quietly invented. `null` costs and durations become `undefined`, which is the
 * drawer's word for "there is nothing to print here" (Part VII.3).
 */
export function normalizeRuns(raw: unknown, limit = 5): RunRow[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.runs) ? raw.runs : [];
  const rows: RunRow[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const status = RUN_STATUS.find((s) => s === item.status);
    if (!status) continue;
    rows.push({
      runId: typeof item.runId === 'string' ? item.runId : undefined,
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
