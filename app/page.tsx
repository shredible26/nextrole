'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATS = [
  { value: '55,000+', label: 'Active jobs' },
  { value: '25+', label: 'Sources' },
  { value: 'Daily', label: 'Updates' },
];

const SOURCES = [
  'SimplifyJobs', 'Greenhouse', 'Lever', 'Ashby',
  'Workday', 'Dice', 'Adzuna', 'BuiltIn',
  'USAJobs', 'RemoteOK', 'Arbeitnow', 'The Muse',
  'Indeed', 'HackerNews', 'WorkAtAStartup', 'SmartRecruiters',
  '+ 10 more',
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center">
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight leading-[1.1] sm:text-6xl">
          Every internship & new grad tech job.{' '}
          <span className="text-primary">One feed.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
          55,000+ internship, new grad, and entry-level roles from 25+ sources —
          updated daily. Find the right role and track every application in one place.
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
            View Pricing
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
              title: 'Updated daily',
              body: 'Scrapers run every morning pulling fresh listings from 25+ sources including GitHub repos, company ATS platforms, and job boards.',
            },
            {
              step: '02',
              title: 'Apply in one click',
              body: 'Click Apply on any card. The application is auto-logged in your tracker — no manual entry required.',
            },
            {
              step: '03',
              title: 'Track your pipeline',
              body: 'Table or kanban view. Move applications through Applied → Interview → Offer with one click.',
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
            Aggregated from 25+ sources
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SOURCES.map(s => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NextRole · Built for students and recent grads
      </footer>
    </div>
  );
}
