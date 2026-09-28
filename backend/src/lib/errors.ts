/**
 * A single error shape for the whole API.
 *
 * Every failure the client can see is an `AppError` with a stable machine
 * readable `code`, a human readable `message` and optional per-field `details`.
 * The app maps `code` onto user-facing copy, so the codes are part of the API
 * contract — see README "Error codes".
 */
export type ErrorDetails = Record<string, string>;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetails;
  /** Extra fields merged into the response body (e.g. `email` on resend). */
  readonly meta?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: ErrorDetails; meta?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (options.details) this.details = options.details;
    if (options.meta) this.meta = options.meta;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (code: string, message: string, details?: ErrorDetails) =>
  new AppError(400, code, message, details ? { details } : {});

export const unauthorized = (code: string, message: string) => new AppError(401, code, message);

export const forbidden = (code: string, message: string, meta?: Record<string, unknown>) =>
  new AppError(403, code, message, meta ? { meta } : {});

export const notFound = (code: string, message: string) => new AppError(404, code, message);

export const conflict = (code: string, message: string, meta?: Record<string, unknown>) =>
  new AppError(409, code, message, meta ? { meta } : {});

export const tooManyRequests = (code: string, message: string, meta?: Record<string, unknown>) =>
  new AppError(429, code, message, meta ? { meta } : {});

export const internal = (message = 'Something went wrong. Please try again.') =>
  new AppError(500, 'INTERNAL_ERROR', message);

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
