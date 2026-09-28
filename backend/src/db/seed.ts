import crypto from 'node:crypto';
import { CATALOGUE } from './catalogue.js';
import { closePool, query } from './pool.js';
import { runMigrations } from './migrate.js';

/**
 * Idempotent catalogue seed.
 *
 * Categories and tasks are keyed on natural columns (not on generated ids) so
 * that re-running the seed after a content change updates rows in place
 * instead of duplicating them — a user who already selected "Plumber" keeps
 * their selection.
 *
 * The whole catalogue is written in two statements using `unnest`. That matters
 * more than it looks: the API is pointed at a managed Postgres (Neon) where each
 * round trip costs tens of milliseconds across the internet, so the obvious
 * one-statement-per-row version pushes boot into minutes. Two round trips keeps
 * start-up quick on any network.
 */

function slugify(categoryId: string, name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${categoryId}:${base}`;
}

export async function seedCatalogue(): Promise<{ categories: number; tasks: number }> {
  const categoryRows = CATALOGUE.map((category, index) => [
    category.id,
    category.title,
    category.subtitle,
    category.icon,
    index,
  ]);

  const taskRows = CATALOGUE.flatMap((category) =>
    category.tasks.map((task, taskIndex) => [
      slugify(category.id, task.name),
      task.name,
      category.id,
      task.subcategory,
      task.description,
      category.icon,
      taskIndex,
    ]),
  );

  const columns = <T,>(rows: T[][], index: number) => rows.map((row) => row[index]);

  await query(
    `INSERT INTO categories (id, title, subtitle, icon, sort_order)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::smallint[])
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           icon = EXCLUDED.icon,
           sort_order = EXCLUDED.sort_order`,
    [
      columns(categoryRows, 0),
      columns(categoryRows, 1),
      columns(categoryRows, 2),
      columns(categoryRows, 3),
      columns(categoryRows, 4),
    ],
  );

  await query(
    `INSERT INTO tasks (slug, name, category_id, subcategory, description, icon, sort_order)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::smallint[])
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           subcategory = EXCLUDED.subcategory,
           description = EXCLUDED.description,
           icon = EXCLUDED.icon,
           sort_order = EXCLUDED.sort_order,
           is_active = TRUE`,
    [
      columns(taskRows, 0),
      columns(taskRows, 1),
      columns(taskRows, 2),
      columns(taskRows, 3),
      columns(taskRows, 4),
      columns(taskRows, 5),
      columns(taskRows, 6),
    ],
  );

  return { categories: categoryRows.length, tasks: taskRows.length };
}

/** Wipes all app data but keeps the catalogue. Used by the test harness. */
export async function truncateAppData(): Promise<void> {
  await query('TRUNCATE user_tasks, profiles, email_otps, users RESTART IDENTITY CASCADE');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('seed.ts');

if (isDirectRun) {
  runMigrations()
    .then(() => seedCatalogue())
    .then(({ categories, tasks }) => {
      console.info(`[seed] ${categories} categories, ${tasks} tasks ready (id ${crypto.randomUUID().slice(0, 8)})`);
    })
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[seed] failed:', err);
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
