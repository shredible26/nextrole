import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import sanitizeHtml from 'sanitize-html'
import { Role, ROLE_LABELS } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

function decodeDescription(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function cleanDescription(raw: string): string {
  const decoded = decodeDescription(raw)

  return sanitizeHtml(decoded, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      'div', 'span', 'a',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    },
  })
}

function plainDescription(raw?: string | null): string {
  if (!raw) return ''

  return decodeDescription(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getJob(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()
  return data
}

function getValidThroughDate(postedAt?: string | null, scrapedAt?: string | null) {
  const baseDate = postedAt ?? scrapedAt
  if (!baseDate) return undefined

  const validThrough = new Date(baseDate)
  validThrough.setDate(validThrough.getDate() + 30)
  return validThrough.toISOString()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getJob(id)
  if (!job) return { title: 'Job Not Found | NextRole' }
  const metadataDescription = plainDescription(job.description).slice(0, 120)
  return {
    title: `${job.title} at ${job.company} | NextRole`,
    description: `${job.experience_level === 'new_grad' ? 'New grad' : 'Entry level'} ${job.title} at ${job.company}${job.location ? ` in ${job.location}` : ''}. ${metadataDescription}`,
    openGraph: {
      title: `${job.title} — ${job.company}`,
      description: `${job.experience_level === 'new_grad' ? 'New grad' : 'Entry level'} role at ${job.company}`,
      url: `https://nextrole-phi.vercel.app/jobs/${id}`,
      siteName: 'NextRole',
    },
    alternates: {
      canonical: `https://nextrole-phi.vercel.app/jobs/${id}`,
    },
  }
}

export default async function JobPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from } = await searchParams
  const backUrl = from && from.startsWith('/jobs') ? from : '/jobs'
  const job = await getJob(id)
  if (!job) notFound()

  const experienceBadge = {
    new_grad: 'New Grad',
    entry_level: 'Entry Level',
    internship: 'Internship',
  }[job.experience_level as string] ?? 'Entry Level'

  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const applyLabel = 'Apply Now ↗'
  const description = job.description ?? ''
  const truncatedDescription = description.length > 5000
    ? description.slice(0, 5000) + '...'
    : description
  const validThrough = getValidThroughDate(job.posted_at, job.scraped_at)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8" data-page="jobs">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 text-sm text-[#a0a0b0] hover:text-white mb-6 transition-colors"
        >
          ← Back to jobs
        </Link>

        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-semibold mb-1 text-white">{job.title}</h1>
              <p className="text-lg text-[#e0e0f0] font-medium">{job.company}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-300 shrink-0">
              {job.company?.[0]?.toUpperCase()}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-[#a0a0b0] mb-6">
            {job.location && <span>📍 {job.location}</span>}
            {job.remote && <span>🌐 Remote</span>}
            {postedDate && <span>📅 {postedDate}</span>}
            {job.salary_min && job.salary_max && (
              <span>💰 ${Math.round(job.salary_min / 1000)}K – ${Math.round(job.salary_max / 1000)}K</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-full">
              {experienceBadge}
            </span>
            {(job.roles as string[] | null)?.map(role => (
              <span key={role} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-full">
                {ROLE_LABELS[role as Role] ?? role}
              </span>
            ))}
            <span className="px-3 py-1 bg-[#2a2a35] text-[#a0a0b0] border border-[#444455] text-xs rounded-full capitalize">
              {job.source?.replace(/_/g, ' ')}
            </span>
          </div>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-500 transition-colors"
          >
            {applyLabel}
          </a>
        </div>

        {description && (
          <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">About this role</h2>
            <div
              className="prose prose-sm prose-invert max-w-none text-[#c0c0d0] leading-relaxed prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-indigo-400"
              dangerouslySetInnerHTML={{
                __html: cleanDescription(truncatedDescription),
              }}
            />
            {description.length > 5000 && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:underline mt-4"
              >
                Read full description ↗
              </a>
            )}
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'JobPosting',
              title: job.title,
              description: plainDescription(job.description).slice(0, 500),
              hiringOrganization: {
                '@type': 'Organization',
                name: job.company,
              },
              jobLocation: {
                '@type': 'Place',
                address: job.remote
                  ? { '@type': 'PostalAddress', addressCountry: 'US' }
                  : job.location,
              },
              employmentType: 'FULL_TIME',
              datePosted: job.posted_at,
              validThrough,
              url: `https://nextrole-phi.vercel.app/jobs/${job.id}`,
              ...(job.salary_min && {
                baseSalary: {
                  '@type': 'MonetaryAmount',
                  currency: 'USD',
                  value: {
                    '@type': 'QuantitativeValue',
                    minValue: job.salary_min,
                    maxValue: job.salary_max,
                    unitText: 'YEAR',
                  },
                },
              }),
            }),
          }}
        />
    </main>
  )
}
