import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { signAccessToken, verifyAccessToken } from '../lib/tokens.js';

export interface AuthenticatedRequest extends Request {
  auth: { userId: string; email: string };
}

/**
 * Bearer token guard. Kept synchronous after the initial verification so
 * handlers can read `req.auth.userId` without `await`.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('AUTH_REQUIRED', 'Please sign in to continue.'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    (req as AuthenticatedRequest).auth = { userId: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

/** Narrowing helper so handlers get the typed request without a cast. */
export function auth(req: Request): AuthenticatedRequest['auth'] {
  const maybe = (req as Partial<AuthenticatedRequest>).auth;
  if (!maybe) throw unauthorized('AUTH_REQUIRED', 'Please sign in to continue.');
  return maybe;
}

/**
 * Test helper: lets the test harness mint a session for a user without going
 * through email. Production code always signs tokens via `lib/tokens.ts`.
 */
export function issueTokenFor(userId: string, email: string): string {
  return signAccessToken({ sub: userId, email });
}
