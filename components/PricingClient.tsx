'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ComponentProps } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// ─── BGPattern ───────────────────────────────────────────────────────────────

type BGMaskType =
  | 'fade-center'
  | 'fade-edges'
  | 'fade-top'
  | 'fade-bottom'
  | 'fade-left'
  | 'fade-right'
  | 'fade-x'
  | 'fade-y'
  | 'none';

const maskClasses: Record<BGMaskType, string> = {
  'fade-edges': '[mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]',
  'fade-center': '[mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]',
  'fade-top': '[mask-image:linear-gradient(to_bottom,transparent,var(--background))]',
  'fade-bottom': '[mask-image:linear-gradient(to_bottom,var(--background),transparent)]',
  'fade-left': '[mask-image:linear-gradient(to_right,transparent,var(--background))]',
  'fade-right': '[mask-image:linear-gradient(to_right,var(--background),transparent)]',
  'fade-x': '[mask-image:linear-gradient(to_right,transparent,var(--background),transparent)]',
  'fade-y': '[mask-image:linear-gradient(to_bottom,transparent,var(--background),transparent)]',
  none: '',
};

function getBgImage(variant: string, fill: string, size: number): string | undefined {
  switch (variant) {
    case 'dots':
      return `radial-gradient(${fill} 1px, transparent 1px)`;
    case 'grid':
      return `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case 'diagonal-stripes':
      return `repeating-linear-gradient(45deg, ${fill}, ${fill} 1px, transparent 1px, transparent ${size}px)`;
    case 'horizontal-lines':
      return `linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case 'vertical-lines':
      return `linear-gradient(to right, ${fill} 1px, transparent 1px)`;
    case 'checkerboard':
      return `linear-gradient(45deg, ${fill} 25%, transparent 25%), linear-gradient(-45deg, ${fill} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${fill} 75%), linear-gradient(-45deg, transparent 75%, ${fill} 75%)`;
    default:
      return undefined;
  }
}

interface BGPatternProps extends ComponentProps<'div'> {
  variant?: 'dots' | 'diagonal-stripes' | 'grid' | 'horizontal-lines' | 'vertical-lines' | 'checkerboard';
  mask?: BGMaskType;
  size?: number;
  fill?: string;
}

function BGPattern({
  variant = 'grid',
  mask = 'none',
  size = 24,
  fill = '#252525',
  className,
  style,
  ...props
}: BGPatternProps) {
  const bgSize = `${size}px ${size}px`;
  const backgroundImage = getBgImage(variant, fill, size);
  return (
    <div
      className={cn('absolute inset-0 z-[-10] size-full', maskClasses[mask], className)}
      style={{ backgroundImage, backgroundSize: bgSize, ...style }}
      {...props}
    />
  );
}

// ─── GlowCard ────────────────────────────────────────────────────────────────

const glowColorMap = {
  blue:   { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green:  { base: 120, spread: 200 },
  red:    { base: 0,   spread: 200 },
  orange: { base: 30,  spread: 200 },
};

const GLOW_CSS = `
  [data-glow]::before,
  [data-glow]::after {
    pointer-events: none;
    content: "";
    position: absolute;
    inset: calc(var(--border-size) * -1);
    border: var(--border-size) solid transparent;
    border-radius: calc(var(--radius) * 1px);
    background-attachment: fixed;
    background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
    background-repeat: no-repeat;
    background-position: 50% 50%;
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }
  [data-glow]::before {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 50) * 1%) / var(--border-spot-opacity, 1)), transparent 100%
    );
    filter: brightness(2);
  }
  [data-glow]::after {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(0 100% 100% / var(--border-light-opacity, 1)), transparent 100%
    );
  }
  [data-glow] [data-glow] {
    position: absolute;
    inset: 0;
    will-change: filter;
    opacity: var(--outer, 1);
    border-radius: calc(var(--radius) * 1px);
    border-width: calc(var(--border-size) * 20);
    filter: blur(calc(var(--border-size) * 10));
    background: none;
    pointer-events: none;
    border: none;
  }
  [data-glow] > [data-glow]::before {
    inset: -10px;
    border-width: 10px;
  }
`;

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: keyof typeof glowColorMap;
}

