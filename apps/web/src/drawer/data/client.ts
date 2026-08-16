/**
 * The drawer's reads and writes. Every route here is quoted from
 * `comms/contracts/api-contracts.md` (owner: `runner-engineer`); none is invented.
 *
 * Failures come back as a sentence, not an exception type the UI has to decode — the
 * drawer's job is to tell the truth about what it could not reach.
 *
 * Owner: drawer-engineer
 */

import { API_BASE } from '../run/transport';
import { normalizeAgentDoc, normalizeRuns } from './normalize';
import type { AgentDoc, RunRow } from './types';

export interface ApiFailure {
  message: string;
  hint?: string;
}

export class ApiCallError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'ApiCallError';
    this.hint = hint;
  }
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { signal, headers: { accept: 'application/json' } });
  } catch {
    throw new ApiCallError('Could not reach the runner.');
  }
  if (!response.ok) {
    let message = `The runner answered ${response.status}.`;
    let hint: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; hint?: string } };
      if (body?.error?.message) message = body.error.message;
      hint = body?.error?.hint;
    } catch {
      /* keep the status-line message */
    }
    throw new ApiCallError(message, hint);
  }
  return response.json();
}

async function postJson(path: string, payload: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiCallError('Could not reach the runner.');
  }
  if (!response.ok) {
    let message = `The runner answered ${response.status}.`;
    let hint: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; hint?: string } };
      if (body?.error?.message) message = body.error.message;
      hint = body?.error?.hint;
    } catch {
      /* keep the status-line message */
    }
    throw new ApiCallError(message, hint);
  }
  return response.json().catch(() => ({}));
}

/**
 * `:slug` is `department/agent-slug` and **contains a slash on purpose** — the route is
 * "a wildcard match on everything after `/api/agents/`" (api-contracts.md, Reads). So the
 * separator must survive, and everything either side of it must not.
 *
 * `encodeURIComponent(slug)` would be wrong: it turns the separator into `%2F` and, while
 * the runner's `slugParam` happens to decode that back, it makes the URL disagree with the
 * contract's own example. Encoding each segment keeps the path shape the contract
 * describes while still escaping a `?`, `#`, `%` or space if a folder name ever grows one
 * — the runner's `decodeURIComponent` throws a URIError on a stray `%`, which would
 * surface to the drawer as an unexplained 500.
 */
function slugPath(slug: string): string {
  return slug.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/** `GET /api/agents/:slug` — parsed frontmatter + body. */
export async function fetchAgent(slug: string, signal?: AbortSignal): Promise<AgentDoc> {
  return normalizeAgentDoc(await getJson(`/api/agents/${slugPath(slug)}`, signal), slug);
}

/**
 * `GET /api/metrics/runs?agent=&limit=5` — the LAST RUNS rows
 * (owner: `observability-engineer`, `comms/specs/observability.md`).
 *
 * **Not `GET /api/runs`.** That route is the runner's *in-memory* queue view
 * (`services.store.list()`), so it holds only what the current runner process executed and
 * is empty after every restart — LAST RUNS could never show history, and the blank would
 * come back on every deploy even once a real API key is set. `/api/metrics/runs` is the
 * durable ledger (`ops.agent_runs` in Postgres): same row shape plus `costSource` and
 * `traceUrl`, `startedAt` as ISO 8601 so relative time still stays live without polling.
 *
 * The `agent=` filter is server-side (`lastRuns(db, {agent}, limit)`), so this asks for
 * five rows and receives five rows — no client-side filtering of a wide page, which would
 * silently show four rows for a busy agent. `limit` is clamped to 50 upstream.
 *
 * `/api/runs` is still the right read for anything about *this process* — the live queue,
 * a run that has not been flushed to the ledger yet. It is simply not history.
 */
export async function fetchRuns(slug: string, limit = 5, signal?: AbortSignal): Promise<RunRow[]> {
  return normalizeRuns(
    await getJson(`/api/metrics/runs?agent=${encodeURIComponent(slug)}&limit=${limit}`, signal),
    limit,
  );
}

/** `POST /api/schedule` — writes `schedule:` into frontmatter via a git commit. */
export async function postSchedule(slug: string, cron: string): Promise<{ ok?: boolean; nextRunAt?: string; commitSha?: string }> {
  return (await postJson('/api/schedule', { agent: slug, cron })) as { ok?: boolean; nextRunAt?: string; commitSha?: string };
}

/** `POST /api/approvals/:runId` — resumes or aborts a run paused at its plan. */
export async function postApproval(runId: string, decision: 'approve' | 'deny', note?: string): Promise<void> {
  await postJson(`/api/approvals/${encodeURIComponent(runId)}`, { decision, ...(note ? { note } : {}) });
}

/**
 * `GET /api/status` — `{tailscale, queueDepth}`. Used only to answer "is the runner
 * there?", so ▶ Run can be honestly enabled or honestly disabled.
 */
export async function fetchRunnerStatus(
  signal?: AbortSignal,
): Promise<{ tailscale?: string; queueDepth?: number; runnerConfigured?: boolean }> {
  return (await getJson('/api/status', signal)) as {
    tailscale?: string;
    queueDepth?: number;
    runnerConfigured?: boolean;
  };
}

/**
 * `Take it ↓` — the SKILL.md folder as a zip.
 *
 * NOT IN THE CONTRACT YET. A `decision-request` is open with `runner-engineer` for
 * `GET /api/agents/:slug/download`. Until it is answered the button is disabled with a
 * tooltip that says so, rather than linking at a 404.
 */
export const DOWNLOAD_ROUTE_AGREED = false;

export function downloadUrl(slug: string): string {
  return `${API_BASE}/api/agents/${slugPath(slug)}/download`;
}
