-- Migration 008: Weighted FTS — title matches rank higher than description matches

-- Step 1: Drop the existing generated fts column (generated columns can't use setweight across fields)
ALTER TABLE jobs DROP COLUMN IF EXISTS fts;

-- Step 2: Add a new non-generated fts column
ALTER TABLE jobs ADD COLUMN fts tsvector;

-- Step 3: Populate it with weighted vectors
-- A = title (highest), B = company, C = description (lowest)
UPDATE jobs SET fts =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C');

-- Step 4: Create trigger function to keep fts in sync on insert/update
CREATE OR REPLACE FUNCTION jobs_fts_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$;

-- Step 5: Attach trigger to jobs table
DROP TRIGGER IF EXISTS jobs_fts_trigger ON jobs;
CREATE TRIGGER jobs_fts_trigger
  BEFORE INSERT OR UPDATE OF title, company, description
  ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_fts_update();

-- Step 6: Recreate GIN index on new column
DROP INDEX IF EXISTS jobs_fts_idx;
CREATE INDEX jobs_fts_idx ON jobs USING GIN(fts);

-- Step 7: Update search_jobs_ranked to use weighted ranking
CREATE OR REPLACE FUNCTION search_jobs_ranked(
  search_query text,
  is_active_filter boolean DEFAULT true
) RETURNS TABLE (
  id uuid,
  source text,
  source_id text,
  title text,
  company text,
  location text,
  remote boolean,
  url text,
  description text,
  salary_min int,
  salary_max int,
  experience_level text,
  roles text[],
  posted_at timestamptz,
  scraped_at timestamptz,
  is_active boolean,
  dedup_hash text,
  rank real
) LANGUAGE sql STABLE AS $$
  SELECT
    j.id,
    j.source,
    j.source_id,
    j.title,
    j.company,
    j.location,
    j.remote,
    j.url,
    j.description,
    j.salary_min,
    j.salary_max,
    j.experience_level,
    j.roles,
    j.posted_at,
    j.scraped_at,
    j.is_active,
    j.dedup_hash,
    ts_rank_cd(
      j.fts,
      websearch_to_tsquery('english', search_query),
      32
    ) AS rank
  FROM jobs j
  WHERE
    j.is_active = is_active_filter
    AND j.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC;
$$;