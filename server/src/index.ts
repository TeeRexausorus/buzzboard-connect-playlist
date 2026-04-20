import cors from "cors";
import express from "express";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { pool, initDatabase } from "./db";
import { env, validateEnv } from "./env";
import { createQuizSchema, loginSchema, updateQuizSchema } from "./validation";

type QuizRow = {
  id: string;
  user_id: string | null;
  name: string;
  questions: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserRow = {
  id: string;
  login: string;
  password_hash: string;
};

const mapRowToQuiz = (row: QuizRow) => ({
  id: row.id,
  name: row.name,
  questions: row.questions,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

const TOKEN_SEPARATOR = ".";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const derivedHash = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  if (derivedHash.length !== expectedBuffer.length) return false;
  return timingSafeEqual(derivedHash, expectedBuffer);
};

const signToken = (userId: string, expiresAt: number): string => {
  const payload = `${userId}:${expiresAt}`;
  const signature = createHmac("sha256", env.authSecret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}${TOKEN_SEPARATOR}${signature}`;
};

const createAuthToken = (userId: string) => {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return {
    token: signToken(userId, expiresAt),
    expiresAt,
  };
};

const verifyAuthToken = (token: string): { userId: string } | null => {
  const [encodedPayload, providedSignature] = token.split(TOKEN_SEPARATOR);
  if (!encodedPayload || !providedSignature) return null;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const [userId, expiresAtRaw] = payload.split(":");
  const expiresAt = Number.parseInt(expiresAtRaw ?? "", 10);

  if (!userId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expectedSignature = createHmac("sha256", env.authSecret)
    .update(`${userId}:${expiresAt}`)
    .digest();

  const actualSignature = Buffer.from(providedSignature, "base64url");
  if (expectedSignature.length !== actualSignature.length) return null;
  if (!timingSafeEqual(expectedSignature, actualSignature)) return null;

  return { userId };
};

type AuthenticatedRequest = express.Request & { auth: { userId: string } };

const requireAuth: express.RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const auth = verifyAuthToken(header.slice("Bearer ".length));
  if (!auth) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  (req as AuthenticatedRequest).auth = auth;
  next();
};

const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const normalizedLogin = payload.login.trim().toLowerCase();

    const existing = await pool.query<UserRow>(
      "SELECT id, login, password_hash FROM users WHERE login = $1",
      [normalizedLogin],
    );

    let user: UserRow;
    let created = false;

    if (existing.rowCount === 0) {
      const inserted = await pool.query<UserRow>(
        `
        INSERT INTO users (id, login, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, login, password_hash
        `,
        [randomUUID(), normalizedLogin, hashPassword(payload.password)],
      );
      user = inserted.rows[0];
      created = true;
    } else {
      user = existing.rows[0];
      if (!verifyPassword(payload.password, user.password_hash)) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
    }

    const session = createAuthToken(user.id);

    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        login: user.login,
      },
      created,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query<QuizRow>(
      `
      SELECT id, user_id, name, questions, created_at, updated_at
      FROM quizzes
      WHERE user_id = $1
      ORDER BY created_at ASC
      `,
      [authReq.auth.userId],
    );
    res.json(result.rows.map(mapRowToQuiz));
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes/:id", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query<QuizRow>(
      `
      SELECT id, user_id, name, questions, created_at, updated_at
      FROM quizzes
      WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, authReq.auth.userId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    res.json(mapRowToQuiz(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post("/api/quizzes", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payload = createQuizSchema.parse(req.body);
    const id = randomUUID();
    const result = await pool.query<QuizRow>(
      `
      INSERT INTO quizzes (id, user_id, name, questions)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, user_id, name, questions, created_at, updated_at
      `,
      [id, authReq.auth.userId, payload.name, JSON.stringify(payload.questions)],
    );

    res.status(201).json(mapRowToQuiz(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/quizzes/:id", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payload = updateQuizSchema.parse(req.body);

    const result = await pool.query<QuizRow>(
      `
      UPDATE quizzes
      SET
        name = COALESCE($2, name),
        questions = COALESCE($3::jsonb, questions),
        updated_at = NOW()
      WHERE id = $1 AND user_id = $4
      RETURNING id, user_id, name, questions, created_at, updated_at
      `,
      [
        req.params.id,
        payload.name ?? null,
        payload.questions === undefined ? null : JSON.stringify(payload.questions),
        authReq.auth.userId,
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    res.json(mapRowToQuiz(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/quizzes/:id", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query("DELETE FROM quizzes WHERE id = $1 AND user_id = $2", [
      req.params.id,
      authReq.auth.userId,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid payload",
      issues: error.issues,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

const start = async (): Promise<void> => {
  validateEnv();
  await initDatabase();

  app.listen(env.port, () => {
    console.log(`Quiz backend listening on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
