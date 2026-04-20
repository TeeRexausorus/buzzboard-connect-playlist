import { config } from "dotenv";

config();

const parseIntOrDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseIntOrDefault(process.env.BACKEND_PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  authSecret: process.env.AUTH_SECRET ?? "dev-only-auth-secret-change-me",
  databaseUrl: process.env.DATABASE_URL,
  dbHost: process.env.DB_HOST,
  dbPort: parseIntOrDefault(process.env.DB_PORT, 5432),
  dbName: process.env.DB_NAME,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbSsl: parseBoolean(process.env.DB_SSL),
  pgSslMode: process.env.PGSSLMODE,
};

export const validateEnv = (): void => {
  if (env.nodeEnv === "production" && env.authSecret === "dev-only-auth-secret-change-me") {
    throw new Error("Missing AUTH_SECRET in production.");
  }

  if (env.databaseUrl) return;

  const missing = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter(
    (key) => !process.env[key],
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing database environment variables: ${missing.join(", ")}. Set DATABASE_URL or DB_* values.`,
    );
  }
};
