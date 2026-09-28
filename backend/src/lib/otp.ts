import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../env.js';
import { AppError } from './errors.js';

/**
 * Everything risky about the email-OTP flow lives here, and this module has no
 * database or network dependency, so it can be exhaustively unit tested.
 *
 * Policy (from the brief):
 *  - 6 digits, valid for 10 minutes, single use
 *  - at most 5 wrong attempts
 *  - resend cooldown of about 30 seconds
 *  - only a hash of the code is ever persisted
 */

/** The persisted shape of an outstanding challenge. */
export interface OtpChallenge {
  id: string;
  /** bcrypt hash of the 6-digit code. The plaintext never touches the database. */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  /** Set the moment the code is successfully used — makes the code single use. */
  consumedAt: Date | null;
  createdAt: Date;
}

export type OtpState = 'missing' | 'active' | 'expired' | 'locked' | 'consumed';

export type OtpFailureCode =
  | 'OTP_EXPIRED'
  | 'OTP_LOCKED'
  | 'OTP_ALREADY_USED'
  | 'OTP_INVALID';

/** The outcome of evaluating one submitted code. */
export type OtpVerdict =
  | { ok: true; challenge: OtpChallenge }
  | { ok: false; code: OtpFailureCode; attemptsUsed: number; attemptsRemaining: number };

/**
 * Generate a numeric code using `crypto.randomInt`, which rejects out-of-range
 * values. That matters: `crypto.randomInt(10 ** n)` would bias the low digits,
 * `Math.random()` is not cryptographically secure, and `% 1_000_000` biases the
 * first three digits.
 */
export function generateOtpCode(length: number = config.OTP_LENGTH): string {
  if (!Number.isInteger(length) || length < 4 || length > 10) {
    throw new RangeError(`OTP length must be an integer between 4 and 10, received ${length}`);
  }
  const upperBound = 10 ** length;
  const code = crypto.randomInt(0, upperBound);
  return String(code).padStart(length, '0');
}

export function hashOtpCode(code: string, rounds: number = config.OTP_BCRYPT_ROUNDS): Promise<string> {
  return bcrypt.hash(normaliseOtpInput(code), rounds);
}

/** Constant-time-ish comparison of a submitted code against the stored hash. */
export function verifyOtpHash(code: string, codeHash: string): Promise<boolean> {
  return bcrypt.compare(normaliseOtpInput(code), codeHash);
}

/**
 * Accept `123456`, ` 123 456 `, `123-456` and friends so that a code copied out
 * of an email with a space in it still works.
 */
export function normaliseOtpInput(code: string): string {
  return String(code ?? '')
    .replace(/[\s-]/g, '')
    .trim();
}

/** True only for a string of exactly `length` decimal digits. */
export function isWellFormedOtp(code: string, length: number = config.OTP_LENGTH): boolean {
  return new RegExp(`^\\d{${length}}$`).test(normaliseOtpInput(code));
}

export function otpState(challenge: OtpChallenge | null, now: Date = new Date()): OtpState {
  if (!challenge) return 'missing';
  if (challenge.consumedAt) return 'consumed';
  if (challenge.attempts >= challenge.maxAttempts) return 'locked';
  if (challenge.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export function isExpired(challenge: OtpChallenge, now: Date = new Date()): boolean {
  return challenge.expiresAt.getTime() <= now.getTime();
}

export function remainingAttempts(challenge: OtpChallenge): number {
  return Math.max(0, challenge.maxAttempts - challenge.attempts);
}

/** Whole seconds left before expiry; 0 once expired. Never negative. */
export function secondsUntilExpiry(challenge: OtpChallenge, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((challenge.expiresAt.getTime() - now.getTime()) / 1000));
}

export function newChallenge(codeHash: string, now: Date = new Date()): OtpChallenge {
  return {
    id: crypto.randomUUID(),
    codeHash,
    expiresAt: new Date(now.getTime() + config.OTP_TTL_MINUTES * 60_000),
    attempts: 0,
    maxAttempts: config.OTP_MAX_ATTEMPTS,
    consumedAt: null,
    createdAt: now,
  };
}

export type ResendState = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * A resend is only allowed once the cooldown has elapsed. `lastSentAt` is the
 * creation time of the newest challenge for that user.
 */
export function resendState(
  lastSentAt: Date | null,
  now: Date = new Date(),
  cooldownSeconds: number = config.OTP_RESEND_COOLDOWN_SECONDS,
): ResendState {
  if (!lastSentAt || cooldownSeconds <= 0) return { allowed: true };
  const elapsed = now.getTime() - lastSentAt.getTime();
  const waitMs = cooldownSeconds * 1000 - elapsed;
  if (waitMs <= 0) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.ceil(waitMs / 1000) };
}

/**
 * Throws the right `AppError` when a challenge cannot be used any more, and
 * returns silently when it is usable. Separated from `evaluateOtpCode` so
 * the state machine can be tested without any hashing.
 */
export function assertChallengeUsable(challenge: OtpChallenge | null, now: Date = new Date()): asserts challenge is OtpChallenge {
  switch (otpState(challenge, now)) {
    case 'missing':
      throw new AppError(400, 'OTP_EXPIRED', 'Request a new verification code to continue.');
    case 'consumed':
      throw new AppError(400, 'OTP_ALREADY_USED', 'That code has already been used. Request a new one.');
    case 'locked':
      throw new AppError(
        429,
        'OTP_LOCKED',
        `Too many incorrect attempts. Request a new verification code and try again.`,
        { meta: { attemptsRemaining: 0 } },
      );
    case 'expired':
      throw new AppError(400, 'OTP_EXPIRED', 'That code has expired. Request a new verification code.');
    case 'active':
      return;
  }
}

/**
 * The full verdict for one submitted code. `matches` is injected so the state
 * machine can be tested without paying bcrypt's cost 20 times; production
 * passes `verifyOtpHash`.
 */
export async function evaluateOtpCode(
  challenge: OtpChallenge | null,
  code: string,
  now: Date = new Date(),
  matches: (code: string, hash: string) => Promise<boolean> = verifyOtpHash,
): Promise<OtpVerdict> {
  assertChallengeUsable(challenge, now);
  const usable = challenge;

  if (!isWellFormedOtp(code)) {
    // A malformed code still costs an attempt — otherwise it is a free oracle.
    return failAttempt(usable, 'OTP_INVALID');
  }

  const ok = await matches(code, usable.codeHash);
  if (!ok) return failAttempt(usable, 'OTP_INVALID');

  return {
    ok: true,
    challenge: { ...usable, consumedAt: new Date(now.getTime()) },
  };
}

function failAttempt(challenge: OtpChallenge, code: OtpFailureCode): OtpVerdict {
  const attemptsUsed = challenge.attempts + 1;
  const attemptsRemaining = Math.max(0, challenge.maxAttempts - attemptsUsed);
  return { ok: false, code, attemptsUsed, attemptsRemaining };
}
