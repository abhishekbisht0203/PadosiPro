import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the API depends on is validated once, at boot.
 * A misconfigured deployment should fail loudly and immediately rather than
 * fail halfway through a request.
 */
const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /**
   * TLS to Postgres. Left unset it is inferred from the URL (a managed host or
   * an `sslmode=` in the query string turns it on); set it explicitly to
   * override. See `db/pool.ts`.
   */
  DATABASE_SSL: z.enum(['true', 'false', 'auto']).default('auto'),

  /** Points the test suite at a different database than the running app. */
  TEST_DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  OTP_BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(30),

  /**
   * Transactional email.
   *
   * `brevo` is the production path: the OTP email is delivered over Brevo's
   * SMTP relay. `console` prints the code to stdout and skips the network, which
   * keeps a local quickstart honest on a machine with no SMTP account. `smtp`
   * points at the generic SMTP_* block and is what a local Mailpit container
   * uses. Anything else is rejected at boot rather than silently falling back.
   */
  MAIL_MODE: z.enum(['brevo', 'smtp', 'console']).default('brevo'),

  /**
   * Brevo SMTP. The password is a *Brevo SMTP key*, not the account password and
   * not the API key. Never committed — see backend/.env.example.
   */
  BREVO_SMTP_HOST: z.string().default('smtp-relay.brevo.com'),
  BREVO_SMTP_PORT: z.coerce.number().int().positive().default(587),
  BREVO_SMTP_USER: z.string().optional(),
  BREVO_SMTP_PASSWORD: z.string().optional(),

  /**
   * Generic SMTP escape hatch, used by MAIL_MODE=smtp/mailpit. Kept separate
   * from the Brevo block so a local Mailpit config can never be mistaken for
   * production credentials.
   */
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  /** Sender identity. Must be a sender verified in the Brevo account. */
  MAIL_FROM_EMAIL: z.string().email('MAIL_FROM_EMAIL must be a valid email address').optional(),
  MAIL_FROM_NAME: z.string().default('PadosiPro'),
  /**
   * Combined RFC 5322 From header, used when it is set. Takes precedence over
   * MAIL_FROM_EMAIL/NAME so an existing deployment can migrate without edits.
   */
  MAIL_FROM: z.string().optional(),


  CORS_ORIGIN: z.string().default('*'),
  RESET_DB: booleanish,

  // Credential-endpoint rate limits. Configurable so the test suite can raise
  // them; the limiter behaviour itself is covered by its own test.
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  REGISTER_RATE_LIMIT_PER_15MIN: z.coerce.number().int().min(1).default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast: a half-configured server is worse than one that never starts.
  console.error(`\n[config] Invalid environment:\n${details}\n\nCopy backend/.env.example to backend/.env and fill it in.\n`);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('dev-only')) {
  console.error('[config] Refusing to start in production with the example JWT_SECRET.');
  process.exit(1);
}

/**
 * Mail configuration has to be coherent before the server accepts a signup, not
 * discovered when the first user waits ten minutes for a code that was never
 * sent. These are cheap checks and they turn a silent failure into a boot error.
 */
if (env.MAIL_MODE === 'brevo') {
  const missing: string[] = [];
  if (!env.BREVO_SMTP_USER) missing.push('BREVO_SMTP_USER');
  if (!env.BREVO_SMTP_PASSWORD) missing.push('BREVO_SMTP_PASSWORD');
  if (!env.MAIL_FROM_EMAIL && !env.MAIL_FROM) missing.push('MAIL_FROM_EMAIL');

  if (missing.length > 0 && env.NODE_ENV !== 'test') {
    console.error(
      [
        '',
        '[config] MAIL_MODE=brevo but the Brevo SMTP configuration is incomplete:',
        ...missing.map((name) => `  - ${name}`),
        '',
        'Set them in backend/.env (see .env.example), or switch MAIL_MODE to',
        '"console" for local development without a mail provider.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
}

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins:
    env.CORS_ORIGIN.trim() === '*' ? ('*' as const) : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
} as const;

export type Config = typeof config;
