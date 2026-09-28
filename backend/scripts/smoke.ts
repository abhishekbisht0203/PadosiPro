/**
 * Boots an ephemeral Postgres and the real API, then walks the whole customer
 * journey over HTTP exactly as the mobile app does. Run with:
 *
 *   npm run smoke
 *
 * This is the check that the containerised stack behaves like the test suite:
 * same migrations, same seed, same routes, but through a real socket.
 */
import { spawn } from 'node:child_process';
import { startEmbeddedPostgres } from '../src/tests/embedded-pg.js';

const PORT = 5599;
const BASE = `http://127.0.0.1:${PORT}`;

type Json = Record<string, any>;

async function call(method: string, path: string, body?: Json, token?: string): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

let failures = 0;
function check(label: string, condition: boolean, extra?: unknown) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

async function waitForHealth(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const pg = await startEmbeddedPostgres();
  const databaseUrl = `postgres://padosipro:padosipro@localhost:${process.env.EMBEDDED_PG_PORT ?? 55432}/padosipro_test`;

  const api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(PORT), DATABASE_URL: databaseUrl, MAIL_MODE: 'console' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  api.stdout.on('data', (d) => {
    serverLog += String(d);
  });
  api.stderr.on('data', (d) => {
    serverLog += String(d);
  });

  try {
    console.log('\nWaiting for the API to become healthy...');
    const healthy = await waitForHealth();
    if (!healthy) {
      console.error('The API never became healthy. Server output:\n', serverLog);
      process.exitCode = 1;
      return;
    }
    console.log('API is up.\n');

    const email = `smoke.${Date.now()}@example.com`;
    const password = 'Str0ngPass!';

    console.log('1. Health & catalogue');
    const health = await call('GET', '/health');
    check('GET /health returns ok', health.body.status === 'ok');
    const meta = await call('GET', '/api/meta');
    check(`catalogue has >= 20 tasks (${meta.body?.data?.tasks})`, (meta.body?.data?.tasks ?? 0) >= 20);
    check(`catalogue has >= 4 categories (${meta.body?.data?.categories})`, (meta.body?.data?.categories ?? 0) >= 4);

    console.log('\n2. Register');
    const reg = await call('POST', '/api/auth/register', { email, password });
    check('register returns 201', reg.status === 201, reg.body);
    check('register says verify next', reg.body?.data?.nextStep === 'verify_email');

    const code = /CODE:\s*(\d{6})/.exec(serverLog)?.[1];
    check('verification code was emailed to the console outbox', Boolean(code), 'no CODE: marker in mail output');

    console.log('\n3. Verify email');
    const wrong = await call('POST', '/api/auth/verify-otp', { email, code: '000000' });
    check('wrong OTP is rejected', wrong.status === 400, wrong.body);
    check('wrong OTP reports remaining attempts', /4 attempt/.test(wrong.body?.error?.message ?? ''), wrong.body);

    const verified = await call('POST', '/api/auth/verify-otp', { email, code });
    check('correct OTP verifies', verified.status === 200, verified.body);
    const token: string = verified.body?.data?.token;
    check('a session token is issued', Boolean(token));

    console.log('\n4. Login');
    const badLogin = await call('POST', '/api/auth/login', { email, password: 'Wr0ngPass!' });
    check('wrong password is rejected', badLogin.status === 401, badLogin.body);
    const login = await call('POST', '/api/auth/login', { email, password });
    check('login succeeds', login.status === 200, login.body);

    console.log('\n5. Session routing');
    const anon = await call('GET', '/api/auth/me');
    check('unauthenticated /me is rejected', anon.status === 401);
    const me = await call('GET', '/api/auth/me', undefined, token);
    check('authenticated /me works', me.status === 200, me.body);
    check('profile is incomplete on first login', me.body?.data?.hasCompletedProfile === false);

    console.log('\n6. Profile');
    const badProfile = await call(
      'PUT',
      '/api/profile',
      { name: 'Arjun Rao', mobile: '12345', address: '12 Banjara Hills, Hyderabad 500034' },
      token,
    );
    check('invalid mobile is rejected', badProfile.status === 400, badProfile.body);
    check('error names the offending field', Boolean(badProfile.body?.error?.details?.mobile));

    const profile = await call(
      'PUT',
      '/api/profile',
      { name: 'Arjun Rao', mobile: '+91 98765 43210', address: '12 Banjara Hills, Hyderabad 500034' },
      token,
    );
    check('profile saves', profile.status === 200, profile.body);
    check('mobile normalised to 10 digits', profile.body?.data?.profile?.mobile === '9876543210');
    check('business name is optional', profile.body?.data?.profile?.businessName === null);

    console.log('\n7. Task selection');
    const catalogue = await call('GET', '/api/tasks', undefined, token);
    check('catalogue loads', catalogue.status === 200);
    const allTasks = catalogue.body.data.categories.flatMap((c: Json) => c.tasks);
    check(`tasks are grouped by category (${catalogue.body.data.categories.length} groups)`, catalogue.body.data.categories.length >= 4);
    check('every task has a description', allTasks.every((t: Json) => typeof t.description === 'string' && t.description.length > 10));

    const chosen = allTasks.slice(0, 4).map((t: Json) => t.id);
    const saveSel = await call('PUT', '/api/tasks/selected', { taskIds: chosen }, token);
    check('selection saves', saveSel.status === 200, saveSel.body);
    check('selection round-trips', saveSel.body?.data?.totalSelected === 4);

    const idempotent = await call('PUT', '/api/tasks/selected', { taskIds: chosen }, token);
    check('re-saving the same selection is idempotent', idempotent.body?.data?.totalSelected === 4);

    const selected = await call('GET', '/api/tasks/selected', undefined, token);
    check('selection can be read back', selected.body?.data?.totalSelected === 4);

    console.log('\n8. Session persists');
    const me2 = await call('GET', '/api/auth/me', undefined, token);
    check('profile is now complete', me2.body?.data?.hasCompletedProfile === true);
    check('selected task count is reported', me2.body?.data?.selectedTaskCount === 4);

    console.log('\n9. Logout safety');
    const clearedToken = await call('GET', '/api/auth/me', undefined, 'garbage.token.here');
    check('a tampered token is rejected', clearedToken.status === 401);
    const missing = await call('GET', '/api/tasks');
    check('tasks require a token', missing.status === 401);
  } finally {
    api.kill();
    await pg.stop();
  }

  console.log(`\n${failures === 0 ? 'SMOKE TEST PASSED' : `SMOKE TEST FAILED (${failures} check(s))`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
