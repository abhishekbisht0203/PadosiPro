import pg from 'pg';
import { config } from '../env.js';

const { Pool, types } = pg;

/**
 * `pg` returns BIGINT (int8) as a string to avoid precision loss. Every bigint
 * in this schema is a count, so parsing it to a number is safe and avoids
 * surprising string ids leaking into JSON responses.
 */
types.setTypeParser(types.builtins.INT8, (value: string) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // An idle client dropped by the server should not take the process down.
  console.error('[db] unexpected idle client error', err.message);
});

export type SqlParam = string | number | boolean | null | Date | object;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: SqlParam[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/** Convenience for single-row queries. */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: SqlParam[] = [],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
