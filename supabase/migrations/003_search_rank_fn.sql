CREATE OR REPLACE FUNCTION search_jobs_ranked(
  search_query text,
  is_active_filter boolean DEFAULT true
)
RETURNS TABLE (
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
)
LANGUAGE sql
STABLE
AS $$
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
    ts_rank(j.fts, websearch_to_tsquery('english', search_query)) AS rank
  FROM jobs j
  WHERE
    j.is_active = is_active_filter
    AND j.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC;
$$;
