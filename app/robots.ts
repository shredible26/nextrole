import { MetadataRoute } from 'next'
import { BASE_URL, getActiveJobCount, getOverflowSitemapUrls } from '@/lib/sitemap/jobs'

export const runtime = 'nodejs'
export const revalidate = 3600
export const maxDuration = 60

export default async function robots(): Promise<MetadataRoute.Robots> {
  const totalJobs = await getActiveJobCount('robots')

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/tracker', '/settings'],
    },
    sitemap: [`${BASE_URL}/sitemap.xml`, ...getOverflowSitemapUrls(totalJobs)],
  }
}
