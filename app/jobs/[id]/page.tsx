import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface Props {
  params: Promise<{ id: string }>
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getJob(id)
  if (!job) return { title: 'Job Not Found | NextRole' }
  return {
    title: `${job.title} at ${job.company} | NextRole`,
    description: `${job.experience_level === 'new_grad' ? 'New grad' : 'Entry level'} ${job.title} at ${job.company}${job.location ? ` in ${job.location}` : ''}. ${job.description?.slice(0, 120) ?? ''}`,
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

export default async function JobPage({ params }: Props) {
  const { id } = await params
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

  const applyLabel = job.source === 'adzuna' ? 'Apply on Adzuna ↗' : 'Apply Now ↗'

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
        <a
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          ← Back to jobs
        </a>

        <div className="bg-card border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-semibold mb-1">{job.title}</h1>
              <p className="text-lg text-muted-foreground">{job.company}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {job.company?.[0]?.toUpperCase()}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-6">
            {job.location && <span>📍 {job.location}</span>}
            {job.remote && <span>🌐 Remote</span>}
            {postedDate && <span>📅 {postedDate}</span>}
            {job.salary_min && job.salary_max && (
              <span>💰 ${Math.round(job.salary_min / 1000)}K – ${Math.round(job.salary_max / 1000)}K</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {experienceBadge}
            </span>
            {(job.roles as string[] | null)?.map(role => (
              <span key={role} className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full uppercase">
                {role}
              </span>
            ))}
            <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full capitalize">
              {job.source?.replace(/_/g, ' ')}
            </span>
          </div>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {applyLabel}
          </a>
        </div>

        {job.description && (
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">About this role</h2>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {job.description.length > 3000
                ? job.description.slice(0, 3000) + '...'
                : job.description}
            </div>
            {job.description.length > 3000 && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-4"
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
              description: job.description?.slice(0, 500),
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
              validThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
