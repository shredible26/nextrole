'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATS = [
  { value: '33,000+', label: 'Jobs aggregated' },
  { value: '10+', label: 'Sources' },
  { value: '100%', label: 'Auto-tracked' },
];

const SOURCES = [
  'SimplifyJobs', 'RemoteOK', 'Adzuna', 'Arbeitnow',
  'The Muse', 'Jobright', 'Levels.fyi', 'LinkedIn*',
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center">
        <Badge variant="secondary" className="mb-6 text-xs font-medium">
          Now in beta · Week 1 sources live
        </Badge>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight leading-[1.1] sm:text-6xl">
          Every new grad tech job.{' '}
          <span className="text-primary">One feed.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
          NextRole aggregates SWE, DS, ML, and AI roles from 10+ sources and
          auto-tracks every application — so you can focus on applying, not searching.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/jobs"
            className={cn(buttonVariants({ size: 'lg' }), 'px-8')}
          >
            Browse Jobs →
          </Link>
          <Link
            href="/pricing"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            See Pricing
          </Link>
        </div>
      </section>

      {/* Stats row */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-10 grid grid-cols-3 gap-6 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight mb-12">
          How it works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'We scrape daily',
              body: 'Scrapers run every morning at 3 AM EST pulling fresh listings from all sources.',
            },
            {
              step: '02',
              title: 'You apply once',
              body: 'Click Apply on any card. The application is auto-logged in your tracker — no manual entry.',
            },
            {
              step: '03',
              title: 'Track your pipeline',
              body: 'Kanban or table view. Move cards through Applied → Interview → Offer with one click.',
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-3">
              <span className="text-xs font-mono font-semibold text-muted-foreground">{step}</span>
              <h3 className="font-semibold text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="border-t border-border/60 bg-muted/20 px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium text-muted-foreground mb-6">
            Pulling from these sources and more
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SOURCES.map(s => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">* LinkedIn coming Week 3</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NextRole · Built for new grads
      </footer>
    </div>
  );
}
