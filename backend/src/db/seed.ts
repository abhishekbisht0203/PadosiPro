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
  let categoryCount = 0;
  let taskCount = 0;

  for (const [categoryIndex, category] of CATALOGUE.entries()) {
    await query(
      `INSERT INTO categories (id, title, subtitle, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title,
             subtitle = EXCLUDED.subtitle,
             icon = EXCLUDED.icon,
             sort_order = EXCLUDED.sort_order`,
      [category.id, category.title, category.subtitle, category.icon, categoryIndex],
    );
    categoryCount += 1;

    for (const [taskIndex, task] of category.tasks.entries()) {
      await query(
        `INSERT INTO tasks (slug, name, category_id, subcategory, description, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               category_id = EXCLUDED.category_id,
               subcategory = EXCLUDED.subcategory,
               description = EXCLUDED.description,
               icon = EXCLUDED.icon,
               sort_order = EXCLUDED.sort_order,
               is_active = TRUE`,
        [slugify(category.id, task.name), task.name, category.id, task.subcategory, task.description, category.icon, taskIndex],
      );
      taskCount += 1;
    }
  }

  return { categories: categoryCount, tasks: taskCount };
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
