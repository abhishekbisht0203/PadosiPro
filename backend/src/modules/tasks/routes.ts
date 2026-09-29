import { Router } from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { auth, requireAuth } from '../../middleware/auth.js';
import { parseBody, taskSelectionBodySchema } from '../../validation/schemas.js';

export const tasksRouter: Router = Router();

tasksRouter.use(requireAuth);

interface TaskRow {
  id: number;
  slug: string;
  name: string;
  category_id: string;
  subcategory: string;
  description: string;
  icon: string;
  category_title: string;
  category_subtitle: string;
}

const TASK_COLUMNS = `
  t.id, t.slug, t.name, t.category_id, t.subcategory, t.description, t.icon,
  c.title AS category_title, c.subtitle AS category_subtitle
`;

/**
 * The catalogue, grouped by category and ordered the same way the app renders
 * it. Returns `selected` per task so the selection screen renders from a single
 * request instead of two.
 *
 * Response fields are camelCase to match every other endpoint; the database
 * columns they come from are snake_case. `/selected` used to leak the raw
 * `category_id`, which the app silently ignored.
 */
interface CatalogueTask {
  id: number;
  slug: string;
  name: string;
  categoryId: string;
  subcategory: string;
  description: string;
  icon: string;
  selected: boolean;
}

tasksRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { rows } = await query<TaskRow & { selected: boolean }>(
      `SELECT ${TASK_COLUMNS},
              (ut.user_id IS NOT NULL) AS selected
         FROM tasks t
         JOIN categories c ON c.id = t.category_id
         LEFT JOIN user_tasks ut ON ut.task_id = t.id AND ut.user_id = $1
        WHERE t.is_active
        ORDER BY c.sort_order, t.sort_order, t.name`,
      [userId],
    );

    const categories = new Map<
      string,
      { id: string; title: string; subtitle: string; icon: string; tasks: CatalogueTask[] }
    >();

    for (const row of rows) {
      const entry = categories.get(row.category_id) ?? {
        id: row.category_id,
        title: row.category_title,
        subtitle: row.category_subtitle,
        icon: row.icon,
        tasks: [],
      };
      entry.tasks.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        categoryId: row.category_id,
        subcategory: row.subcategory,
        description: row.description,
        icon: row.icon,
        selected: row.selected,
      });
      categories.set(row.category_id, entry);
    }

    res.json({
      data: {
        categories: [...categories.values()],
        totalTasks: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/selected', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { rows } = await query<TaskRow & { selected_at: Date }>(
      `SELECT ${TASK_COLUMNS}, ut.created_at AS selected_at
         FROM user_tasks ut
         JOIN tasks t ON t.id = ut.task_id
         JOIN categories c ON c.id = t.category_id
        WHERE ut.user_id = $1
        ORDER BY c.sort_order, t.sort_order, t.name`,
      [userId],
    );

    res.json({
      data: {
        tasks: rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          categoryId: row.category_id,
          categoryTitle: row.category_title,
          subcategory: row.subcategory,
          description: row.description,
          icon: row.icon,
          selectedAt: row.selected_at.toISOString(),
        })),
        totalSelected: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Replace the whole selection in one transaction. Replacing rather than
 * toggling keeps the client simple and the server authoritative: whatever the
 * app sends is what the user has selected.
 */
tasksRouter.put('/selected', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { taskIds } = parseBody(taskSelectionBodySchema, req.body);
    const uniqueIds = [...new Set(taskIds)];

    const known = await query<{ id: number }>('SELECT id FROM tasks WHERE id = ANY($1::int[]) AND is_active', [uniqueIds]);
    const knownIds = known.rows.map((r) => r.id);

    const unknown = uniqueIds.filter((id) => !knownIds.includes(id));
    if (unknown.length > 0) {
      throw badRequest('UNKNOWN_TASKS', 'Some of the selected tasks do not exist.', {
        taskIds: `Not in the catalogue: ${unknown.join(', ')}`,
      });
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM user_tasks WHERE user_id = $1', [userId]);
      if (uniqueIds.length > 0) {
        await client.query('INSERT INTO user_tasks (user_id, task_id) SELECT $1, unnest($2::int[])', [userId, uniqueIds]);
      }
    });

    const { rows } = await query<TaskRow & { selected_at: Date }>(
      `SELECT ${TASK_COLUMNS}, ut.created_at AS selected_at
         FROM user_tasks ut
         JOIN tasks t ON t.id = ut.task_id
         JOIN categories c ON c.id = t.category_id
        WHERE ut.user_id = $1
        ORDER BY c.sort_order, t.sort_order, t.name`,
      [userId],
    );

    res.json({
      data: {
        tasks: rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          categoryId: row.category_id,
          categoryTitle: row.category_title,
          subcategory: row.subcategory,
          description: row.description,
          icon: row.icon,
          // Same shape as GET /selected so the client can treat the two
          // responses interchangeably.
          selectedAt: row.selected_at.toISOString(),
        })),
        totalSelected: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
