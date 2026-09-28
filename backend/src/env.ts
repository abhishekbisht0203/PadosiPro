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

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  OTP_BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(30),

  MAIL_MODE: z.enum(['smtp', 'console']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('PadosiPro <no-reply@padosipro.local>'),

  CORS_ORIGIN: z.string().default('*'),
  RESET_DB: booleanish,
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

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins:
    env.CORS_ORIGIN.trim() === '*' ? ('*' as const) : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
} as const;

export type Config = typeof config;
