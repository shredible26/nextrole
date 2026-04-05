'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">You've hit today's limit</DialogTitle>
          <DialogDescription>
            Free users can view 20 jobs per day. Upgrade to Pro for unlimited access.
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
                  <td className="px-3 py-2 text-center text-xs font-medium text-primary flex items-center justify-center gap-1">
                    {pro === 'Unlimited' || pro === '✓' ? (
                      <><Check className="h-3 w-3" />{pro}</>
                    ) : (
                      pro
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Link href="/pricing" className={cn(buttonVariants(), 'w-full justify-center')}>
            Upgrade to Pro — $15/mo
          </Link>
          <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
