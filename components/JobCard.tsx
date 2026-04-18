'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
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
  personio: 'Personio',
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

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: '#22c55e', text: '#ffffff' },
  B: { bg: '#14b8a6', text: '#ffffff' },
  C: { bg: '#eab308', text: '#000000' },
  D: { bg: '#f97316', text: '#ffffff' },
  F: { bg: '#ef4444', text: '#ffffff' },
};

interface Props {
  job: Job;
  tracked: boolean;
  onTrack: (job: Job) => void;
  onOpen?: () => void;
  fromUrl?: string;
  matchScore?: { grade: string; similarity: number };
  showGrade?: boolean;
}

export default function JobCard({ job, tracked, onTrack, onOpen, fromUrl, matchScore, showGrade = true }: Props) {
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

  const gradeColors = matchScore ? (GRADE_COLORS[matchScore.grade] ?? GRADE_COLORS['F']) : null;
  const showGradeBadge = showGrade && matchScore && gradeColors;

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#2a2a35] bg-[#1a1a24] p-[18px] transition-colors hover:border-[#3a3a45]">
      {/* Header: logo + company/title/location + grade */}
      <div className="flex items-start gap-3">
        <CompanyLogo company={job.company} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold tracking-[-0.005em] text-[#f0f0fa]">
            {job.company}
          </div>
          <Link
            href={`/jobs/${job.id}?from=${encodeURIComponent(fromUrl ?? '/jobs')}`}
            onClick={onOpen}
            className="mt-[3px] block truncate text-sm font-medium leading-[1.35] text-[#d0d0e0] hover:underline"
          >
            {job.title}
          </Link>
          {job.location && (
            <div className="mt-[5px] flex items-center gap-1 truncate text-xs text-[#8888aa]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          )}
        </div>
        {showGradeBadge && (
          <div
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
            style={{
              backgroundColor: `${gradeColors.bg}1f`,
              border: `1px solid ${gradeColors.bg}59`,
              color: gradeColors.bg,
            }}
            title={`Match score: ${matchScore.grade} (${(matchScore.similarity * 100).toFixed(0)}%)`}
          >
            {matchScore.grade}
          </div>
        )}
      </div>

      {/* Role tags + Remote pill */}
      {(job.roles.length > 0 || job.remote) && (
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
          {job.remote && (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              Remote
            </span>
          )}
        </div>
      )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-[#24242e] pt-3">
          <div className="flex items-center gap-2 text-[11px] text-[#70708a]">
            {salary && <span className="font-semibold text-[#d0d0e0]">{salary}</span>}
            {salary && <span>·</span>}
            <span>{SOURCE_LABELS[job.source] ?? job.source}</span>
            {postedAgoFormatted && <><span>·</span><span>{postedAgoFormatted}</span></>}
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
