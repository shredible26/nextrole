import { MetadataRoute } from 'next'
import {
  BASE_URL,
  getActiveJobCount,
  getOverflowSitemapUrls,
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
  {
    url: `${BASE_URL}/tracker`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/profile`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/chat`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.6,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const totalJobs = await getActiveJobCount('sitemap:index')
  const sitemapUrls = getOverflowSitemapUrls(totalJobs)

  return [
    ...staticUrls,
    ...sitemapUrls.map((url) => ({
      url,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.3,
    })),
  ]
}
