'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const COMPARISON = [
  { feature: 'Jobs per day', free: '20', pro: 'Unlimited' },
  { feature: 'Role filters', free: '✓', pro: '✓' },
  { feature: 'Remote filter', free: '✓', pro: '✓' },
  { feature: 'Application tracking', free: '✓', pro: '✓' },
  { feature: 'AI match scoring', free: '—', pro: 'Coming soon' },
  { feature: 'Email alerts', free: '—', pro: 'Coming soon' },
  { feature: 'CSV export', free: '—', pro: 'Coming soon' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);

  async function handleUpgrade(plan: 'monthly' | 'yearly') {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

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
      }
    } catch {
      // no-op — user stays on page
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">You've seen your 20 jobs for today</DialogTitle>
          <DialogDescription>
            Upgrade to Pro for unlimited access.
          </DialogDescription>
        </DialogHeader>

        {/* Feature comparison table */}
        <div className="mt-2 rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Feature</th>
                <th className="px-3 py-2 text-center font-medium text-xs text-muted-foreground">Free</th>
                <th className="px-3 py-2 text-center font-medium text-xs text-primary">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {COMPARISON.map(({ feature, free, pro }) => (
                <tr key={feature}>
                  <td className="px-3 py-2 text-xs">{feature}</td>
                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">{free}</td>
                  <td className="px-3 py-2 text-center text-xs font-medium text-primary">
                    {pro === 'Unlimited' || pro === '✓' ? (
                      <span className="flex items-center justify-center gap-1">
                        <Check className="h-3 w-3" />{pro}
                      </span>
                    ) : (
                      pro
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Plan selection */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          {/* Monthly */}
          <div className="flex flex-col gap-1.5">
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
            <p className="text-xs text-center text-muted-foreground">$4.99 / month</p>
          </div>

          {/* Yearly — highlighted */}
          <div className="flex flex-col gap-1.5 relative">
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
            <p className="text-xs text-center text-muted-foreground">$50 / year · save 17%</p>
          </div>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
