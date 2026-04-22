import { Pool } from "pg";
import { env } from "./env";

const shouldUseSsl = (): boolean => {
  if (env.dbSsl !== undefined) return env.dbSsl;
  if (env.pgSslMode === "disable") return false;
  if (env.pgSslMode === "require" || env.pgSslMode === "prefer") return true;
  return Boolean(env.databaseUrl);
};

const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false;

const poolConfig = env.databaseUrl
  ? {
      connectionString: env.databaseUrl,
      ssl,
    }
  : {
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword,
      ssl,
    };

export const pool = new Pool(poolConfig);

export const initDatabase = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email TEXT;
  `);

  await pool.query(`
    UPDATE users
    SET email = login
    WHERE email IS NULL;
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN email SET NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users (email);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS access_token TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS refresh_token TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_quizzes_user_id_created_at
    ON quizzes (user_id, created_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_collaborators (
      id UUID PRIMARY KEY,
      quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (quiz_id, user_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_quiz_collaborators_user_id
    ON quiz_collaborators (user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_quiz_collaborators_quiz_id
    ON quiz_collaborators (quiz_id);
  `);
};
