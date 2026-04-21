import cors from "cors";
import express from "express";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { pool, initDatabase } from "./db";
import { env, validateEnv } from "./env";
import {
  createQuizSchema,
  loginSchema,
  patchUserTokensSchema,
  putUserTokensSchema,
  shareQuizWithUserSchema,
  updateQuizSchema,
} from "./validation";

type QuizRow = {
  id: string;
  user_id: string | null;
  name: string;
  questions: unknown;
  owner_login: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type QuizAccess = "owned" | "shared";

type UserRow = {
  id: string;
  login: string;
  password_hash: string;
  access_token?: string | null;
  refresh_token?: string | null;
};

type CurrentUserRow = {
  id: string;
  login: string;
  access_token: string | null;
  refresh_token: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type QuizCollaboratorRow = {
  id: string;
  quiz_id: string;
  user_id: string;
  granted_by: string;
  login: string;
  created_at: Date | string;
};

const mapRowToQuiz = (row: QuizRow, currentUserId?: string) => ({
  id: row.id,
  name: row.name,
  questions: row.questions,
  access: row.user_id === currentUserId ? "owned" : "shared" satisfies QuizAccess,
  ownerLogin: row.owner_login,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

const mapRowToQuizCollaborator = (row: QuizCollaboratorRow) => ({
  id: row.id,
  quizId: row.quiz_id,
  userId: row.user_id,
  login: row.login,
  createdAt: new Date(row.created_at).getTime(),
});

const mapRowToCurrentUser = (row: CurrentUserRow) => ({
  id: row.id,
  login: row.login,
  accessToken: row.access_token,
  refreshToken: row.refresh_token,
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

const getSingleParam = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") return value;
  return null;
};

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

const findOwnedQuiz = async (quizId: string, userId: string): Promise<QuizRow | null> => {
  const result = await pool.query<QuizRow>(
    `
    SELECT q.id, q.user_id, q.name, q.questions, u.login AS owner_login, q.created_at, q.updated_at
    FROM quizzes q
    INNER JOIN users u ON u.id = q.user_id
    WHERE q.id = $1 AND q.user_id = $2
    `,
    [quizId, userId],
  );

  return result.rowCount === 0 ? null : result.rows[0];
};

const findAccessibleQuiz = async (quizId: string, userId: string): Promise<QuizRow | null> => {
  const result = await pool.query<QuizRow>(
    `
    SELECT q.id, q.user_id, q.name, q.questions, u.login AS owner_login, q.created_at, q.updated_at
    FROM quizzes q
    INNER JOIN users u ON u.id = q.user_id
    WHERE q.id = $1
      AND (
        q.user_id = $2
        OR EXISTS (
          SELECT 1
          FROM quiz_collaborators qc
          WHERE qc.quiz_id = q.id AND qc.user_id = $2
        )
      )
    `,
    [quizId, userId],
  );

  return result.rowCount === 0 ? null : result.rows[0];
};

const findCurrentUser = async (userId: string): Promise<CurrentUserRow | null> => {
  const result = await pool.query<CurrentUserRow>(
    `
    SELECT id, login, access_token, refresh_token, created_at, updated_at
    FROM users
    WHERE id = $1
    `,
    [userId],
  );

  return result.rowCount === 0 ? null : result.rows[0];
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

app.get("/api/me", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await findCurrentUser(authReq.auth.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: mapRowToCurrentUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/tokens", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await findCurrentUser(authReq.auth.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      accessToken: user.access_token,
      refreshToken: user.refresh_token,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/me/tokens", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payload = putUserTokensSchema.parse(req.body);

    const result = await pool.query<CurrentUserRow>(
      `
      UPDATE users
      SET access_token = $2,
          refresh_token = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, login, access_token, refresh_token, created_at, updated_at
      `,
      [authReq.auth.userId, payload.accessToken, payload.refreshToken],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: mapRowToCurrentUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/me/tokens", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payload = patchUserTokensSchema.parse(req.body);
    const hasAccessToken = payload.accessToken !== undefined;
    const hasRefreshToken = payload.refreshToken !== undefined;

    const result = await pool.query<CurrentUserRow>(
      `
      UPDATE users
      SET access_token = CASE WHEN $2 THEN $3 ELSE access_token END,
          refresh_token = CASE WHEN $4 THEN $5 ELSE refresh_token END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, login, access_token, refresh_token, created_at, updated_at
      `,
      [
        authReq.auth.userId,
        hasAccessToken,
        payload.accessToken ?? null,
        hasRefreshToken,
        payload.refreshToken ?? null,
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: mapRowToCurrentUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query<QuizRow>(
      `
      SELECT DISTINCT q.id, q.user_id, q.name, q.questions, owner_user.login AS owner_login, q.created_at, q.updated_at
      FROM quizzes q
      INNER JOIN users owner_user ON owner_user.id = q.user_id
      LEFT JOIN quiz_collaborators qc
        ON qc.quiz_id = q.id
      WHERE q.user_id = $1 OR qc.user_id = $1
      ORDER BY created_at ASC
      `,
      [authReq.auth.userId],
    );
    res.json(result.rows.map((row) => mapRowToQuiz(row, authReq.auth.userId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes/:id", requireAuth, async (req, res, next) => {
  try {
    const quizId = getSingleParam(req.params.id);
    if (!quizId) {
      res.status(400).json({ message: "Invalid quiz id" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const quiz = await findAccessibleQuiz(quizId, authReq.auth.userId);

    if (!quiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    res.json(mapRowToQuiz(quiz, authReq.auth.userId));
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
      RETURNING id
      `,
      [id, authReq.auth.userId, payload.name, JSON.stringify(payload.questions)],
    );

    const createdQuiz = await findAccessibleQuiz(result.rows[0].id, authReq.auth.userId);
    if (!createdQuiz) {
      res.status(500).json({ message: "Failed to load created quiz" });
      return;
    }

    res.status(201).json(mapRowToQuiz(createdQuiz, authReq.auth.userId));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/quizzes/:id", requireAuth, async (req, res, next) => {
  try {
    const quizId = getSingleParam(req.params.id);
    if (!quizId) {
      res.status(400).json({ message: "Invalid quiz id" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const accessibleQuiz = await findAccessibleQuiz(quizId, authReq.auth.userId);
    if (!accessibleQuiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    const payload = updateQuizSchema.parse(req.body);

    const result = await pool.query<QuizRow>(
      `
      UPDATE quizzes
      SET
        name = COALESCE($2, name),
        questions = COALESCE($3::jsonb, questions),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [
        quizId,
        payload.name ?? null,
        payload.questions === undefined ? null : JSON.stringify(payload.questions),
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    const updatedQuiz = await findAccessibleQuiz(result.rows[0].id, authReq.auth.userId);
    if (!updatedQuiz) {
      res.status(500).json({ message: "Failed to load updated quiz" });
      return;
    }

    res.json(mapRowToQuiz(updatedQuiz, authReq.auth.userId));
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

app.get("/api/quizzes/:id/share", requireAuth, async (req, res, next) => {
  try {
    const quizId = getSingleParam(req.params.id);
    if (!quizId) {
      res.status(400).json({ message: "Invalid quiz id" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const ownedQuiz = await findOwnedQuiz(quizId, authReq.auth.userId);
    if (!ownedQuiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    const result = await pool.query<QuizCollaboratorRow>(
      `
      SELECT qc.id, qc.quiz_id, qc.user_id, qc.granted_by, u.login, qc.created_at
      FROM quiz_collaborators qc
      INNER JOIN users u ON u.id = qc.user_id
      WHERE qc.quiz_id = $1
      ORDER BY u.login ASC
      `,
      [quizId],
    );

    res.json({ collaborators: result.rows.map(mapRowToQuizCollaborator) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/quizzes/:id/share", requireAuth, async (req, res, next) => {
  try {
    const quizId = getSingleParam(req.params.id);
    if (!quizId) {
      res.status(400).json({ message: "Invalid quiz id" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const ownedQuiz = await findOwnedQuiz(quizId, authReq.auth.userId);
    if (!ownedQuiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    const payload = shareQuizWithUserSchema.parse(req.body);
    const normalizedLogin = payload.login.trim().toLowerCase();

    const targetUserResult = await pool.query<UserRow>(
      "SELECT id, login, password_hash FROM users WHERE login = $1",
      [normalizedLogin],
    );

    if (targetUserResult.rowCount === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const targetUser = targetUserResult.rows[0];
    if (targetUser.id === authReq.auth.userId) {
      res.status(400).json({ message: "You already own this quiz" });
      return;
    }

    const created = await pool.query<QuizCollaboratorRow>(
      `
      INSERT INTO quiz_collaborators (id, quiz_id, user_id, granted_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (quiz_id, user_id) DO UPDATE
      SET granted_by = EXCLUDED.granted_by
      RETURNING id, quiz_id, user_id, granted_by, created_at
      `,
      [randomUUID(), quizId, targetUser.id, authReq.auth.userId],
    );

    const collaboratorResult = await pool.query<QuizCollaboratorRow>(
      `
      SELECT qc.id, qc.quiz_id, qc.user_id, qc.granted_by, u.login, qc.created_at
      FROM quiz_collaborators qc
      INNER JOIN users u ON u.id = qc.user_id
      WHERE qc.id = $1
      `,
      [created.rows[0].id],
    );

    res.status(201).json({ collaborator: mapRowToQuizCollaborator(collaboratorResult.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/quizzes/:id/share/:login", requireAuth, async (req, res, next) => {
  try {
    const quizId = getSingleParam(req.params.id);
    if (!quizId) {
      res.status(400).json({ message: "Invalid quiz id" });
      return;
    }

    const collaboratorLogin = getSingleParam(req.params.login);
    if (!collaboratorLogin) {
      res.status(400).json({ message: "Invalid collaborator login" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const ownedQuiz = await findOwnedQuiz(quizId, authReq.auth.userId);
    if (!ownedQuiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }

    await pool.query(
      `
      DELETE FROM quiz_collaborators
      WHERE quiz_id = $1
        AND user_id IN (
          SELECT id
          FROM users
          WHERE login = $2
        )
      `,
      [quizId, collaboratorLogin.trim().toLowerCase()],
    );

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
