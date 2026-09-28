import 'dotenv/config';

/**
 * Test bootstrap.
 *
 * `MAIL_MODE` and the fixed JWT secret keep tests hermetic: no SMTP connection
 * is opened and every run produces the same tokens. Bcrypt rounds are dropped
 * to the minimum so the suite is fast.
 *
 * Database: the integration tests need Postgres. They use, in order of
 * preference, `TEST_DATABASE_URL`, then `DATABASE_URL`, then a local default.
 * Point them at Neon by putting the same URL in `.env` as the app uses.
 *
 * SAFETY: the suite truncates its own tables (`users`, `profiles`, `email_otps`,
 * `user_tasks`) between files but leaves the catalogue alone. Running that
 * against a shared or production database would destroy real accounts, so the
 * suite refuses to start unless the target is a local Postgres or
 * `ALLOW_TEST_DB_RESET=true` is set explicitly.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

function resolveDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgres://padosipro:padosipro@localhost:5432/padosipro_test';

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    console.error('[test] DATABASE_URL is not a valid URL. Check backend/.env.');
    process.exit(1);
  }

  const isLocal = LOCAL_HOSTS.includes(hostname);
  if (!isLocal && process.env.ALLOW_TEST_DB_RESET !== 'true') {
    console.error(
      [
        '',
        `The test suite will TRUNCATE tables in ${hostname}.`,
        'Refusing to run against a shared or remote database by accident.',
        '',
        'Either point the tests at a local Postgres (npm run test:embedded),',
        'or set ALLOW_TEST_DB_RESET=true if this database exists only for these tests.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  return url;
}

process.env.NODE_ENV = 'test';
process.env.MAIL_MODE = 'console';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-0000000000000000';
process.env.BCRYPT_ROUNDS = '4';
process.env.OTP_BCRYPT_ROUNDS = '4';
process.env.DATABASE_URL = resolveDatabaseUrl();

// The functional suite registers more accounts than a 15 minute window allows,
// and it is not testing the limiter. Rate limiting has its own focused test
// (`rateLimit.test.ts`) using a deliberately tiny budget.
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';
process.env.REGISTER_RATE_LIMIT_PER_15MIN = '10000';
