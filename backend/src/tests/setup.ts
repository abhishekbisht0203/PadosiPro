/**
 * Test bootstrap.
 *
 * `MAIL_MODE=console` and a fixed JWT secret keep tests hermetic: no SMTP
 * connection is opened and every run produces the same tokens.
 *
 * The integration tests need a Postgres. `docker compose up -d postgres`
 * provides one; see README "Running the tests".
 */
process.env.NODE_ENV = 'test';
process.env.MAIL_MODE = 'console';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-0000000000000000';
process.env.BCRYPT_ROUNDS = '4';
process.env.OTP_BCRYPT_ROUNDS = '4';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://padosipro:padosipro@localhost:5432/padosipro_test';
// The functional suite registers more accounts than a 15 minute window allows,
// and it is not testing the limiter. Rate limiting has its own focused test
// (`rateLimit.test.ts`) using a deliberately tiny budget.
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';
process.env.REGISTER_RATE_LIMIT_PER_15MIN = '10000';
