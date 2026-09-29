import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../env.js';

/**
 * bcrypt truncates its input at 72 *bytes*, not 72 characters. A 30-character
 * Devanagari or emoji password is well under 72 characters but over 72 bytes, and
 * anything past the 72nd byte is silently ignored — which would make two
 * different passwords verify against the same hash. The validation layer rejects
 * over-long passwords; this is the belt to that suspenders.
 */
export const BCRYPT_MAX_BYTES = 72;

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, 'utf8');
}

export function exceedsBcryptLimit(password: string): boolean {
  return passwordByteLength(password) > BCRYPT_MAX_BYTES;
}

/**
 * A real bcrypt hash, of a random secret nobody holds, at the configured cost.
 *
 * Login runs a comparison even when the email is unknown, so that a missing
 * account and a wrong password take comparable time and the response does not
 * reveal which addresses are registered. That only works if the comparison is
 * genuine bcrypt work — a malformed placeholder hash makes `bcrypt.compare`
 * reject immediately, which is *faster* than a real compare and defeats the
 * entire point. The earlier hand-typed placeholder was both malformed and
 * hard-coded to cost 12, so it also stopped matching `BCRYPT_ROUNDS` whenever
 * that changed.
 *
 * Generated once per process at boot from `crypto.randomBytes`, so it is
 * different on every restart and matches nothing.
 */
let dummyHashCache: { hash: string; rounds: number } | null = null;

export function dummyPasswordHash(): string {
  if (dummyHashCache && dummyHashCache.rounds === config.BCRYPT_ROUNDS) {
    return dummyHashCache.hash;
  }
  const hash = bcrypt.hashSync(crypto.randomBytes(32).toString('base64'), config.BCRYPT_ROUNDS);
  dummyHashCache = { hash, rounds: config.BCRYPT_ROUNDS };
  return hash;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!passwordHash) {
    // Still burn the same amount of work as a real comparison.
    return bcrypt.compare(password, dummyPasswordHash()).then(() => false);
  }
  return bcrypt.compare(password, passwordHash);
}
