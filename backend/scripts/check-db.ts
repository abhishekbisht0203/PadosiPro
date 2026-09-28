/**
 * Checks the configured DATABASE_URL end to end: connects, reports the server
 * version, and confirms TLS is on when it should be.
 *
 *   npx tsx scripts/check-db.ts
 */
import { closePool, pool, query } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalogue } from '../src/db/seed.js';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const host = url.hostname;
  console.info(`[db] target: ${host}${url.port ? `:${url.port}` : ''}/${url.pathname.replace('/', '')}`);

  const client = await pool.connect();
  try {
    const version = await client.query<{ version: string }>('SELECT version()');
    console.info(`[db] connected: ${version.rows[0]?.version.split(',')[0]}`);
    const ssl = await client.query<{ ssl: string }>("SELECT COALESCE((SELECT version FROM pg_stat_ssl WHERE pid = pg_backend_pid()), 'off') AS ssl");
    console.info(`[db] TLS: ${ssl.rows[0]?.ssl}`);
  } finally {
    client.release();
  }

  await runMigrations();
  const seeded = await seedCatalogue();

  const counts = await query<{ categories: string; tasks: string }>(
    `SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM tasks) AS tasks`,
  );
  console.info(`[db] seeded: ${seeded.categories} categories / ${seeded.tasks} tasks written`);
  console.info(`[db] in database: ${Number(counts.rows[0]?.categories ?? 0)} categories / ${Number(counts.rows[0]?.tasks ?? 0)} tasks`);
  console.info('[db] ready');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[db] FAILED:', err instanceof Error ? err.message : err);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
