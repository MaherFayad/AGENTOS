/**
 * The browser's half of the scheduling routes (`comms/contracts/scheduling.md` §13).
 *
 * Owner: `scheduler-engineer`. The **read and write side of the M18 seam has one author**, the
 * same arrangement M17 used for work products: the producer writes the client, and the surface
 * that renders it forks no type. `drawer-engineer` and `dashboards-engineer` consume this module;
 * neither has to learn a URL or an error code twice.
 *
 * ## No `/api/…` literal appears in this file, and that is a scar
 *
 * M15 moved every route under `/api/p/:project` and `dashboards/data/endpoints.ts` held five
 * paths as string literals. Nothing broke at build time and nothing failed at review: every URL
 * it built began answering **400 `project_scope_missing`**, which the client classified as
 * "cannot reach the runner", so every widget went `unavailable` under a sentence blaming the
 * tailnet for one line of client code. So the paths come from `RUNNER_ROUTES` and the prefix is
 * filled by `projectPath`, and `client.test.ts` asserts the built URLs against the contract.
 *
 * ## A refusal is data, not an exception
 *
 * Every function returns a discriminated result rather than throwing. The scheduling plane's
 * refusals are things a person is meant to read and act on — *your preview is stale, and here are
 * the times it would fire now*; *this schedule follows you and nothing knows where you are* — and
 * a thrown `Error` loses the `code` a UI branches on and the `hint` written for the reader. That
 * is the same defect `toApiError` was extended to fix on the server, arriving from the other end.
 *
 * ## And it authors no copy
 *
 * `message` and `hint` are **relayed** from the server's envelope, where they were written for a
 * human, or they are `null`. There is no English sentence in this file — not even a fallback for
 * a proxy that returned no JSON. A data client that invents *"the runner did not answer"* has put
 * a string where nobody can translate it, and `check-rtl` found exactly that on the first run of
 * this module: two hardcoded fallbacks, both mine. `code` is the thing a surface branches on; the
 * sentence belongs to the catalogue.
 */

import {
  RUNNER_ROUTES,
  projectPath,
  type ApiErrorBody,
  type CreateScheduleRequest,
  type CreateScheduleResponse,
  type FireTimePreview,
  type ScheduleFiresResponse,
  type SchedulePreviewRequest,
  type SchedulesResponse,
  type UpdateScheduleRequest,
} from '@agnetos/contracts';

/** What went wrong, in the shape a surface can render without unwrapping anything. */
export interface ScheduleRefusal {
  ok: false;
  /** The contract's code — `schedule_preview_stale`, `schedule_zone_unresolved`, … */
  code: string;
  /**
   * The server's sentence, written for a human, relayed verbatim — or `null`.
   *
   * `null` is not "no error". It means **nothing on the wire said anything**: an unreachable
   * runner, or a proxy that answered with something that was not the envelope. A surface must
   * supply its own catalogued sentence for those, keyed off `code`; this module does not author
   * copy, because a string typed here is a string nobody can translate.
   */
  message: string | null;
  hint: string | null;
  /** `null` when the request never reached a server. A tailnet fault is not a 4xx. */
  status: number | null;
}

export type ScheduleResult<T> = { ok: true; value: T } | ScheduleRefusal;

/**
 * The six URLs, built once from the contract.
 *
 * `project` is a required argument with **no default and no fallback**. ADR-015 Q2 leaves no
 * default project on purpose, and a client that quietly called the unscoped path would turn the
 * deliberate 400 those paths exist to serve into a shrug.
 */
export function scheduleUrls(project: string) {
  const at = (path: string): string => projectPath(path, project);
  return {
    preview: at(RUNNER_ROUTES.schedulePreview.path),
    create: at(RUNNER_ROUTES.scheduleCreate.path),
    list: at(RUNNER_ROUTES.schedules.path),
    update: (id: string): string =>
      at(RUNNER_ROUTES.scheduleUpdate.path).replace(':id', encodeURIComponent(id)),
    fires: (id: string): string =>
      at(RUNNER_ROUTES.scheduleFires.path).replace(':id', encodeURIComponent(id)),
    fireNow: (id: string): string =>
      at(RUNNER_ROUTES.scheduleFireNow.path).replace(':id', encodeURIComponent(id)),
  };
}

/**
 * Nothing answered.
 *
 * `unreachable` is deliberately **not** one of the contract's error codes: nothing refused this,
 * and labelling a network fault with a server's vocabulary is how *"the runner said no"* ends up
 * in a report about a laptop that was asleep. `status: null` is the checkable form of it.
 */
const OFFLINE: Omit<ScheduleRefusal, 'ok'> = {
  code: 'unreachable',
  message: null,
  hint: null,
  status: null,
};

async function call<T>(url: string, init?: RequestInit): Promise<ScheduleResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body ? { 'content-type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
    });
  } catch {
    return { ok: false, ...OFFLINE };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) return { ok: true, value: payload as T };

  const envelope = (payload as ApiErrorBody | null)?.error;
  return {
    ok: false,
    // A non-JSON 500 still has to arrive as something a surface can branch on. `internal` is the
    // contract's own name for "we do not know", and inventing a scheduling code here would put a
    // sentence about cron in front of a person whose proxy fell over. The sentence stays `null`
    // rather than being invented here — see the header.
    code: envelope?.code ?? 'internal',
    message: envelope?.message ?? null,
    hint: envelope?.hint ?? null,
    status: response.status,
  };
}

/** Idempotent, writes nothing, and the only one of the six that works on this stack today. */
export const previewSchedule = (
  project: string,
  body: SchedulePreviewRequest,
): Promise<ScheduleResult<FireTimePreview>> =>
  call(scheduleUrls(project).preview, { method: 'POST', body: JSON.stringify(body) });

/**
 * Create an `ops` row.
 *
 * `previewToken` is a required property of the body type, so a caller cannot omit it by
 * forgetting — for the four kinds with no clockable occurrence it is explicitly `null`, which is
 * a decision the caller has to type rather than an absence the server has to interpret.
 */
export const saveSchedule = (
  project: string,
  body: CreateScheduleRequest,
): Promise<ScheduleResult<CreateScheduleResponse>> =>
  call(scheduleUrls(project).create, { method: 'POST', body: JSON.stringify(body) });

export const listSchedules = (project: string): Promise<ScheduleResult<SchedulesResponse>> =>
  call(scheduleUrls(project).list);

export const updateSchedule = (
  project: string,
  id: string,
  body: UpdateScheduleRequest,
): Promise<ScheduleResult<{ schedule: SchedulesResponse['schedules'][number] }>> =>
  call(scheduleUrls(project).update(id), { method: 'PATCH', body: JSON.stringify(body) });

export const listFires = (project: string, id: string): Promise<ScheduleResult<ScheduleFiresResponse>> =>
  call(scheduleUrls(project).fires(id));

/**
 * Fire out of band.
 *
 * The response carries `started: false` and the reason, because there is no executor: the row is
 * recorded and nothing reads it yet. A caller must render that rather than the absence of an
 * error — *"fired"* over a row nobody will pick up is the house defect on the surface where
 * believing it costs money.
 */
export const fireNow = (
  project: string,
  id: string,
): Promise<ScheduleResult<{ fireId: string; occurrenceTime: string; recorded: boolean; started: false; startedBecause: 'no-executor' }>> =>
  call(scheduleUrls(project).fireNow(id), { method: 'POST', body: JSON.stringify({}) });
