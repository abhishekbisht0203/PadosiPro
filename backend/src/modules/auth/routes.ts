import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { queryOne } from '../../db/pool.js';
import { config } from '../../env.js';
import { unauthorized } from '../../lib/errors.js';
import { auth, requireAuth } from '../../middleware/auth.js';
import { parseBody, loginBodySchema, registerBodySchema, resendOtpBodySchema, verifyOtpBodySchema } from '../../validation/schemas.js';
import * as authService from './service.js';

/**
 * Rate limits on credential endpoints. Deliberately generous enough not to get
 * in a real user's way (a fat-fingered OTP entry is 5 tries, not 10 a minute)
 * while still making online password/OTP guessing impractical.
 */
const limiter = rateLimit({
  windowMs: 60_000,
  limit: config.AUTH_RATE_LIMIT_PER_MINUTE,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' },
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.REGISTER_RATE_LIMIT_PER_15MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many sign-up attempts from this device. Please try again later.' },
  },
});

export const authRouter: Router = Router();

authRouter.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { email, password } = parseBody(registerBodySchema, req.body);
    // An already-verified address is a conflict thrown from the service, which
    // the shared error handler turns into the standard 409 envelope. The service
    // never returns an 'already-verified' outcome.
    const result = await authService.register(email, password);

    res.status(201).json({
      data: {
        email,
        isNewAccount: result.outcome === 'created',
        codeResent: result.outcome === 'code-resent',
        nextStep: 'verify_email' as const,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-otp', limiter, async (req, res, next) => {
  try {
    const { email, code } = parseBody(verifyOtpBodySchema, req.body);
    const { token, user } = await authService.verifyOtp(email, code);
    res.json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-otp', limiter, async (req, res, next) => {
  try {
    const { email } = parseBody(resendOtpBodySchema, req.body);
    const result = await authService.resendOtp(email);
    res.json({ data: { email, ...result } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', limiter, async (req, res, next) => {
  try {
    const { email, password } = parseBody(loginBodySchema, req.body);
    const { token, user } = await authService.login(email, password);
    res.json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
});

/**
 * `GET /me` is what the app calls on cold start to decide which screen to show:
 * no token -> Welcome, no profile -> Profile, profile + tasks -> Home.
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const row = await queryOne<{
      id: string;
      email: string;
      is_verified: boolean;
      created_at: Date;
      profile_name: string | null;
      profile_mobile: string | null;
      profile_address: string | null;
      profile_business_name: string | null;
      selected_task_count: string;
    }>(
      `SELECT u.id, u.email, u.is_verified, u.created_at,
              p.name     AS profile_name,
              p.mobile   AS profile_mobile,
              p.address  AS profile_address,
              p.business_name AS profile_business_name,
              (SELECT COUNT(*) FROM user_tasks ut WHERE ut.user_id = u.id) AS selected_task_count
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );

    if (!row) throw unauthorized('ACCOUNT_NOT_FOUND', 'This account no longer exists.');

    const hasProfile = Boolean(row.profile_name && row.profile_mobile && row.profile_address);

    res.json({
      data: {
        user: {
          id: row.id,
          email: row.email,
          isVerified: row.is_verified,
          createdAt: row.created_at.toISOString(),
        },
        profile: hasProfile
          ? {
              name: row.profile_name,
              mobile: row.profile_mobile,
              address: row.profile_address,
              businessName: row.profile_business_name ?? null,
            }
          : null,
        hasCompletedProfile: hasProfile,
        selectedTaskCount: Number(row.selected_task_count),
      },
    });
  } catch (err) {
    next(err);
  }
});
