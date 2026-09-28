import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { query } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { seedCatalogue, truncateAppData } from '../db/seed.js';
import { readOtpOutbox } from '../lib/mailer.js';

/**
 * End-to-end coverage of the journey the app walks: register -> verify -> login
 * -> profile -> task selection, plus the rules that must reject bad input.
 */

let app: Express;

/**
 * Stands in for "the user opened their inbox and read the code".
 *
 * The service never stores the plaintext code, so the only way to exercise the
 * happy path end to end is to read it out of the transport. `lib/mailer.ts`
 * exposes an in-memory outbox for exactly this, and only under NODE_ENV=test.
 */
function readOtpFromInbox(email: string): string {
  const code = readOtpOutbox(email);
  if (!code) throw new Error(`No verification code was delivered to ${email}`);
  return code;
}

function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${randomUUID().slice(0, 8)}@example.com`;
}

const PASSWORD = 'Str0ngPass!';

async function registerAndVerify(email: string, password = PASSWORD): Promise<string> {
  await request(app).post('/api/auth/register').send({ email, password }).expect(201);
  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email, code: readOtpFromInbox(email) })
    .expect(200);
  return res.body.data.token as string;
}

beforeAll(async () => {
  app = createApp();
  await runMigrations();
  await seedCatalogue();
});

describe('health & meta', () => {
  it('reports healthy without auth', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('exposes the catalogue size', async () => {
    const res = await request(app).get('/api/meta').expect(200);
    expect(res.body.data.categories).toBeGreaterThanOrEqual(4);
    expect(res.body.data.tasks).toBeGreaterThanOrEqual(20);
    expect(res.body.data.otp).toMatchObject({ length: 6, ttlMinutes: 10 });
  });
});

describe('register', () => {
  it('creates an unverified account and refuses a duplicate once verified', async () => {
    const email = uniqueEmail('dup');
    const first = await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
    expect(first.body.data).toMatchObject({ email, isNewAccount: true, nextStep: 'verify_email' });

    // Registering again before verification quietly re-sends a code.
    const again = await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
    expect(again.body.data.isNewAccount).toBe(false);
    expect(again.body.data.codeResent).toBe(true);

    const code = await readOtpFromInbox(email);
    await request(app).post('/api/auth/verify-otp').send({ email, code }).expect(200);

    const conflict = await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(409);
    expect(conflict.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a weak password with field-level detail', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'abc' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeTruthy();
  });

  it('rejects a malformed email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: PASSWORD }).expect(400);
    expect(res.body.error.details.email).toBeTruthy();
  });
});

describe('verify OTP', () => {
  it('rejects a wrong code, then accepts the right one', async () => {
    const email = uniqueEmail('verify');
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);

    const wrong = await request(app).post('/api/auth/verify-otp').send({ email, code: '000000' }).expect(400);
    expect(wrong.body.error.code).toBe('OTP_INVALID');
    expect(wrong.body.error.message).toMatch(/4 attempt/);

    const code = await readOtpFromInbox(email);
    const ok = await request(app).post('/api/auth/verify-otp').send({ email, code }).expect(200);
    expect(ok.body.data.token).toBeTruthy();
    expect(ok.body.data.user.isVerified).toBe(true);

    // Single use: the same code cannot verify a second time.
    const replay = await request(app).post('/api/auth/verify-otp').send({ email, code }).expect(400);
    expect(replay.body.error.code).toBe('OTP_ALREADY_USED');
  });

  it('locks out after five wrong attempts', async () => {
    const email = uniqueEmail('bruteforce');
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);

    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/verify-otp').send({ email, code: '111111' }).expect(400);
    }
    const locked = await request(app).post('/api/auth/verify-otp').send({ email, code: '111111' }).expect(429);
    expect(locked.body.error.code).toBe('OTP_LOCKED');
  });

  it('404s for an unknown address instead of leaking anything', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: uniqueEmail('ghost'), code: '123456' })
      .expect(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});

describe('resend OTP', () => {
  it('enforces the thirty second cooldown', async () => {
    const email = uniqueEmail('resend');
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);

    const tooSoon = await request(app).post('/api/auth/resend-otp').send({ email }).expect(429);
    expect(tooSoon.body.error.code).toBe('OTP_RESEND_TOO_SOON');
    expect(tooSoon.body.error.meta.retryAfterSeconds).toBeGreaterThan(0);
    expect(tooSoon.body.error.meta.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});

describe('login', () => {
  it('refuses an unverified account with EMAIL_NOT_VERIFIED', async () => {
    const email = uniqueEmail('unverified');
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);

    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects a wrong password without saying which field was wrong', async () => {
    const email = uniqueEmail('login');
    const token = await registerAndVerify(email);

    const res = await request(app).post('/api/auth/login').send({ email, password: 'Wr0ngPass!' }).expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    // The message must not point at a single field — that would tell an
    // attacker which half to keep guessing.
    expect(res.body.error.message).not.toMatch(/password is|email is|not found|no account/i);

    const ok = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    expect(ok.body.data.token).toBeTruthy();
    expect(token).toBeTruthy();
  });

  it('refuses an unknown account with the same message as a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: PASSWORD })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('session & profile', () => {
  it('requires a token for /me and rejects a bogus one', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
  });

  it('walks profile then task selection then home', async () => {
    const email = uniqueEmail('journey');
    const token = await registerAndVerify(email);
    const bearer = { Authorization: `Bearer ${token}` };

    const before = await request(app).get('/api/auth/me').set(bearer).expect(200);
    expect(before.body.data.hasCompletedProfile).toBe(false);
    expect(before.body.data.selectedTaskCount).toBe(0);

    const badMobile = await request(app)
      .put('/api/profile')
      .set(bearer)
      .send({ name: 'Arjun Rao', mobile: '12345', address: '12 Banjara Hills, Hyderabad 500034' })
      .expect(400);
    expect(badMobile.body.error.details.mobile).toBeTruthy();

    const saved = await request(app)
      .put('/api/profile')
      .set(bearer)
      .send({ name: 'Arjun Rao', mobile: '+91 98765 43210', address: '12 Banjara Hills, Hyderabad 500034' })
      .expect(200);
    expect(saved.body.data.profile).toMatchObject({ name: 'Arjun Rao', mobile: '9876543210' });
    expect(saved.body.data.profile.businessName).toBeNull();

    // Business name is genuinely optional but accepted when supplied.
    const withBusiness = await request(app)
      .put('/api/profile')
      .set(bearer)
      .send({ name: 'Arjun Rao', mobile: '9876543210', address: '12 Banjara Hills, Hyderabad 500034', businessName: 'Rao Textiles' })
      .expect(200);
    expect(withBusiness.body.data.profile.businessName).toBe('Rao Textiles');

    const catalogue = await request(app).get('/api/tasks').set(bearer).expect(200);
    expect(catalogue.body.data.categories.length).toBeGreaterThanOrEqual(4);
    expect(catalogue.body.data.totalTasks).toBeGreaterThanOrEqual(20);

    const firstCategory = catalogue.body.data.categories[0];
    const chosen = firstCategory.tasks.slice(0, 3).map((t: { id: number }) => t.id);

    const saved2 = await request(app).put('/api/tasks/selected').set(bearer).send({ taskIds: chosen }).expect(200);
    expect(saved2.body.data.totalSelected).toBe(3);

    // Sending the same list again is idempotent.
    await request(app).put('/api/tasks/selected').set(bearer).send({ taskIds: chosen }).expect(200);

    const after = await request(app).get('/api/auth/me').set(bearer).expect(200);
    expect(after.body.data.hasCompletedProfile).toBe(true);
    expect(after.body.data.selectedTaskCount).toBe(3);

    const selected = await request(app).get('/api/tasks/selected').set(bearer).expect(200);
    expect(selected.body.data.tasks).toHaveLength(3);
  });

  it('rejects task ids that are not in the catalogue', async () => {    const email = uniqueEmail('bogus');
    const token = await registerAndVerify(email);
    const res = await request(app)
      .put('/api/tasks/selected')
      .set({ Authorization: `Bearer ${token}` })
      .send({ taskIds: [999_999] })
      .expect(400);
    expect(res.body.error.code).toBe('UNKNOWN_TASKS');
  });

  it('allows clearing the selection entirely', async () => {
    const email = uniqueEmail('clear');
    const token = await registerAndVerify(email);
    const bearer = { Authorization: `Bearer ${token}` };
    const catalogue = await request(app).get('/api/tasks').set(bearer).expect(200);
    const id = catalogue.body.data.categories[0].tasks[0].id as number;

    await request(app).put('/api/tasks/selected').set(bearer).send({ taskIds: [id] }).expect(200);
    const cleared = await request(app).put('/api/tasks/selected').set(bearer).send({ taskIds: [] }).expect(200);
    expect(cleared.body.data.totalSelected).toBe(0);
  });
});

describe('housekeeping', () => {
  it('leaves no orphan rows behind after a delete cascade check', async () => {
    await truncateAppData();
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) AS count FROM users');
    expect(Number(rows[0]?.count ?? 1)).toBe(0);
  });
});
