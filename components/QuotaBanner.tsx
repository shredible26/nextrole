'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface Props {
  viewed: number;
  limit: number;
}

export default function QuotaBanner({ viewed, limit }: Props) {
  const remaining = Math.max(0, limit - viewed);
  const pct = Math.min(100, Math.round((viewed / limit) * 100));
  const isNearLimit = remaining <= 5;

  // Calculate time until midnight reset
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntil = midnight.getTime() - now.getTime();
  const hoursUntil = Math.floor(msUntil / 3_600_000);
  const minsUntil = Math.floor((msUntil % 3_600_000) / 60_000);
  const resetLabel =
    hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm mb-4 ${
        isNearLimit
          ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        {isNearLimit && <AlertCircle className="h-4 w-4 shrink-0" />}
        <span>
          <strong className="font-semibold">{viewed} / {limit}</strong> jobs viewed today
          {' · '}Resets in {resetLabel}
        </span>
        {/* Progress bar */}
        <div className="hidden sm:flex h-1.5 w-24 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-orange-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 font-semibold underline-offset-2 hover:underline"
      >
        Upgrade for unlimited →
      </Link>
    </div>
  );
}
