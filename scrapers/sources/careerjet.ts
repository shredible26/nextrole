import { inferExperienceLevel, inferRoles, inferRemote } from '../utils/normalize'
import { generateHash } from '../utils/dedup'
import type { NormalizedJob } from '../utils/normalize'

const SEARCH_TERMS = [
  'software engineer entry level',
  'software engineer new grad 2026',
  'data scientist entry level',
  'machine learning engineer entry level',
  'junior software engineer',
  'associate software engineer',
  'data analyst entry level',
  'backend engineer entry level',
  'frontend engineer entry level',
  'devops engineer entry level',
]

interface CareerjetJob {
  url: string
  title: string
  company: string
  locations: string
  date: string
  description: string
  salary?: string
}

interface CareerjetResponse {
  type: string
  hits: number
  jobs: CareerjetJob[]
}

export async function scrapeCareerjet(): Promise<NormalizedJob[]> {
  const apiKey = process.env.CAREERJET_API_KEY
  if (!apiKey) {
    console.warn('  [careerjet] CAREERJET_API_KEY not set, skipping')
    return []
  }

  const allJobs: NormalizedJob[] = []
  const seen = new Set<string>()

  const fetches = SEARCH_TERMS.map(async (term) => {
    for (let page = 1; page <= 3; page++) {
      try {
        const params = new URLSearchParams({
          apikey: apiKey,
          affid: apiKey,
          keywords: term,
          location: 'United States',
          locale_code: 'en_US',
          pagesize: '99',
          page: String(page),
          sort: 'date',
        })
        const res = await fetch(`https://public.api.careerjet.net/search?${params}`)
        if (!res.ok) break
        const data: CareerjetResponse = await res.json()
        if (!data.jobs?.length) break

        for (const job of data.jobs) {
          const url = job.url ?? ''
          if (!url || seen.has(url)) continue
          seen.add(url)
          const title = job.title ?? ''
          const description = job.description ?? ''
          const level = inferExperienceLevel(title, description)
          if (!level) continue
          const location = job.locations ?? ''
          allJobs.push({
            source: 'careerjet',
            source_id: url,
            title,
            company: job.company ?? '',
            location: location || undefined,
            remote: inferRemote(location) || inferRemote(title),
            url,
            description: description.slice(0, 5000) || undefined,
            experience_level: level,
            roles: inferRoles(title),
            posted_at: undefined,
            dedup_hash: generateHash(job.company ?? '', title, location),
          })
        }

        if (data.jobs.length < 99) break
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.warn(`  [careerjet] failed for "${term}" page ${page}:`, String(err).slice(0, 100))
        break
      }
    }
  })

  await Promise.all(fetches)
  console.log(`  [careerjet] ${allJobs.length} jobs fetched`)
  return allJobs
}
