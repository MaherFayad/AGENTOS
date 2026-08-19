/**
 * The drawer's reads and writes. Every route here is quoted from
 * `comms/contracts/api-contracts.md` (owner: `runner-engineer`); none is invented.
 *
 * Failures come back as a sentence, not an exception type the UI has to decode — the
 * drawer's job is to tell the truth about what it could not reach.
 *
 * ---
 *
 * ## Every path is built from the route table, not typed here (M15, ADR-015)
 *
 * M15 moved every project-shaped route under `/api/p/:project`. This file held five paths
 * as string literals, so nothing broke at build time and nothing failed legibly at run
 * time: `GET /api/agents/:slug` began answering **400 `project_scope_missing`** and the
 * drawer rendered that as *"this agent could not be loaded"* — a sentence about the agent,
 * for a fault in the address. The drawer could not open an agent or start a run against a
 * current runner for a day, and no test, type or screen said so.
 *
 * A literal is what made that possible, so there is no longer one to type: the paths come
 * from `RUNNER_ROUTES`, the same table the server mounts from, the same shape as
 * `map/data/socket.ts`. The next time a route moves, this file moves with it or fails to
 * compile.
 *
 * **`null` project means *do not ask*, never *ask the unscoped one*.** The pre-project
 * paths are still mounted and refuse by name so the migration stays visible
 * (`LEGACY_UNSCOPED_PATHS`); falling back to one would convert that deliberate 400 into a
 * shrug, and a 400 swallowed by a fallback is exactly how this stayed invisible.
 *
 * Owner: drawer-engineer
 */

import {
  PROJECT_ROUTE_PREFIX,
  RUNNER_ROUTES,
  type DiffPage,
  type PostThreadMessageResponse,
  type WorkProductListResponse,
  type WorkProductResponse,
} from '@agnetos/contracts';
import { NO_PROJECT_SENTENCE, projectApiUrl } from '@/components/shell/useSearchIndex';
import { API_BASE } from '../run/transport';
import type { ComposableLevel } from '../threads/mailbox';
import { normalizeAgentDoc, normalizeRuns } from './normalize';
import type { AgentDoc, RunRow } from './types';

export interface ApiFailure {
  message: string;
  hint?: string;
}

export class ApiCallError extends Error {
  readonly hint?: string;
  /**
   * The runner's own `ApiErrorCode`, when it sent one.
   *
   * Added for M17: the diff screen has to tell `work_product_moved` (409) from
   * `work_product_unavailable` (410), and those are two completely different pieces of
   * news for the reader — *the tree changed under you, load it again* versus *the tree is
   * gone and there is nothing left to read*. Deciding that from the message string would
   * be a substring claim, which is the failure family this repo keeps paying for; the code
   * is the field the contract put there for it.
   *
   * `undefined` when the runner sent no JSON body (a proxy 502, a transport failure). That
   * is not a code and must not be turned into one.
   */
  readonly code?: string;
  constructor(message: string, hint?: string, code?: string) {
    super(message);
    this.name = 'ApiCallError';
    this.hint = hint;
    this.code = code;
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
    let code: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { message?: string; hint?: string; code?: string };
      };
      if (body?.error?.message) message = body.error.message;
      hint = body?.error?.hint;
      code = body?.error?.code;
    } catch {
      /* keep the status-line message */
    }
    throw new ApiCallError(message, hint, code);
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
    let code: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { message?: string; hint?: string; code?: string };
      };
      if (body?.error?.message) message = body.error.message;
      hint = body?.error?.hint;
      code = body?.error?.code;
    } catch {
      /* keep the status-line message */
    }
    throw new ApiCallError(message, hint, code);
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

/**
 * The project-scoped path for a route template, or a refusal that says why.
 *
 * `projectApiUrl` is `shell-navigation-engineer`'s shared seam (their answer of
 * 2026-08-17: *"it is exported and it is the seam"*), not a fourth private copy. It
 * returns `null` both when there is no project and when the segment in the address bar is
 * not a slug — `projectPath` throws on the latter, and a malformed URL is a reason to stop
 * asking, not a reason to throw out of a render.
 *
 * Turning that `null` into an `ApiCallError` here means the drawer's existing failure
 * surface prints the reason: one sentence, in the panel, naming the fix. No request leaves
 * the browser.
 */
function scopedPath(template: string, project: string | null): string {
  const path = projectApiUrl(template, project);
  if (path === null) throw new ApiCallError(NO_PROJECT_SENTENCE);
  return path;
}

/** `/api/p/:project/agents/*` with the wildcard filled in. */
function agentPath(project: string | null, slug: string): string {
  return scopedPath(RUNNER_ROUTES.agent.path, project).replace('*', slugPath(slug));
}

