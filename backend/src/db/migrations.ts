/**
 * Schema migrations.
 *
 * Deliberately plain SQL applied in order, tracked in `schema_migrations`.
 * No ORM: the schema is small enough to read in one sitting during the final
 * round, which is worth more here than the convenience of a query builder.
 */

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '0001_init',
    sql: /* sql */ `
      -- No extensions are required: gen_random_uuid() is in core from
      -- PostgreSQL 13, and case-insensitive email uniqueness is handled by a
      -- functional index. Depending on contrib/citext would make the schema
      -- fail to migrate on a stripped-down Postgres image.

      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Normalised to lowercase by the validation layer. The functional index
        -- below is the actual case-insensitive guarantee, and is also the
        -- unique constraint that an insert-on-conflict resolves against.
        email         TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

      -- One row per issued code. Previous codes are kept (consumed) rather than
      -- deleted so that "this code was already used" stays distinguishable from
      -- "this code was never valid".
      CREATE TABLE IF NOT EXISTS email_otps (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        code_hash   TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        attempts    SMALLINT NOT NULL DEFAULT 0,
        max_attempts SMALLINT NOT NULL DEFAULT 5,
        consumed_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT email_otps_attempts_non_negative CHECK (attempts >= 0)
      );

      CREATE INDEX IF NOT EXISTS email_otps_user_created_idx
        ON email_otps (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS profiles (
        user_id       UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        mobile        TEXT NOT NULL,
        address       TEXT NOT NULL,
        business_name TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT profiles_mobile_format CHECK (mobile ~ '^[6-9][0-9]{9}$')
      );

      CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        subtitle    TEXT NOT NULL,
        icon        TEXT NOT NULL,
        sort_order  SMALLINT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id           SERIAL PRIMARY KEY,
        slug         TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        category_id  TEXT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
        subcategory  TEXT NOT NULL,
        description  TEXT NOT NULL,
        icon         TEXT NOT NULL,
        sort_order   SMALLINT NOT NULL DEFAULT 0,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (category_id, name)
      );

      CREATE INDEX IF NOT EXISTS tasks_category_idx ON tasks (category_id, sort_order);

      CREATE TABLE IF NOT EXISTS user_tasks (
        user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, task_id)
      );

      CREATE INDEX IF NOT EXISTS user_tasks_user_idx ON user_tasks (user_id, created_at);
    `,
  },
];
