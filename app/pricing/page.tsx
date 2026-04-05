'use client';

import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const FREE_FEATURES = [
  '20 jobs per day',
  'Basic role + level filters',
  'Remote filter',
  'Application tracking (auto)',
];

const PRO_FEATURES = [
  'Unlimited jobs per day',
  'All filters + source filter',
  'AI match scoring',
  'Email alerts for new matches',
  'CSV export',
  'Priority support',
];

const COMING_SOON = new Set(['AI match scoring', 'Email alerts for new matches', 'CSV export']);

function FeatureRow({ label, coming }: { label: string; coming?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      <span>{label}</span>
      {coming && (
        <Badge variant="secondary" className="text-[10px] py-0 h-4">
          Soon
        </Badge>
      )}
    </li>
  );
}

export default function PricingPage() {
  function handleUpgradeClick() {
    toast.info('Stripe not yet configured — coming soon!');
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <section className="px-4 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="mt-3 text-muted-foreground text-lg">
          Start free. Upgrade when you need more.
        </p>
      </section>

      {/* Cards */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 grid gap-6 sm:grid-cols-2">
        {/* Free */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Everything you need to get started.</CardDescription>
            <div className="mt-2">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground text-sm"> / month</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {FREE_FEATURES.map(f => <FeatureRow key={f} label={f} />)}
            </ul>
          </CardContent>
          <CardFooter>
            <a
              href="/jobs"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              Get started →
            </a>
          </CardFooter>
        </Card>

        {/* Pro */}
        <Card className="flex flex-col border-primary/40 shadow-md relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary text-primary-foreground text-xs">Most popular</Badge>
          </div>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Unlimited access for serious job seekers.</CardDescription>
            <div className="mt-2 space-y-0.5">
              <div>
                <span className="text-4xl font-bold">$15</span>
                <span className="text-muted-foreground text-sm"> / month</span>
              </div>
              <div className="text-sm text-muted-foreground">
                or <span className="font-semibold text-foreground">$99 / year</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400">save 45%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {PRO_FEATURES.map(f => (
                <FeatureRow key={f} label={f} coming={COMING_SOON.has(f)} />
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleUpgradeClick}>
              Upgrade to Pro
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Stripe checkout coming soon
            </p>
          </CardFooter>
        </Card>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-muted/20 px-4 py-16">
        <div className="mx-auto max-w-2xl space-y-8">
          <h2 className="text-xl font-semibold text-center">FAQ</h2>
          {[
            {
              q: 'What counts as a "job viewed"?',
              a: 'Each unique job card loaded in your feed counts as one view. Refreshing the page or applying does not double-count.',
            },
            {
              q: 'How often is the job feed updated?',
              a: 'Scrapers run every morning at 7 AM UTC (3 AM EST), so you always wake up to fresh listings.',
            },
            {
              q: 'Can I cancel anytime?',
              a: 'Yes — cancel anytime from your account settings. You keep Pro access until the end of your billing period.',
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-sm">{q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
