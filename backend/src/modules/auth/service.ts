import { query, queryOne } from '../../db/pool.js';
import { config } from '../../env.js';
import { badRequest, conflict, forbidden, notFound, tooManyRequests, unauthorized } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  evaluateOtpCode,
  generateOtpCode,
  hashOtpCode,
  newChallenge,
  resendState,
  type OtpChallenge,
} from '../../lib/otp.js';
import { sendOtpEmail } from '../../lib/mailer.js';
import { signAccessToken } from '../../lib/tokens.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_verified: boolean;
  verified_at: Date | null;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    isVerified: row.is_verified,
    createdAt: row.created_at.toISOString(),
  };
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
}

/** The newest outstanding challenge for a user, newest first. */
async function loadLatestChallenge(userId: string): Promise<OtpChallenge | null> {
  const row = await queryOne<{
    id: string;
    code_hash: string;
    expires_at: Date;
    attempts: number;
    max_attempts: number;
    consumed_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, code_hash, expires_at, attempts, max_attempts, consumed_at, created_at
       FROM email_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  if (!row) return null;
  return {
    id: row.id,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

/**
 * Issues a fresh code and emails it. Any previous outstanding code is consumed
 * immediately so that only the newest emailed code can ever be used — otherwise
 * an attacker with mailbox access keeps a valid older code alive.
 */
async function issueChallenge(user: UserRow): Promise<OtpChallenge> {
  const code = generateOtpCode(config.OTP_LENGTH);
  const challenge = newChallenge(await hashOtpCode(code));

  await query('UPDATE email_otps SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [user.id]);
  await query(
    `INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, max_attempts)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, challenge.codeHash, challenge.expiresAt, challenge.attempts, challenge.maxAttempts],
  );

  await sendOtpEmail({
    to: user.email,
    name: null,
    code,
    expiresInMinutes: config.OTP_TTL_MINUTES,
  });

  return challenge;
}

export type RegisterResult =
  | { outcome: 'created'; user: PublicUser }
  | { outcome: 'already-verified' }
  | { outcome: 'code-resent' };

/**
 * Registration rules:
 *  - unknown email            -> create the user and email a code
 *  - known, unverified email  -> email a fresh code (idempotent, not an error)
 *  - known, verified email    -> 409, the user should log in instead
 */
export async function register(email: string, password: string): Promise<RegisterResult> {
  const existing = await findUserByEmail(email);
  if (existing?.is_verified) {
    throw conflict('EMAIL_ALREADY_REGISTERED', 'That email is already registered. Sign in instead.');
  }

  if (existing) {
    await issueChallenge(existing);
    return { outcome: 'code-resent' };
  }

  const passwordHash = await hashPassword(password);
  const inserted = await queryOne<UserRow>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [email, passwordHash],
  );

  // Lost a race against a concurrent signup with the same address.
  if (!inserted) {
    const raced = await findUserByEmail(email);
    if (raced?.is_verified) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'That email is already registered. Sign in instead.');
    }
    if (!raced) throw badRequest('REGISTRATION_FAILED', 'Could not create the account. Please try again.');
    await issueChallenge(raced);
    return { outcome: 'code-resent' };
  }

  await issueChallenge(inserted);
  return { outcome: 'created', user: toPublicUser(inserted) };
}

export interface VerifyOtpResult {
  token: string;
  user: PublicUser;
}

export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw notFound('ACCOUNT_NOT_FOUND', 'No account found for that email. Register first.');
  }

  const challenge = await loadLatestChallenge(user.id);
  const verdict = await evaluateOtpCode(challenge, code);

  if (!verdict.ok) {
    if (challenge) {
      await query('UPDATE email_otps SET attempts = $2 WHERE id = $1', [challenge.id, verdict.attemptsUsed]);
    }
    // The fifth wrong attempt exhausts the challenge: tell the client to resend.
    if (verdict.attemptsRemaining === 0) {
      throw tooManyRequests(
        'OTP_LOCKED',
        'That was the last allowed attempt. Request a new verification code.',
        { attemptsRemaining: 0 },
      );
    }
    throw badRequest(
      'OTP_INVALID',
      `That code is not correct. ${verdict.attemptsRemaining} attempt${verdict.attemptsRemaining === 1 ? '' : 's'} left.`,
      { code: `Wrong code. ${verdict.attemptsRemaining} attempt${verdict.attemptsRemaining === 1 ? '' : 's'} left.` },
    );
  }

  const { rows } = await query<UserRow>(
    `UPDATE users SET is_verified = TRUE, verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [user.id],
  );
  const updated = rows[0]!;
  await query('UPDATE email_otps SET consumed_at = $2 WHERE id = $1', [verdict.challenge.id, verdict.challenge.consumedAt]);

  return {
    token: signAccessToken({ sub: updated.id, email: updated.email }),
    user: toPublicUser(updated),
  };
}

export async function resendOtp(email: string): Promise<{ cooldownEnforced: boolean; retryAfterSeconds: number }> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw notFound('ACCOUNT_NOT_FOUND', 'No account found for that email. Register first.');
  }
  if (user.is_verified) {
    throw conflict('EMAIL_ALREADY_VERIFIED', 'That email is already verified. Sign in instead.');
  }

  const challenge = await loadLatestChallenge(user.id);
  const state = resendState(challenge?.createdAt ?? null);

  if (!state.allowed) {
    throw tooManyRequests('OTP_RESEND_TOO_SOON', `Please wait ${state.retryAfterSeconds}s before requesting another code.`, {
      retryAfterSeconds: state.retryAfterSeconds,
    });
  }

  await issueChallenge(user);
  return { cooldownEnforced: false, retryAfterSeconds: 0 };
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

/**
 * Login is only for verified accounts. An unverified account gets a specific,
 * actionable error (the app routes it to the OTP screen) rather than a generic
 * "wrong credentials", which would otherwise leak nothing useful.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);
  // Always run a comparison so a missing account and a wrong password take
  // comparable time.
  const referenceHash = user?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordOk = await verifyPassword(password, referenceHash);

  if (!user || !passwordOk) {
    throw unauthorized('INVALID_CREDENTIALS', 'That email and password combination is not correct.');
  }
  if (!user.is_verified) {
    throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email before signing in.', { email: user.email });
  }

  return {
    token: signAccessToken({ sub: user.id, email: user.email }),
    user: toPublicUser(user),
  };
}
