import type { PoolClient } from 'pg';
import { queryOne, withTransaction } from '../../db/pool.js';
import { config } from '../../env.js';
import { badRequest, badGateway, conflict, forbidden, notFound, tooManyRequests, unauthorized } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { sendOtpEmail } from '../../lib/mailer.js';
import {
  evaluateOtpCode,
  generateOtpCode,
  hashOtpCode,
  newChallenge,
  resendState,
  type OtpChallenge,
} from '../../lib/otp.js';
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

interface ChallengeRow {
  id: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  consumed_at: Date | null;
  created_at: Date;
}

function toChallenge(row: ChallengeRow): OtpChallenge {
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

const CHALLENGE_COLUMNS =
  'id, code_hash, expires_at, attempts, max_attempts, consumed_at, created_at';

/** The newest challenge for a user, newest first. */
async function loadLatestChallengeForCooldown(
  client: PoolClient,
  userId: string,
): Promise<OtpChallenge | null> {
  const { rows } = await client.query<ChallengeRow>(
    `SELECT ${CHALLENGE_COLUMNS}
       FROM email_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  return rows[0] ? toChallenge(rows[0]) : null;
}

/**
 * The same read, but with `FOR UPDATE`.
 *
 * This row lock is what makes the five-attempt limit actually hold. Without it
 * two concurrent `POST /verify-otp` calls both read `attempts = 0`, both fail
 * the comparison, and both write `attempts = 1` — so N simultaneous guesses cost
 * the user a single attempt and the limit becomes advisory. Serialising on the
 * row means each request observes the previous one's increment.
 */
async function lockLatestChallenge(client: PoolClient, userId: string): Promise<OtpChallenge | null> {
  const { rows } = await client.query<ChallengeRow>(
    `SELECT ${CHALLENGE_COLUMNS}
       FROM email_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
       FOR UPDATE`,
    [userId],
  );
  return rows[0] ? toChallenge(rows[0]) : null;
}

/**
 * Spends exactly one attempt, in SQL, under a guard.
 *
 * The `attempts < max_attempts` predicate is what enforces "five wrong attempts
 * maximum" at the database: even if a caller somehow evaluated a stale row, the
 * sixth increment matches zero rows and is discarded. `RETURNING` tells the
 * caller which branch it took.
 */
async function spendAttempt(
  client: PoolClient,
  challengeId: string,
): Promise<{ attempts: number; maxAttempts: number } | null> {
  const { rows } = await client.query<{ attempts: number; max_attempts: number }>(
    `UPDATE email_otps
        SET attempts = attempts + 1
      WHERE id = $1
        AND consumed_at IS NULL
        AND attempts < max_attempts
      RETURNING attempts, max_attempts`,
    [challengeId],
  );
  const row = rows[0];
  if (!row) return null;
  return { attempts: row.attempts, maxAttempts: row.max_attempts };
}


/**
 * Issues a fresh code and emails it, atomically.
 *
 * Everything happens in one transaction, including the SMTP round trip. That is
 * a deliberate trade-off — holding a pooled connection open across a network
 * call is normally the wrong instinct — but it is the only way to satisfy "do not
 * leave the user in an inconsistent registration state". If Brevo rejects the
 * send, the whole thing rolls back: no user row, no challenge, and the caller
 * gets a retryable 502. The alternative (commit, then send) leaves a live
 * account with a code that was never delivered and a cooldown the user cannot
 * skip. See DESIGN.md.
 *
 * Previous outstanding codes are consumed rather than deleted, so only the
 * newest emailed code can ever be used.
 */
async function issueChallenge(client: PoolClient, user: UserRow): Promise<OtpChallenge> {
  const code = generateOtpCode(config.OTP_LENGTH);
  const challenge = newChallenge(await hashOtpCode(code));

  await client.query(
    'UPDATE email_otps SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
    [user.id],
  );
  await client.query(
    `INSERT INTO email_otps (user_id, code_hash, expires_at, attempts, max_attempts)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, challenge.codeHash, challenge.expiresAt, challenge.attempts, challenge.maxAttempts],
  );

  // Throws on failure -> the transaction unwinds.
  await sendOtpEmail({
    to: user.email,
    name: null,
    code,
    expiresInMinutes: config.OTP_TTL_MINUTES,
  });

  return challenge;
}

/**
 * Runs a delivery inside a transaction, converting a transport failure into a
 * retryable API error. Any other error is rethrown untouched so genuine bugs are
 * not disguised as "email is down".
 */
async function deliverWithinTransaction(
  client: PoolClient,
  user: UserRow,
): Promise<OtpChallenge> {
  try {
    return await issueChallenge(client, user);
  } catch (err) {
    const isTransport =
      err instanceof Error &&
      /ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNRESET|535|550|553|554|auth|TLS|certificate/i.test(
        `${err.message} ${(err as { code?: string }).code ?? ''}`,
      );

    if (!isTransport) throw err;

    throw badGateway(
      'EMAIL_DELIVERY_FAILED',
      'We could not send your verification email. Please try again in a moment.',
      { retryable: true },
    );
  }
}

export type RegisterResult =
  | { outcome: 'created'; user: PublicUser }
  | { outcome: 'code-resent' };

/**
 * Registration rules:
 *  - unknown email            -> create the user and email a code
 *  - known, unverified email  -> 409 cooldown or a fresh code (idempotent)
 *  - known, verified email    -> 409, the user should log in instead
 *
 * Registration and resend share the cooldown. Registering twice in a row is a
 * natural thing for a user to do when the first email is slow, and letting it
 * bypass the window would let a script mint unlimited challenges; the second
 * attempt gets the same 429 + `retryAfterSeconds` a resend would.
 */
