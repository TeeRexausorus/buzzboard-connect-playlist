ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE users
SET email = login
WHERE email IS NULL;

ALTER TABLE users
ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
ON users (email);
