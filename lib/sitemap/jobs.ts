import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const BASE_URL = 'https://nextrole-phi.vercel.app'
export const ROOT_JOB_URL_LIMIT = 49000
export const JOB_SITEMAP_URL_LIMIT = 49000

const SUPABASE_BATCH_SIZE = 1000
const QUERY_CONCURRENCY = 5
const QUERY_TIMEOUT_MS = 30000

export type SitemapJob = {
  id: string
  scraped_at: string | null
  posted_at: string | null
}

function createSitemapSupabaseClient(logLabel: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${logLabel}] Missing Supabase env vars`, {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(supabaseServiceKey),
    })

    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function getActiveJobCount(logLabel: string): Promise<number> {
  const supabase = createSitemapSupabaseClient(logLabel)

  if (!supabase) {
    return 0
  }

  try {
    const { count, error } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

    if (error) {
      console.error(`[${logLabel}] Supabase error:`, error)
      return 0
    }

    return count ?? 0
  } catch (error) {
    console.error(`[${logLabel}] Supabase query threw:`, error)
    return 0
  }
}

export async function fetchSitemapJobs({
  logLabel,
  offset,
  limit,
}: {
  logLabel: string
  offset: number
  limit: number
}): Promise<SitemapJob[]> {
  const supabase = createSitemapSupabaseClient(logLabel)

  if (!supabase || limit <= 0) {
    console.log(`[${logLabel}] Jobs fetched: 0`)

    if (limit > 0) {
      console.warn(`[${logLabel}] No jobs returned from Supabase`)
    }

    return []
  }

  const ranges: Array<{ from: number; to: number }> = []

  // This project's PostgREST responses cap out at 1,000 rows per request.
  for (let fetched = 0; fetched < limit; fetched += SUPABASE_BATCH_SIZE) {
    const batchSize = Math.min(SUPABASE_BATCH_SIZE, limit - fetched)
    const from = offset + fetched
    const to = from + batchSize - 1

    ranges.push({ from, to })
  }

  const jobs: SitemapJob[] = []

  for (let index = 0; index < ranges.length; index += QUERY_CONCURRENCY) {
    const group = ranges.slice(index, index + QUERY_CONCURRENCY)

    const groupResults = await Promise.all(
      group.map(async ({ from, to }) => {
        try {
          const { data, error } = await supabase
            .from('jobs')
            .select('id, scraped_at, posted_at')
            .eq('is_active', true)
            .order('posted_at', { ascending: false })
            .range(from, to)
            .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

          if (error) {
            console.error(`[${logLabel}] Supabase error (${from}-${to}):`, error)
            return []
          }

          return data ?? []
        } catch (error) {
          console.error(`[${logLabel}] Supabase query threw (${from}-${to}):`, error)
          return []
        }
      })
    )

    groupResults.forEach((batch) => {
      jobs.push(...batch)
    })
  }

  console.log(`[${logLabel}] Jobs fetched:`, jobs.length)

  if (!jobs.length) {
    console.warn(`[${logLabel}] No jobs returned from Supabase`)
  }

  return jobs
}

export function getOverflowSitemapIds(totalJobs: number) {
  const overflowJobs = Math.max(totalJobs - ROOT_JOB_URL_LIMIT, 0)
  const sitemapCount = Math.ceil(overflowJobs / JOB_SITEMAP_URL_LIMIT)

  return Array.from({ length: sitemapCount }, (_, id) => ({ id }))
}

export function getOverflowSitemapUrls(totalJobs: number) {
  return getOverflowSitemapIds(totalJobs).map(
    ({ id }) => `${BASE_URL}/jobs/sitemap/${id}.xml`
  )
}

export function buildJobSitemapEntries(
  jobs: SitemapJob[]
): MetadataRoute.Sitemap {
  return jobs.map((job) => ({
    url: `${BASE_URL}/jobs/${job.id}`,
    lastModified: new Date(job.scraped_at ?? job.posted_at ?? Date.now()),
    changeFrequency: 'daily',
    priority: 0.7,
  }))
}
