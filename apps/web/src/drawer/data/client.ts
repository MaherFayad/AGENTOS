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

/** `GET /api/agents/:slug` — parsed frontmatter + body. */
export async function fetchAgent(slug: string, signal?: AbortSignal): Promise<AgentDoc> {
  return normalizeAgentDoc(await getJson(`/api/agents/${slug}`, signal), slug);
}

/** `GET /api/runs?agent=&limit=5` — the LAST RUNS rows (owner: `observability-engineer`). */
export async function fetchRuns(slug: string, limit = 5, signal?: AbortSignal): Promise<RunRow[]> {
  return normalizeRuns(await getJson(`/api/runs?agent=${encodeURIComponent(slug)}&limit=${limit}`, signal), limit);
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
export async function fetchRunnerStatus(signal?: AbortSignal): Promise<{ tailscale?: string; queueDepth?: number }> {
  return (await getJson('/api/status', signal)) as { tailscale?: string; queueDepth?: number };
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
  return `${API_BASE}/api/agents/${slug}/download`;
}
