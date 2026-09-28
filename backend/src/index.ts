import { createApp } from './app.js';
import { config } from './env.js';
import { closePool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { seedCatalogue } from './db/seed.js';

async function main(): Promise<void> {
  // Bring the schema up to date before accepting traffic so a fresh
  // `docker compose up` needs no extra step.
  await runMigrations();
  const seeded = await seedCatalogue();
  console.info(`[boot] catalogue ready: ${seeded.categories} categories, ${seeded.tasks} tasks`);

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.info(`[boot] PadosiPro API listening on http://localhost:${config.PORT}`);
    console.info(`[boot] health check:      http://localhost:${config.PORT}/health`);
    console.info(`[boot] mail mode:         ${config.MAIL_MODE}`);
  });

  const shutdown = (signal: string) => {
    console.info(`\n[boot] ${signal} received — shutting down`);
    server.close(() => {
      closePool()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    // Do not hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[boot] failed to start:', err);
  process.exit(1);
});
