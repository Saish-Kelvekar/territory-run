-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE users;