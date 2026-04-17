import type { MetadataRoute } from 'next'
import {
  JOB_SITEMAP_URL_LIMIT,
  buildJobSitemapEntries,
  fetchSitemapJobs,
  getActiveJobCount,
  getOverflowSitemapIds,
} from '@/lib/sitemap/jobs'

export const runtime = 'nodejs'
export const revalidate = 3600
export const maxDuration = 60

export async function generateSitemaps() {
  const totalJobs = await getActiveJobCount('jobs/sitemap:index')
  return getOverflowSitemapIds(totalJobs)
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id)

  if (!Number.isInteger(id) || id < 0) {
    console.warn('[jobs/sitemap] Invalid sitemap id')
    return []
  }

  const jobs = await fetchSitemapJobs({
    logLabel: `jobs/sitemap:${id}`,
    offset: id * JOB_SITEMAP_URL_LIMIT,
    limit: JOB_SITEMAP_URL_LIMIT,
  })

  return buildJobSitemapEntries(jobs)
}
