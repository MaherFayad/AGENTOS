/**
 * The uniform error envelope (`contracts/api-contracts.md` § Errors).
 *
 * Every route in this service fails through `ApiError`. There is no second failure shape,
 * because a client that has to handle two shapes handles one of them badly — and the one
 * it handles badly is always the one a human reads on a phone at 11pm.
 */
import type { ApiErrorBody, ApiErrorCode } from '@agnetos/contracts';
import { API_ERROR_STATUS } from '@agnetos/contracts';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /**
   * Shown to the user verbatim. Write it as an instruction they can act on from a phone,
   * not as a diagnosis of the process.
   */
  readonly hint?: string;
  /** Whether re-running unchanged could plausibly succeed. Surfaced on the SSE `error`. */
  readonly retryable: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { hint?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.hint = options.hint;
    // 5xx and the two upstream codes are worth another try; a 4xx means the request
    // itself is wrong and retrying it is just noise in someone's trace view.
    this.retryable = options.retryable ?? this.status >= 500;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.hint ? { hint: this.hint } : {}),
      },
    };
  }
}

/**
 * Coerce anything thrown into the envelope. Unknown failures become `internal` with a
 * generic message: the thrown text may contain a path, a token, or a prompt fragment, and
 * none of those belong in a response body.
 */
/** Is this a code the contract declares? Narrowed off `API_ERROR_STATUS`, so the two cannot drift. */
function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(API_ERROR_STATUS, value);
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  /**
   * **An error that names a contract code keeps its code and its sentence.**
   *
   * Added for the thread plane. `db/threads.ts` and `packages/contracts/src/threads.ts` are
   * `thread-model-engineer`'s and throw `Object.assign(new Error(msg), { code, hint })` —
   * they cannot import `ApiError` without a shared package depending on an app. Without this
   * branch, `thread_not_found`, `interrupt_not_deliverable`, `thread_transition_refused` and
   * `fanout_dispatch_refused` all arrived at the client as **500 `internal`**, discarding
   * both the code a UI branches on and a message written for a human.
   *
   * The generic case below stays generic on purpose — *"the thrown text may contain a path,
   * a token, or a prompt fragment"* — and that reasoning is not weakened here: an author who
   * attaches a **declared** `ApiErrorCode` has opted that sentence in, exactly as they do by
   * constructing an `ApiError`. An arbitrary `err.message` still never reaches a client.
   */
  const candidate = err as { code?: unknown; message?: unknown; hint?: unknown };
  if (isApiErrorCode(candidate?.code) && typeof candidate.message === 'string') {
    return new ApiError(candidate.code, candidate.message, {
      ...(typeof candidate.hint === 'string' ? { hint: candidate.hint } : {}),
      cause: err,
    });
  }

  return new ApiError('internal', 'The runner hit an unexpected error.', {
    hint: 'Check the runner logs for this timestamp. Nothing was charged for a run that never started.',
    cause: err,
  });
}

/** `bad_request` with a hint, for the many small validation failures. */
export function badRequest(message: string, hint?: string): ApiError {
  return new ApiError('bad_request', message, { hint });
}
