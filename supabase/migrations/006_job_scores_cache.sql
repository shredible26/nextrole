-- Migration 006: Add profiles.updated_at trigger and job_scores cache table
-- Run this in your Supabase SQL Editor

-- ─────────────────────────────────────────
-- 1. Add updated_at to profiles
-- ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Auto-update trigger function (shared, idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- 2. Create job_scores cache table
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_scores (
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  similarity  float       NOT NULL,
  grade       text        NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS job_scores_user_idx ON job_scores(user_id);

ALTER TABLE job_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scores" ON job_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON job_scores
  FOR ALL USING (true);
