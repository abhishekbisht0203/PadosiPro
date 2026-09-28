/**
 * Boots the API (with a throwaway Postgres) on port 4000 and leaves it running
 * so the mobile app can be driven against it by hand or by a browser test.
 *
 *   npm run dev:stack
 *
 * The verification code is printed to this console as it is issued.
 */
import { spawn } from 'node:child_process';
import { startEmbeddedPostgres } from '../src/tests/embedded-pg.js';

const EMBEDDED_PORT = process.env.EMBEDDED_PG_PORT ?? '55432';
const API_PORT = process.env.PORT ?? '4000';

async function waitForHealth(timeoutMs = 40_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const pg = await startEmbeddedPostgres();
  const databaseUrl = `postgres://padosipro:padosipro@localhost:${EMBEDDED_PORT}/padosipro_test`;

  const api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: API_PORT,
      DATABASE_URL: databaseUrl,
      MAIL_MODE: 'console',
    },
    stdio: 'inherit',
  });

  const healthy = await waitForHealth();
  if (!healthy) {
    console.error('The API never became healthy.');
    await pg.stop();
    process.exit(1);
  }

  console.info(
    `\n  API ready on http://localhost:${API_PORT}\n` +
      `  Verification codes are printed above (look for "CODE:").\n` +
      `  Press Ctrl+C to stop.\n`,
  );

  const stop = async () => {
    api.kill();
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  api.on('exit', () => void stop());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
