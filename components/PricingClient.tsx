'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

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

export default function PricingClient() {
  const searchParams = useSearchParams();
  const [tier, setTier] = useState<'free' | 'pro' | null>(null);
  const [loading, setLoading] = useState<'monthly' | 'yearly' | 'portal' | null>(null);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to NexTRole Pro! 🎉');
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      if (data) setTier(data.tier as 'free' | 'pro');
    });
  }, []);

  async function handleUpgrade(plan: 'monthly' | 'yearly') {
    setLoading(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Failed to open billing portal. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const isPro = tier === 'pro';

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <section className="px-4 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="mt-3 text-muted-foreground text-lg">
          Start free. Upgrade when you need more.
        </p>
        {isPro && (
          <Badge className="mt-4 bg-emerald-600 hover:bg-emerald-600 text-white px-3 py-1 text-sm">
            ✓ You&apos;re on Pro
          </Badge>
        )}
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
                <span className="text-4xl font-bold">$4.99</span>
                <span className="text-muted-foreground text-sm"> / month</span>
              </div>
              <div className="text-sm text-muted-foreground">
                or <span className="font-semibold text-foreground">$50 / year</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400">save 17%</span>
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
            {isPro ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={handleManageSubscription}
                disabled={loading === 'portal'}
              >
                {loading === 'portal' ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                ) : (
                  <><ExternalLink className="h-4 w-4 mr-2" />Manage subscription</>
                )}
              </Button>
            ) : (
              <>
                <div className="w-full grid grid-cols-2 gap-2">
                  {/* Monthly */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleUpgrade('monthly')}
                      disabled={!!loading}
                    >
                      {loading === 'monthly' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Monthly'
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">$4.99 / mo</p>
                  </div>

                  {/* Yearly — highlighted */}
                  <div className="flex flex-col gap-1 relative">
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white z-10 whitespace-nowrap">
                      Best value
                    </Badge>
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade('yearly')}
                      disabled={!!loading}
                    >
                      {loading === 'yearly' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Yearly'
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">$50 / yr</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Cancel anytime · Secure checkout via Stripe
                </p>
              </>
            )}
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
