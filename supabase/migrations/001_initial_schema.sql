-- supabase/migrations/001_initial_schema.sql

-- ─────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────
CREATE TABLE jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,
  source_id        TEXT,
  title            TEXT NOT NULL,
  company          TEXT NOT NULL,
  location         TEXT,
  remote           BOOLEAN DEFAULT false,
  url              TEXT NOT NULL,
  description      TEXT,
  salary_min       INT,
  salary_max       INT,
  experience_level TEXT CHECK (experience_level IN ('new_grad', 'entry_level', 'internship')),
  roles            TEXT[],   -- ['SWE', 'DS', 'ML', 'AI', 'Analyst', 'PM']
  posted_at        TIMESTAMPTZ,
  scraped_at       TIMESTAMPTZ DEFAULT now(),
  is_active        BOOLEAN DEFAULT true,
  dedup_hash       TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_jobs_posted_at      ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_experience     ON jobs(experience_level);
CREATE INDEX idx_jobs_roles          ON jobs USING GIN(roles);
CREATE INDEX idx_jobs_remote         ON jobs(remote);
CREATE INDEX idx_jobs_is_active      ON jobs(is_active);
CREATE INDEX idx_jobs_source         ON jobs(source);

-- ─────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email                  TEXT,
  full_name              TEXT,
  avatar_url             TEXT,
  tier                   TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  resume_url             TEXT,
  jobs_viewed_today      INT NOT NULL DEFAULT 0,
  last_reset_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- APPLICATION TRACKING
-- ─────────────────────────────────────────
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'applied'
                  CHECK (status IN (
                    'applied', 'phone_screen', 'oa',
                    'interview', 'offer', 'rejected', 'withdrawn'
                  )),
  applied_at    TIMESTAMPTZ DEFAULT now(),
  notes         TEXT,
  auto_tracked  BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user   ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;

-- Jobs: public read
CREATE POLICY "Jobs are publicly readable"
  ON jobs FOR SELECT USING (true);

-- Profiles: users see and edit only their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Applications: users manage only their own
CREATE POLICY "Users can manage own applications"
  ON applications FOR ALL USING (auth.uid() = user_id);
