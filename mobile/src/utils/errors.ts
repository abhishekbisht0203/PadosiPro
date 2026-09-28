import { ApiError, toApiError } from '../api/errors';
import type { FieldErrors } from './validation';

/** One place to turn any thrown value into what a form should display. */
export function describeError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const apiErr = toApiError(err);
  if (apiErr instanceof ApiError && apiErr.isOffline) {
    return `Cannot reach the server. Check that the backend is running, then try again.`;
  }
  return apiErr.message || fallback;
}

/**
 * Prefers the server's per-field messages, because it is the authority. Only
 * falls back to the locally computed error when the server did not speak about
 * that field, which happens for client-only checks like password confirmation.
 */
export function mergeFieldErrors(apiErr: unknown, local: FieldErrors): FieldErrors {
  const merged: FieldErrors = { ...local };
  const err = toApiError(apiErr);
  if (err instanceof ApiError) {
    for (const [field, message] of Object.entries(err.details)) {
      merged[field] = message;
    }
  }
  return merged;
}