function GlowCard({ children, className = '', glowColor = 'purple' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', e.clientX.toFixed(2));
        cardRef.current.style.setProperty('--xp', (e.clientX / window.innerWidth).toFixed(2));
        cardRef.current.style.setProperty('--y', e.clientY.toFixed(2));
        cardRef.current.style.setProperty('--yp', (e.clientY / window.innerHeight).toFixed(2));
      }
    };
    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const inlineStyles = {
    '--base': base,
    '--spread': spread,
    '--radius': '24',
    '--border': '2',
    '--backdrop': 'hsl(0 0% 60% / 0.12)',
    '--backup-border': 'var(--backdrop)',
    '--size': '200',
    '--outer': '1',
    '--border-size': 'calc(var(--border, 2) * 1px)',
    '--spotlight-size': 'calc(var(--size, 150) * 1px)',
    '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.1)), transparent
    )`,
    backgroundColor: 'var(--backdrop, transparent)',
    backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition: '50% 50%',
    backgroundAttachment: 'fixed',
    border: 'var(--border-size) solid var(--backup-border)',
    position: 'relative' as const,
    touchAction: 'none' as const,
  } as CSSProperties;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOW_CSS }} />
      <div
        ref={cardRef}
        data-glow
        style={inlineStyles}
        className={cn('rounded-3xl relative grid shadow-2xl backdrop-blur-[5px]', className)}
      >
        <div ref={innerRef} data-glow />
        {children}
      </div>
    </>
  );
}

// ─── Feature data ─────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Browse up to 30 jobs per search',
  'New grad, entry-level, and internship roles',
  'Role, experience, location, and remote filters',
  'Resume match scoring A–F grade badges',
  'Best Match sort',
  'Daily job alert emails',
  'Application tracker',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited job browsing',
  'Full-text search across 76,000+ jobs',
  'Filter by specific job source',
  'Unlimited application tracking',
  'NextRole AI Chat (RAG-powered)',
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PricingClient() {
  const searchParams = useSearchParams();
  const [tier, setTier] = useState<'free' | 'pro' | null>(null);
  const [loading, setLoading] = useState<'monthly' | 'yearly' | 'portal' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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
  const displayPrice = billingPeriod === 'yearly' ? '$50' : '$4.99';
  const displayPeriod = billingPeriod === 'yearly' ? '/ year' : '/ month';

  return (
    <div className="relative flex-1 overflow-hidden">
      <BGPattern variant="dots" mask="fade-edges" size={32} fill="#1a1a24" className="opacity-50" />

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-400">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free card */}
          <GlowCard className="p-6 md:p-8 flex flex-col bg-[#1a1a24]" glowColor="purple">
            <div className="flex-1 flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                <p className="text-gray-400 text-sm">Everything you need to get started.</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">$0</span>
                  <span className="text-gray-400">/ month</span>
                </div>
              </div>

              <div className="flex-1 mb-6">
                <ul className="space-y-3">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/jobs"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'w-full rounded-lg font-semibold bg-[#1a1a24] hover:bg-[#25252f] text-white border border-gray-700'
                )}
              >
                Get started →
              </Link>
            </div>
          </GlowCard>

          {/* Pro card */}
          <GlowCard className="p-6 md:p-8 flex flex-col bg-[#1a1a24] md:scale-105" glowColor="purple">
            <div className="relative flex-1 flex flex-col">
              <Badge
                className={cn(
                  'absolute -top-4 right-0 border-0 text-white',
                  isPro
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : 'bg-indigo-600 hover:bg-indigo-600'
                )}
              >
                {isPro ? 'Current Plan' : 'Most popular'}
              </Badge>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                <p className="text-gray-400 text-sm">Unlimited access for serious job seekers.</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">{displayPrice}</span>
                  <span className="text-gray-400">{displayPeriod}</span>
                </div>
                {billingPeriod === 'yearly' && (
                  <p className="text-sm text-green-400 mt-1">Save 17%</p>
                )}
              </div>

              <div className="flex-1 mb-6">
                <ul className="space-y-3">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {isPro ? (
                <Button
                  className="w-full rounded-lg font-semibold bg-[#1a1a24] hover:bg-[#25252f] text-white border border-gray-700"
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={loading === 'portal'}
                >
                  {loading === 'portal' ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                  ) : (
                    <><ExternalLink className="h-4 w-4 mr-2" />Manage Subscription</>
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setBillingPeriod('monthly'); handleUpgrade('monthly'); }}
                    disabled={!!loading}
                    className={cn(
                      'flex-1 rounded-lg',
                      billingPeriod === 'monthly'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                        : 'bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    {loading === 'monthly' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Monthly'
                    )}
                  </Button>

                  <div className="relative flex-1">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-green-400 whitespace-nowrap">
                      Best value
                    </span>
                    <Button
                      onClick={() => { setBillingPeriod('yearly'); handleUpgrade('yearly'); }}
                      disabled={!!loading}
                      className={cn(
                        'w-full rounded-lg',
                        billingPeriod === 'yearly'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                          : 'bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800'
                      )}
                    >
                      {loading === 'yearly' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Yearly'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
