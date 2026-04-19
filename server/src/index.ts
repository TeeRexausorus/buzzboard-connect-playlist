import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { pool, initDatabase } from "./db";
import { env, validateEnv } from "./env";
import { createQuizSchema, updateQuizSchema } from "./validation";

type QuizRow = {
  id: string;
  name: string;
  questions: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

const mapRowToQuiz = (row: QuizRow) => ({
  id: row.id,
  name: row.name,
  questions: row.questions,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/quizzes", async (_req, res, next) => {
  try {
    const result = await pool.query<QuizRow>(
      "SELECT id, name, questions, created_at, updated_at FROM quizzes ORDER BY created_at ASC",
    );
    res.json(result.rows.map(mapRowToQuiz));
  } catch (error) {
    next(error);
  }
});

app.get("/api/quizzes/:id", async (req, res, next) => {
  try {
    const result = await pool.query<QuizRow>(
      "SELECT id, name, questions, created_at, updated_at FROM quizzes WHERE id = $1",
      [req.params.id],
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

app.post("/api/quizzes", async (req, res, next) => {
  try {
    const payload = createQuizSchema.parse(req.body);
    const id = randomUUID();
    const result = await pool.query<QuizRow>(
      `
      INSERT INTO quizzes (id, name, questions)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, name, questions, created_at, updated_at
      `,
      [id, payload.name, JSON.stringify(payload.questions)],
    );

    res.status(201).json(mapRowToQuiz(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/quizzes/:id", async (req, res, next) => {
  try {
    const payload = updateQuizSchema.parse(req.body);

    const result = await pool.query<QuizRow>(
      `
      UPDATE quizzes
      SET
        name = COALESCE($2, name),
        questions = COALESCE($3::jsonb, questions),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, questions, created_at, updated_at
      `,
      [
        req.params.id,
        payload.name ?? null,
        payload.questions === undefined ? null : JSON.stringify(payload.questions),
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

app.delete("/api/quizzes/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM quizzes WHERE id = $1", [req.params.id]);
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
