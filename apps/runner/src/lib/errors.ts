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
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError('internal', 'The runner hit an unexpected error.', {
    hint: 'Check the runner logs for this timestamp. Nothing was charged for a run that never started.',
    cause: err,
  });
}

/** `bad_request` with a hint, for the many small validation failures. */
export function badRequest(message: string, hint?: string): ApiError {
  return new ApiError('bad_request', message, { hint });
}
