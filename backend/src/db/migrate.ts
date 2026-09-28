import { config } from '../env.js';
import { closePool, pool, query } from './pool.js';
import { migrations } from './migrations.js';

const TABLES_IN_DEPENDENCY_ORDER = [
  'user_tasks',
  'tasks',
  'categories',
  'profiles',
  'email_otps',
  'users',
  'schema_migrations',
];

export async function runMigrations({ reset = config.RESET_DB }: { reset?: boolean } = {}): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  if (reset) {
    console.info('[migrate] RESET_DB=true — dropping existing tables');
    await query(`DROP TABLE IF EXISTS ${TABLES_IN_DEPENDENCY_ORDER.join(', ')} CASCADE`);
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  const { rows } = await query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      console.info(`[migrate] skip ${migration.id} (already applied)`);
      continue;
    }
    console.info(`[migrate] applying ${migration.id}`);
    await query(migration.sql);
    await query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
  }

  console.info('[migrate] up to date');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('migrate.ts');

if (isDirectRun) {
  runMigrations({ reset: process.argv.includes('--reset') })
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[migrate] failed:', err);
      await pool.end().catch(() => undefined);
      process.exit(1);
    });
}
