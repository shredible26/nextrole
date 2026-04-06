'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Job, Role, ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, ExternalLink, Plus } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  pittcsc: 'SimplifyJobs',
  simplify_internships: 'SimplifyJobs',
  adzuna: 'Adzuna',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  themuse: 'The Muse',
};

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const initial = company[0]?.toUpperCase() ?? '?';

  const colors = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  const colorClass = colors[company.charCodeAt(0) % colors.length];

  if (failed) {
    return (
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold', colorClass)}>
        {initial}
      </div>
    );
  }

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/50">
      <Image
        src={`https://logo.clearbit.com/${domain}`}
        alt={company}
        fill
        className="object-contain p-1"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}

interface Props {
  job: Job;
  tracked: boolean;
  onTrack: (job: Job) => void;
}

export default function JobCard({ job, tracked, onTrack }: Props) {
  const postedAgo = job.posted_at
    ? formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })
    : null;

  const salary =
    job.salary_min && job.salary_max
      ? `$${Math.round(job.salary_min / 1000)}k – $${Math.round(job.salary_max / 1000)}k`
      : job.salary_min
      ? `$${Math.round(job.salary_min / 1000)}k+`
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3">
        <CompanyLogo company={job.company} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-sm leading-snug">{job.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
            <span>{job.company}</span>
            {job.location && (
              <>
                <span>·</span>
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{job.location}</span>
              </>
            )}
          </div>
        </div>
        {job.remote && (
          <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-transparent text-xs">
            Remote
          </Badge>
        )}
      </div>

      {/* Role tags */}
      {job.roles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.roles.map(role => (
            <span
              key={role}
              className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[role as Role])}
            >
              {role}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {salary && <span className="font-medium text-foreground">{salary}</span>}
          <span>{SOURCE_LABELS[job.source] ?? job.source}</span>
          {postedAgo && <span>{postedAgo}</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Apply: opens the job URL, no tracking */}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
          >
            {job.source === 'adzuna' ? 'View on Adzuna' : 'Apply'}
            <ExternalLink className="h-3 w-3" />
          </Button>

          {/* Track: logs application, separate from apply */}
          {tracked ? (
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tracked
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => onTrack(job)}
            >
              <Plus className="h-3 w-3" />
              Track
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
