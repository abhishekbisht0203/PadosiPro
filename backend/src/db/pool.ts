import pg from 'pg';
import { config } from '../env.js';

const { Pool, types } = pg;

/**
 * `pg` returns BIGINT (int8) as a string to avoid precision loss. Every bigint
 * in this schema is a count, so parsing it to a number is safe and avoids
 * surprising string ids leaking into JSON responses.
 */
types.setTypeParser(types.builtins.INT8, (value: string) => Number.parseInt(value, 10));

/**
 * TLS is off for a local Postgres and required for a managed one (Neon, RDS,
 * Supabase). Rather than making everyone remember to set it, TLS is enabled
 * automatically whenever the connection string asks for it or names a known
 * managed host, and can be forced either way with DATABASE_SSL.
 *
 * Certificate verification is ON by default. Every managed provider the app is
 * likely to meet (Neon included) serves a certificate from a public CA, so
 * there is no reason to weaken the default; `DATABASE_SSL=false` (or
 * NODE_EXTRA_CA_CERTS for a private CA) is the escape hatch.
 */
function sslConfig(): false | { rejectUnauthorized: boolean } {
  const url = process.env.DATABASE_URL ?? '';
  const explicit = process.env.DATABASE_SSL?.toLowerCase();

  if (explicit === 'false') return false;
  if (explicit === 'true') return { rejectUnauthorized: true };

  const needsTls =
    /sslmode=(require|prefer|verify-ca|verify-full)/i.test(url) ||
    /[?&]ssl=true/i.test(url) ||
    /@(?:ep-|pooler|)[a-z0-9-]+\.[a-z0-9-]+\.(?:neon\.tech|aws\.neon\.tech|supabase\.co|amazonaws\.com|azurewebsites\.net)/i.test(url) ||
    /\.rds\.amazonaws\.com/i.test(url);

  return needsTls ? { rejectUnauthorized: true } : false;
}

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: sslConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
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