export async function register(email: string, password: string): Promise<RegisterResult> {
  const passwordHash = await hashPassword(password);

  return withTransaction(async (client) => {
    // Lock the user row (if it exists) so two concurrent registrations for the
    // same address serialise on the same cooldown clock.
    const { rows: existingRows } = await client.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 FOR UPDATE',
      [email],
    );
    const existing = existingRows[0] ?? null;

    if (existing?.is_verified) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'That email is already registered. Sign in instead.');
    }

    if (existing) {
      // Same gate as resend — see above.
      const latest = await loadLatestChallengeForCooldown(client, existing.id);
      const state = resendState(latest?.createdAt ?? null);
      if (!state.allowed) {
        throw tooManyRequests(
          'OTP_RESEND_TOO_SOON',
          `Please wait ${state.retryAfterSeconds}s before requesting another code.`,
          { retryAfterSeconds: state.retryAfterSeconds },
        );
      }
      await deliverWithinTransaction(client, existing);
      return { outcome: 'code-resent' } as const;
    }

    const { rows: insertedRows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [email, passwordHash],
    );
    const inserted = insertedRows[0] ?? null;

    // Lost a race against a concurrent signup for the same address.
    if (!inserted) {
      const { rows: racedRows } = await client.query<UserRow>(
        'SELECT * FROM users WHERE email = $1 FOR UPDATE',
        [email],
      );
      const raced = racedRows[0] ?? null;
      if (!raced) throw badRequest('REGISTRATION_FAILED', 'Could not create the account. Please try again.');
      if (raced.is_verified) {
        throw conflict('EMAIL_ALREADY_REGISTERED', 'That email is already registered. Sign in instead.');
      }
      const latest = await loadLatestChallengeForCooldown(client, raced.id);
      const state = resendState(latest?.createdAt ?? null);
      if (!state.allowed) {
        throw tooManyRequests(
          'OTP_RESEND_TOO_SOON',
          `Please wait ${state.retryAfterSeconds}s before requesting another code.`,
          { retryAfterSeconds: state.retryAfterSeconds },
        );
      }
      await deliverWithinTransaction(client, raced);
      return { outcome: 'code-resent' } as const;
    }

    await deliverWithinTransaction(client, inserted);
    return { outcome: 'created', user: toPublicUser(inserted) } as const;
  });
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

  return withTransaction(async (client) => {
    // The row lock serialises every concurrent verification for this challenge.
    const challenge = await lockLatestChallenge(client, user.id);
    const verdict = await evaluateOtpCode(challenge, code);

    if (!verdict.ok) {
      // Atomic, guarded increment. `evaluateOtpCode` computed the verdict from
      // the locked row, so this can only ever be the same number.
      const spent = await spendAttempt(client, challenge!.id);
      const attemptsUsed = spent?.attempts ?? verdict.attemptsUsed;
      const maxAttempts = spent?.maxAttempts ?? challenge!.maxAttempts;
      const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);

      if (attemptsRemaining === 0) {
        throw tooManyRequests(
          'OTP_LOCKED',
          'That was the last allowed attempt. Request a new verification code.',
          { attemptsRemaining: 0 },
        );
      }

      throw badRequest(
        'OTP_INVALID',
        `That code is not correct. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left.`,
        { code: `Wrong code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left.` },
      );
    }

    const consumedAt = verdict.challenge.consumedAt ?? new Date();
    // `consumed_at IS NULL` makes the consume itself idempotent, so a replayed
    // request cannot move the timestamp or resurrect the code.
    await client.query(
      'UPDATE email_otps SET consumed_at = $2 WHERE id = $1 AND consumed_at IS NULL',
      [verdict.challenge.id, consumedAt],
    );
    const { rows: updatedRows } = await client.query<UserRow>(
      `UPDATE users
          SET is_verified = TRUE,
              verified_at = COALESCE(verified_at, NOW()),
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [user.id],
    );
    const updated = updatedRows[0]!;

    return {
      token: signAccessToken({ sub: updated.id, email: updated.email }),
      user: toPublicUser(updated),
    };
  });
}

export async function resendOtp(email: string): Promise<{ cooldownEnforced: boolean; retryAfterSeconds: number }> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw notFound('ACCOUNT_NOT_FOUND', 'No account found for that email. Register first.');
  }
  if (user.is_verified) {
    throw conflict('EMAIL_ALREADY_VERIFIED', 'That email is already verified. Sign in instead.');
  }

  return withTransaction(async (client) => {
    // Lock the user row so two concurrent resends cannot both pass the cooldown.
    const { rows: lockedRows } = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [user.id],
    );
    if (!lockedRows[0]) throw notFound('ACCOUNT_NOT_FOUND', 'No account found for that email. Register first.');

    const latest = await loadLatestChallengeForCooldown(client, user.id);
    const state = resendState(latest?.createdAt ?? null);

    if (!state.allowed) {
      throw tooManyRequests(
        'OTP_RESEND_TOO_SOON',
        `Please wait ${state.retryAfterSeconds}s before requesting another code.`,
        { retryAfterSeconds: state.retryAfterSeconds },
      );
    }

    await deliverWithinTransaction(client, user);
    return { cooldownEnforced: false, retryAfterSeconds: 0 };
  });
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
  // `verifyPassword` falls back to a real bcrypt comparison against a dummy hash
  // when there is no account, so a missing address and a wrong password take
  // comparable time and the response does not leak which emails are registered.
  const passwordOk = await verifyPassword(password, user?.password_hash);

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