/** `GET /api/p/:project/agents/:slug` — parsed frontmatter + body. */
export async function fetchAgent(
  project: string | null,
  slug: string,
  signal?: AbortSignal,
): Promise<AgentDoc> {
  return normalizeAgentDoc(await getJson(agentPath(project, slug), signal), slug);
}

/**
 * `GET /api/p/:project/metrics/runs` — the one template in this file with no export to
 * import.
 *
 * The metrics surface is `observability-engineer`'s and lives in `apps/runner`, which a
 * web module may not import; `@agnetos/contracts` carries only their `COST_TICKER_ROUTE`.
 * So the half that **moved** — the project prefix — comes from the contract, and only the
 * suffix is written here. That is deliberately the same construction their own route table
 * uses (`METRICS_ROUTES` in `apps/runner/src/routes/metrics.ts`), and for the reason stated
 * there: *"kept as suffixes rather than written out in full so that the project prefix has
 * exactly one spelling in this codebase … and a prefix with one spelling is a prefix that
 * cannot drift."*
 *
 * A `decision-request` is open with `observability-engineer` to export their route table
 * from `@agnetos/contracts` beside `COST_TICKER_ROUTE`, at which point this constant is
 * deleted rather than corrected.
 */
const METRICS_RUNS_PATH = `${PROJECT_ROUTE_PREFIX}/metrics/runs`;

/**
 * `GET /api/p/:project/metrics/runs?agent=&limit=5` — the LAST RUNS rows
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
export async function fetchRuns(
  project: string | null,
  slug: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<RunRow[]> {
  const path = scopedPath(METRICS_RUNS_PATH, project);
  return normalizeRuns(
    await getJson(`${path}?agent=${encodeURIComponent(slug)}&limit=${limit}`, signal),
    limit,
  );
}

/** `POST /api/p/:project/schedule` — writes `schedule:` into frontmatter via a git commit. */
export async function postSchedule(
  project: string | null,
  slug: string,
  cron: string,
): Promise<{ ok?: boolean; nextRunAt?: string; commitSha?: string }> {
  return (await postJson(scopedPath(RUNNER_ROUTES.schedule.path, project), { agent: slug, cron })) as {
    ok?: boolean;
    nextRunAt?: string;
    commitSha?: string;
  };
}

/** `POST /api/p/:project/approvals/:runId` — resumes or aborts a run paused at its plan. */
export async function postApproval(
  project: string | null,
  runId: string,
  decision: 'approve' | 'deny',
  note?: string,
): Promise<void> {
  const path = scopedPath(RUNNER_ROUTES.approvalDecision.path, project).replace(
    ':runId',
    encodeURIComponent(runId),
  );
  await postJson(path, { decision, ...(note ? { note } : {}) });
}

/**
 * `POST /api/p/:project/thread/:id/message` — **the one pipe** (`thread-model.md` §4.1).
 *
 * The path spelling is the contract's and not `Plan §12`'s `POST /api/thread/:id/message`,
 * and the difference is load-bearing: ADR-015 puts the project in the path of every route
 * that reads or writes one project's data, and a lookup-then-scope route would let a
 * caller-supplied `:id` choose its own scope. Read from `RUNNER_ROUTES.threadMessage` for
 * the same reason every other path in this file is — a literal is what let five paths go
 * stale silently through M15.
 *
 * **`interrupt` is `ComposableLevel`, so `'steer'` does not compile here.** The runner
 * answers every steer with `interrupt_not_deliverable` (409) in this build, and the honest
 * shape of that is a control this app cannot construct — not a request it sends and then
 * apologises for. There is deliberately no `catch` that retries as a note:
 * `thread-model.md` invariant 7 forbids exactly that, because a human who steered and was
 * silently queued believes they changed course and nothing did.
 *
 * **The body is free text a person typed** — `ops.message` is the highest-PII surface in
 * this repo (§7). It goes into the request and nowhere else: it is not logged, not put
 * into an error sentence, and not echoed into any string this UI later renders. A body
 * inside an error string leaks past every key-based redactor, which is the flattening
 * finding, and `postJson` above already discards the request body on failure.
 */
export async function postThreadMessage(
  project: string | null,
  threadId: string,
  input: { body: string; interrupt: ComposableLevel; payload?: Record<string, unknown> | null },
): Promise<PostThreadMessageResponse> {
  const path = scopedPath(RUNNER_ROUTES.threadMessage.path, project).replace(
    ':id',
    encodeURIComponent(threadId),
  );
  return (await postJson(path, input)) as PostThreadMessageResponse;
}

