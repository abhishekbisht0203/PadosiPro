import { Router } from 'express';
import { query, queryOne } from '../../db/pool.js';
import { auth, requireAuth } from '../../middleware/auth.js';
import { parseBody, profileBodySchema } from '../../validation/schemas.js';

export interface ProfileRecord {
  name: string;
  mobile: string;
  address: string;
  businessName: string | null;
}

interface ProfileRow {
  name: string;
  mobile: string;
  address: string;
  business_name: string | null;
  updated_at: Date;
}

function toRecord(row: ProfileRow): ProfileRecord {
  return {
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    // Normalise the empty string to null so the app has one thing to branch on.
    businessName: row.business_name && row.business_name.length > 0 ? row.business_name : null,
  };
}

export const profileRouter: Router = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const row = await queryOne<ProfileRow>('SELECT name, mobile, address, business_name, updated_at FROM profiles WHERE user_id = $1', [
      userId,
    ]);
    res.json({ data: { profile: row ? toRecord(row) : null } });
  } catch (err) {
    next(err);
  }
});

/**
 * Upsert rather than insert-or-409: the profile screen is also where a user
 * corrects a typo, so it has to accept repeat writes.
 */
profileRouter.put('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { name, mobile, address, businessName } = parseBody(profileBodySchema, req.body);
    const cleanedBusiness = businessName && businessName.length > 0 ? businessName : null;

    const row = await queryOne<ProfileRow>(
      `INSERT INTO profiles (user_id, name, mobile, address, business_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET name = EXCLUDED.name,
             mobile = EXCLUDED.mobile,
             address = EXCLUDED.address,
             business_name = EXCLUDED.business_name,
             updated_at = NOW()
       RETURNING name, mobile, address, business_name, updated_at`,
      [userId, name, mobile, address, cleanedBusiness],
    );

    res.json({
      data: {
        profile: row ? toRecord(row) : null,
        nextStep: 'task_selection' as const,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Kept for completeness of the CRUD story; the app only uses GET/PUT. */
profileRouter.delete('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    await query('DELETE FROM profiles WHERE user_id = $1', [userId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
