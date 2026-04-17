import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import sanitizeHtml from 'sanitize-html'
import { Role, ROLE_LABELS } from '@/lib/types'
import { parseDescription } from '@/lib/parse-description'

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

const BULLET_LINE_REGEX = /^([*-]|\u2022|\u25E6|\u25AA|\d+[\.\)])\s+/
const ORDERED_BULLET_REGEX = /^\d+[\.\)]\s+/
const COMMON_SECTION_HEADINGS = new Set([
  'about the role',
  'about this role',
  'overview',
  'responsibilities',
  'key responsibilities',
  'what you will do',
  "what you'll do",
  'what we are looking for',
  "what we're looking for",
  'what you will bring',
  "what you'll bring",
  'qualifications',
  'required qualifications',
  'minimum qualifications',
  'preferred qualifications',
  'requirements',
  'nice to have',
  'benefits',
  'compensation',
  'who you are',
  'about you',
  'day to day',
])

function hasHtmlMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isHeadingLine(value: string) {
  const normalized = value.replace(/:$/, '').trim()
  if (!normalized) return false
  if (COMMON_SECTION_HEADINGS.has(normalized.toLowerCase())) return true
  if (normalized.length > 72 || /[.!?]$/.test(normalized)) return false

  const words = normalized.split(/\s+/)
  if (words.length > 7) return false

  return /^[A-Z0-9][A-Za-z0-9 '&/(),+-]+$/.test(normalized)
}

function formatPlainTextDescription(raw: string) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  const paragraphLines: string[] = []
  const listItems: string[] = []
  let listTag: 'ul' | 'ol' | null = null

  function flushParagraph() {
    if (paragraphLines.length === 0) return
    blocks.push(`<p>${escapeHtmlText(paragraphLines.join(' '))}</p>`)
    paragraphLines.length = 0
  }

  function flushList() {
    if (!listTag || listItems.length === 0) return
    blocks.push(`<${listTag}>${listItems.join('')}</${listTag}>`)
    listItems.length = 0
    listTag = null
  }

  for (const line of lines) {
    const normalizedLine = line.replace(/\u00a0/g, ' ').trim()

    if (!normalizedLine) {
      flushParagraph()
      flushList()
      continue
    }

    if (BULLET_LINE_REGEX.test(normalizedLine)) {
      flushParagraph()

      const nextListTag = ORDERED_BULLET_REGEX.test(normalizedLine) ? 'ol' : 'ul'
      if (listTag && listTag !== nextListTag) {
        flushList()
      }
      listTag = nextListTag
      listItems.push(`<li>${escapeHtmlText(normalizedLine.replace(BULLET_LINE_REGEX, ''))}</li>`)
      continue
    }

    if (isHeadingLine(normalizedLine)) {
      flushParagraph()
      flushList()
      blocks.push(`<h3>${escapeHtmlText(normalizedLine.replace(/:$/, ''))}</h3>`)
      continue
    }

    flushList()
    paragraphLines.push(normalizedLine)
  }

  flushParagraph()
  flushList()

  if (blocks.length === 0) {
    return `<p>${escapeHtmlText(raw)}</p>`
  }

  return blocks.join('\n')
}

function cleanDescription(raw: string): string {
  const decoded = decodeDescription(raw).trim()
  const normalized = hasHtmlMarkup(decoded)
    ? decoded.replace(/\r\n?/g, '\n').replace(/\n/g, '<br />')
    : formatPlainTextDescription(decoded)

  return sanitizeHtml(normalized, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'div', 'span', 'a', 'blockquote',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
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
  const metadataDescription = plainDescription(parseDescription(job.description)).slice(0, 120)
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
  const description = parseDescription(job.description)
  const formattedDescription = description ? cleanDescription(description) : ''
  const validThrough = getValidThroughDate(job.posted_at, job.scraped_at)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8" data-page="jobs">
        <Link
          href={backUrl}
          scroll={false}
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
              className="prose prose-invert max-w-none text-[15px] leading-7 text-[#d7d7e6] sm:text-[16px] prose-p:my-4 prose-p:leading-7 prose-p:text-[#d7d7e6] prose-headings:mt-8 prose-headings:mb-3 prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-[-0.01em] prose-strong:text-white prose-a:text-indigo-300 prose-a:no-underline prose-a:transition-colors prose-ul:my-4 prose-ul:pl-6 prose-ol:my-4 prose-ol:pl-6 prose-li:my-1.5 prose-li:leading-7 prose-li:text-[#d7d7e6] prose-blockquote:border-l-indigo-400/50 prose-blockquote:text-[#c8c8da]"
              dangerouslySetInnerHTML={{
                __html: formattedDescription,
              }}
            />
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'JobPosting',
              title: job.title,
              description: plainDescription(description).slice(0, 500),
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
