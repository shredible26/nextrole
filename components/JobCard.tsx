'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Job, Role, ROLE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Plus } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  pittcsc: 'SimplifyJobs',
  simplify_internships: 'SimplifyJobs',
  adzuna: 'Adzuna',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  themuse: 'The Muse',
  recruitee: 'Recruitee',
  jobright_business: 'Jobright (Business)',
  jobright_design: 'Jobright (Design)',
  jobright_marketing: 'Jobright (Marketing)',
  jobright_accounting: 'Jobright (Accounting)',
  jobright_pm: 'Jobright (PM)',
};

const ROLE_BADGE_COLORS: Partial<Record<Role, string>> = {
  swe: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  ds: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  ml: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  ai: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  security: 'bg-red-500/20 text-red-300 border border-red-500/30',
  devops: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  consulting: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  finance: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  pm: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  analyst: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
};
const DEFAULT_ROLE_BADGE_COLOR = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';

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
  fromUrl?: string;
}

export default function JobCard({ job, tracked, onTrack, fromUrl }: Props) {
  const postedAgo = job.posted_at
    ? formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })
    : null;
  const postedAgoFormatted = postedAgo
    ? postedAgo
        .replace(/^about /, '~')
        .replace(/ ago$/, '')
    : null;

  const salary =
    job.salary_min && job.salary_max
      ? `$${Math.round(job.salary_min / 1000)}k – $${Math.round(job.salary_max / 1000)}k`
      : job.salary_min
      ? `$${Math.round(job.salary_min / 1000)}k+`
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#2a2a35] bg-[#1a1a24] p-4 shadow-sm transition-shadow hover:border-[#3a3a45]">
      {/* Header */}
      <div className="flex items-start gap-3">
        <CompanyLogo company={job.company} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/jobs/${job.id}?from=${encodeURIComponent(fromUrl ?? '/jobs')}`}
            className="block truncate font-semibold text-sm leading-snug text-white hover:underline"
          >
            {job.title}
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-[#e0e0f0] font-medium truncate">
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
          <Badge className="shrink-0 bg-emerald-500/15 text-emerald-400 border-transparent text-xs">
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
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                ROLE_BADGE_COLORS[role as Role] ?? DEFAULT_ROLE_BADGE_COLOR
              )}
            >
              {ROLE_LABELS[role as Role] ?? role}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-3 text-[13px] font-medium text-[#e0e0f0]">
          {salary && <span className="font-medium text-[#f0f0fa]">{salary}</span>}
          <span>{SOURCE_LABELS[job.source] ?? job.source}</span>
          {postedAgoFormatted && <span>{postedAgoFormatted}</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Apply: opens the job URL, no tracking */}
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-indigo-600 text-white hover:bg-indigo-500 font-semibold border-0"
            onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
          >
            Apply ↗
          </Button>

          {/* Track: logs application, separate from apply */}
          {tracked ? (
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 px-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tracked
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 bg-[#2a2a35] text-[#f0f0fa] hover:bg-[#3a3a45] border border-[#444455] font-medium"
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
