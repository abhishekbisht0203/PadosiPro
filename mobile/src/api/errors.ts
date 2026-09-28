/**
 * A single error type for the whole app.
 *
 * Every network failure — HTTP error, timeout, DNS failure, unexpected JSON —
 * arrives as an `ApiError` carrying the backend's machine readable `code` and
 * its per-field `details`. Screens branch on `code`, so the codes in
 * `lib/errors.ts` on the server are part of this app's contract.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    message: string,
    status = 0,
    details: Record<string, string> = {},
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }

  /** True when retrying the exact same request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500;
  }

  get isOffline(): boolean {
    return this.code === 'NETWORK_ERROR';
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

/** Turns anything thrown into an ApiError so screens only handle one type. */
export function toApiError(err: unknown): ApiError {
  if (isApiError(err)) return err;
  if (err instanceof Error) {
    return new ApiError('UNKNOWN', err.message || 'Something went wrong.');
  }
  return new ApiError('UNKNOWN', 'Something went wrong.');
}
