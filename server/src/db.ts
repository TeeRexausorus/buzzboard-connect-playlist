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
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
};
