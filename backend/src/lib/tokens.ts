import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../env.js';
import { unauthorized } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

/**
 * Access tokens are stateless. Logout clears the token client side; if we later
 * need server-side revocation (device list, "log out everywhere") a token
 * version column on `users` is the cheap upgrade — see DESIGN.md.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.email !== 'string') {
      throw new Error('Malformed token payload');
    }
    return { sub: String(decoded.sub), email: decoded.email };
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    throw unauthorized(expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', expired ? 'Your session has expired. Please sign in again.' : 'Invalid session token.');
  }
}
