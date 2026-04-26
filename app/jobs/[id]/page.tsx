import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, CalendarDays, Globe, MapPin, Wallet } from 'lucide-react'
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
  const detailPillClassName =
    'inline-flex items-center gap-2 rounded-full border border-[#313447] bg-[#11131a] px-3 py-1.5 text-sm font-medium text-[#dfe4ff] shadow-[0_8px_20px_rgba(0,0,0,0.16)]'

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-[#0d0d12]" data-page="jobs">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href={backUrl}
          scroll={false}
          className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#050507] px-3.5 py-2 text-sm font-medium text-[#f5f7ff] shadow-lg shadow-black/25 transition-all duration-200 hover:border-indigo-400/40 hover:text-white hover:shadow-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span>Back to jobs</span>
        </Link>

        <div className="mb-6 rounded-2xl border border-[#2a2f42] bg-gradient-to-br from-[#191a25] via-[#171821] to-[#12131a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{job.title}</h1>
              <p className="text-lg font-medium text-[#dbe0f7]">{job.company}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15 text-lg font-bold text-indigo-300">
              {job.company?.[0]?.toUpperCase()}
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2.5">
            {job.location && (
              <span className={detailPillClassName}>
                <MapPin className="h-4 w-4 text-indigo-300" />
                <span>{job.location}</span>
              </span>
            )}
            {job.remote && (
              <span className={detailPillClassName}>
                <Globe className="h-4 w-4 text-indigo-300" />
                <span>Remote</span>
              </span>
            )}
            {postedDate && (
              <span className={detailPillClassName}>
                <CalendarDays className="h-4 w-4 text-indigo-300" />
                <span>{postedDate}</span>
              </span>
            )}
            {job.salary_min && job.salary_max && (
              <span className={detailPillClassName}>
                <Wallet className="h-4 w-4 text-indigo-300" />
                <span>${Math.round(job.salary_min / 1000)}K – ${Math.round(job.salary_max / 1000)}K</span>
              </span>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-full">
              {experienceBadge}
            </span>
            {(job.roles as string[] | null)?.map(role => (
              <span key={role} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-full">
                {ROLE_LABELS[role as Role] ?? role}
              </span>
            ))}
            <span className="rounded-full border border-[#3a3d50] bg-[#161821] px-3 py-1 text-xs capitalize text-[#cad0e8]">
              {job.source?.replace(/_/g, ' ')}
            </span>
          </div>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            {applyLabel}
          </a>
        </div>

        {description && (
          <div className="rounded-2xl border border-[#2a2f42] bg-[#171821] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">About this role</h2>
            <div
              className="max-w-none text-[15px] leading-8 text-[#e4e8ff] sm:text-[16px] [&>*:first-child]:mt-0 [&_a]:text-indigo-300 [&_a]:underline-offset-4 hover:[&_a]:text-indigo-200 hover:[&_a]:underline [&_b]:text-white [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-400/50 [&_blockquote]:pl-4 [&_blockquote]:text-[#cdd3f3] [&_div]:text-inherit [&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-white [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-white [&_h4]:mt-7 [&_h4]:mb-3 [&_h4]:font-semibold [&_h4]:text-white [&_li]:my-1.5 [&_li]:text-[#e4e8ff] [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p]:text-[#e4e8ff] [&_span]:text-inherit [&_strong]:text-white [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
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
      </div>
    </main>
  )
}
