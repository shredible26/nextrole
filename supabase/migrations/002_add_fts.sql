-- Add generated tsvector column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(description, '')
    )
  ) STORED;

-- Add GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS jobs_fts_idx ON jobs USING GIN(fts);
