'use client';

import Link from 'next/link';
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
  'Browse up to 30 jobs per search',
  'Internship, new grad, and entry-level roles',
  'Role, experience, and location filters',
  'Full-text job search',
  'Application tracker (up to 100 jobs)',
  'No account required to browse',
];

const PRO_FEATURES = [
  'Unlimited job browsing',
  'Filter by specific job source',
  'Full-text search across all 55,000+ jobs',
  'Unlimited application tracking',
  'AI resume match scoring A–F',
  'Email alerts for new matching jobs',
  'Priority support',
];

const COMING_SOON = new Set([
  'AI resume match scoring A–F',
  'Email alerts for new matching jobs',
]);

function FeatureRow({ label, coming }: { label: string; coming?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      <span className="text-[#c0c0d8]">{label}</span>
      {coming && (
        <Badge className="text-[10px] py-0 h-4 bg-[#2a2a35] text-[#888899] border-0">
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
      toast.success('Welcome to NextRole Pro! 🎉');
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
        <h1 className="text-4xl font-bold tracking-tight text-[#f0f0fa]">Simple, transparent pricing</h1>
        <p className="mt-3 text-[#888899] text-lg">
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
        <Card className="flex flex-col bg-[#1a1a24] border-[#2a2a35]">
          <CardHeader>
            <CardTitle className="text-[#f0f0fa]">Free</CardTitle>
            <CardDescription className="text-[#888899]">Everything you need to get started.</CardDescription>
            <div className="mt-2">
              <span className="text-4xl font-bold text-[#f0f0fa]">$0</span>
              <span className="text-[#888899] text-sm"> / month</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {FREE_FEATURES.map(f => <FeatureRow key={f} label={f} />)}
            </ul>
          </CardContent>
          <CardFooter>
            <Link
              href="/jobs"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full border-[#2a2a35] bg-[#0d0d12] text-[#f0f0fa] hover:bg-[#2a2a35] hover:text-white')}
            >
              Get started →
            </Link>
          </CardFooter>
        </Card>

        {/* Pro */}
        <Card className="flex flex-col bg-[#1a1a24] border-indigo-500/40 shadow-md relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge className="bg-indigo-500 text-white text-xs">Most popular</Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-[#f0f0fa]">Pro</CardTitle>
            <CardDescription className="text-[#888899]">Unlimited access for serious job seekers.</CardDescription>
            <div className="mt-2 space-y-0.5">
              <div>
                <span className="text-4xl font-bold text-[#f0f0fa]">$4.99</span>
                <span className="text-[#888899] text-sm"> / month</span>
              </div>
              <div className="text-sm text-[#888899]">
                or <span className="font-semibold text-[#f0f0fa]">$50 / year</span>{' '}
                <span className="text-emerald-400">save 17%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {PRO_FEATURES.map(f => (
                <FeatureRow key={f} label={f} coming={COMING_SOON.has(f)} />
              ))}
            </ul>
            <p className="mt-4 text-xs text-[#555566] italic">Cancel anytime · Secure checkout via Stripe</p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {isPro ? (
              <Button
                className="w-full border-[#2a2a35] bg-[#0d0d12] text-[#f0f0fa] hover:bg-[#2a2a35]"
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
                <div className="w-full grid grid-cols-2 gap-2 mt-4">
                  {/* Monthly */}
                  <div className="flex flex-col gap-1">
                    <Button
                      className="w-full bg-indigo-400 hover:bg-indigo-300 text-white font-semibold"
                      onClick={() => handleUpgrade('monthly')}
                      disabled={!!loading}
                    >
                      {loading === 'monthly' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Monthly'
                      )}
                    </Button>
                    <p className="text-xs text-center text-[#888899]">$4.99 / mo</p>
                  </div>

                  {/* Yearly — highlighted */}
                  <div className="flex flex-col gap-1 relative">
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white z-10 whitespace-nowrap">
                      Best value
                    </Badge>
                    <Button
                      className="w-full bg-indigo-500 hover:bg-indigo-400 text-white"
                      onClick={() => handleUpgrade('yearly')}
                      disabled={!!loading}
                    >
                      {loading === 'yearly' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Yearly'
                      )}
                    </Button>
                    <p className="text-xs text-center text-[#888899]">$50 / yr</p>
                  </div>
                </div>
              </>
            )}
          </CardFooter>
        </Card>
        <p className="sm:col-span-2 text-center text-sm text-[#555566]">
          NextRole aggregates internship, new grad, and entry-level tech roles from 25+ sources. Updated daily.
        </p>
      </section>
    </div>
  );
}
