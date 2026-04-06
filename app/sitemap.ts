import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, updated_at, posted_at')
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .limit(49000)

  const jobUrls: MetadataRoute.Sitemap = (jobs ?? []).map(job => ({
    url: `https://nextrole-phi.vercel.app/jobs/${job.id}`,
    lastModified: new Date(job.updated_at ?? job.posted_at ?? Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [
    {
      url: 'https://nextrole-phi.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: 'https://nextrole-phi.vercel.app/jobs',
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    {
      url: 'https://nextrole-phi.vercel.app/pricing',
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    ...jobUrls,
  ]
}
