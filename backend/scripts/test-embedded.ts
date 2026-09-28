import { startEmbeddedPostgres } from '../src/tests/embedded-pg.js';

/**
 * Boots an ephemeral Postgres, points the suite at it, runs vitest, then shuts
 * Postgres down. Used by `npm run test:embedded`, for reviewers who want to
 * run the integration tests without a Docker daemon.
 */
async function main(): Promise<never> {
  const port = process.env.EMBEDDED_PG_PORT ?? '55432';
  const pg = await startEmbeddedPostgres();

  process.env.DATABASE_URL = `postgres://padosipro:padosipro@localhost:${port}/padosipro_test`;
  process.env.NODE_ENV = 'test';

  const { spawn } = await import('node:child_process');

  const child = spawn('npx', ['vitest', 'run', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });

  const code = await new Promise<number>((resolve) => {
    child.on('exit', (c) => resolve(c ?? 1));
  });

  await pg.stop();
  process.exit(code);
}

main().catch((err) => {
  console.error('[test:embedded] failed to run the suite:', err);
  process.exit(1);
});