/**
 * Work products — M17, `Plan §13`, ADR-026, `comms/contracts/work-product.md` §4.1.
 *
 * **Three routes, all project-scoped, and the frame's shorthand is not the route.** M17's
 * frame named the boundary object `GET /api/work-product/:runId`; the contract now states
 * outright that it *"is not unscoped"*, because behind this id are another project's file
 * paths and file contents. That is stricter than the rule about opaque run ids, and it is
 * why every path here comes out of `RUNNER_ROUTES` rather than being typed.
 *
 * **The roster reads one route for N runs.** Not one per run: a roster assembled from N
 * fetches is a spinner, and every part of it is individually correct so no test catches it
 * (§7). `fetchWorkProducts` is that one route, and nothing in the drawer calls
 * `fetchWorkProduct` in a loop.
 */
export async function fetchWorkProducts(
  project: string | null,
  options: { limit?: number; review?: boolean } = {},
  signal?: AbortSignal,
): Promise<WorkProductListResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.review) params.set('review', 'true');
  const query = params.toString();
  const path = scopedPath(RUNNER_ROUTES.workProducts.path, project);
  return (await getJson(query ? `${path}?${query}` : path, signal)) as WorkProductListResponse;
}

/**
 * `GET /api/p/:project/work-product/:runId` — one run, **or a discriminated absence**.
 *
 * A 200 with `workProduct: null` and a stated `absent` reason is the ordinary answer in
 * this build and must be rendered as the sentence it is. It is not an error, and the
 * caller must never collapse it into the empty roster: *this run touched no repository*
 * and *this project has no work products* are different news.
 */
export async function fetchWorkProduct(
  project: string | null,
  runId: string,
  signal?: AbortSignal,
): Promise<WorkProductResponse> {
  const path = scopedPath(RUNNER_ROUTES.workProduct.path, project).replace(
    ':runId',
    encodeURIComponent(runId),
  );
  return (await getJson(path, signal)) as WorkProductResponse;
}

/**
 * `GET /api/p/:project/work-product/:runId/diff?cursor=&files=` — one page, pinned to a tree.
 *
 * **`cursor` is opaque and is passed back verbatim.** The contract's own words: *"Pass it
 * back verbatim; do not construct one."* It is `<headSha>:<fileIndex>` today and the client
 * knowing that would be a second implementation of the server's paging, which is the seam
 * this contract was drawn to prevent. So it is `string` here, `encodeURIComponent`'d for
 * transport and never parsed, split or compared.
 *
 * A cursor presented against a moved tree comes back `work_product_moved` (409) and reaches
 * the caller as an `ApiCallError` carrying that code.
 */
export async function fetchWorkProductDiff(
  project: string | null,
  runId: string,
  options: { cursor?: string | null; files?: number } = {},
  signal?: AbortSignal,
): Promise<DiffPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.files !== undefined) params.set('files', String(options.files));
  const query = params.toString();
  const path = scopedPath(RUNNER_ROUTES.workProductDiff.path, project).replace(
    ':runId',
    encodeURIComponent(runId),
  );
  return (await getJson(query ? `${path}?${query}` : path, signal)) as DiffPage;
}

/**
 * `GET /api/status` — `{tailscale, queueDepth}`. Used only to answer "is the runner
 * there?", so ▶ Run can be honestly enabled or honestly disabled.
 *
 * **Deliberately unscoped, and not an oversight to be fixed later.** `RUNNER_ROUTES.status`
 * is `scope: 'coordinator'` — it describes the process, not a project's data — and both
 * `runner-engineer` (*"the coordinator itself — /api/status, /api/projects"*) and
 * `shell-navigation-engineer` (*"`/api/status` staying unscoped is correct and I have
 * written it down as such, so nobody 'fixes' it later"*) have said so in writing. The
 * template still comes from the route table, so "unscoped" is a fact this file reads rather
 * than a string it asserts.
 */
export async function fetchRunnerStatus(
  signal?: AbortSignal,
): Promise<{ tailscale?: string; queueDepth?: number; runnerConfigured?: boolean }> {
  return (await getJson(RUNNER_ROUTES.status.path, signal)) as {
    tailscale?: string;
    queueDepth?: number;
    runnerConfigured?: boolean;
  };
}

/**
 * `Take it ↓` — the SKILL.md folder as a zip.
 *
 * NOT IN THE CONTRACT YET. A `decision-request` is open with `runner-engineer` for
 * `GET /api/p/:project/agents/:slug/download`. Until it is answered the button is disabled
 * with a tooltip that says so, rather than linking at a 404.
 */
export const DOWNLOAD_ROUTE_AGREED = false;

/**
 * `null` when the URL names no project — an `<a download>` is a URL and not a call, so
 * there is nothing to throw at and nothing to catch. The caller renders no link, which is
 * the same answer the disabled button already gives for the larger reason above.
 */
export function downloadUrl(project: string | null, slug: string): string | null {
  const path = projectApiUrl(RUNNER_ROUTES.agent.path, project);
  return path === null ? null : `${API_BASE}${path.replace('*', slugPath(slug))}/download`;
}
