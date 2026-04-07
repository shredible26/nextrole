import { MetadataRoute } from 'next'
import {
  BASE_URL,
  ROOT_JOB_URL_LIMIT,
  buildJobSitemapEntries,
  fetchSitemapJobs,
} from '@/lib/sitemap/jobs'

export const runtime = 'nodejs'
export const revalidate = 3600
export const maxDuration = 60

const staticUrls: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    url: `${BASE_URL}/jobs`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/pricing`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await fetchSitemapJobs({
    logLabel: 'sitemap',
    offset: 0,
    limit: ROOT_JOB_URL_LIMIT,
  })

  const jobUrls = buildJobSitemapEntries(jobs)

  return [...staticUrls, ...jobUrls]
}
