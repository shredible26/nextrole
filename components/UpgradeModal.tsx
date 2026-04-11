'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const COMPARISON = [
  { feature: 'Jobs per page', free: '30', pro: 'Unlimited' },
  { feature: 'Role, experience & location filters', free: '✓', pro: '✓' },
  { feature: 'Full-text job search', free: '✓', pro: '✓' },
  { feature: 'Application tracker', free: 'Up to 100', pro: 'Unlimited' },
  { feature: 'AI resume match scoring', free: '—', pro: 'Coming soon' },
  { feature: 'Email alerts', free: '—', pro: 'Coming soon' },
  { feature: 'Filter by job source', free: '—', pro: '✓' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: 'search' | 'pagination';
}

export default function UpgradeModal({ open, onClose, reason }: Props) {
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
      <DialogContent className="sm:max-w-lg bg-[#1a1a24] border-[#2a2a35] text-[#f0f0fa]">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#f0f0fa]">
            {reason === 'search'
              ? 'Upgrade to Pro to unlock job search'
              : "You've seen your 30 jobs for today"}
          </DialogTitle>
          <DialogDescription className="text-[#aaaacc]">
            Upgrade to Pro for unlimited access.
          </DialogDescription>
        </DialogHeader>

        {/* Feature comparison table */}
        <div className="mt-2 overflow-hidden rounded-lg border border-[#2a2a35]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0d0d12]">
                <th className="px-3 py-2 text-left text-sm font-medium text-[#888899]">Feature</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-[#888899]">Free</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-[#888899]">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a35]">
              {COMPARISON.map(({ feature, free, pro }) => (
                <tr key={feature}>
                  <td className="px-3 py-3 text-sm text-[#f0f0fa]">{feature}</td>
                  <td className="px-3 py-3 text-center text-sm text-[#8888aa]">{free}</td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-indigo-400">
                    {pro === '✓' ? (
                      <Check className="mx-auto h-3 w-3" />
                    ) : pro === 'Unlimited' ? (
                      <span className="flex items-center justify-center gap-1">
                        <Check className="h-3 w-3" /> Unlimited
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
              className="w-full border-[#2a2a35] bg-[#0d0d12] text-[#f0f0fa] hover:bg-[#2a2a35]"
              onClick={() => handleUpgrade('monthly')}
              disabled={!!loading}
            >
              {loading === 'monthly' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Monthly'
              )}
            </Button>
            <p className="text-sm text-center text-[#aaaacc]">$4.99 / month</p>
          </div>

          {/* Yearly — highlighted */}
          <div className="flex flex-col gap-1.5 relative">
            <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white z-10 whitespace-nowrap">
              Best value
            </Badge>
            <Button
              className="w-full bg-indigo-500 text-white hover:bg-indigo-400"
              onClick={() => handleUpgrade('yearly')}
              disabled={!!loading}
            >
              {loading === 'yearly' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Yearly'
              )}
            </Button>
            <p className="text-sm text-center text-[#aaaacc]">$50 / year · save 17%</p>
          </div>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full text-[#aaaacc] hover:text-[#f0f0fa]">
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
