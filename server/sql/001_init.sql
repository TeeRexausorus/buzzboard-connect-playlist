CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes (created_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id_created_at ON quizzes (user_id, created_at);

CREATE TABLE IF NOT EXISTS quiz_collaborators (
  id UUID PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_collaborators_user_id
ON quiz_collaborators (user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_collaborators_quiz_id
ON quiz_collaborators (quiz_id);
