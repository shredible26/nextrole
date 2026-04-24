'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  GITHUB_REPO_SOURCE_SET,
  JOB_BOARD_SOURCES,
  JOB_BOARD_SOURCE_SET,
} from '@/lib/source-groups';
import { JobFilters, Role, ExperienceLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export const ROLE_OPTIONS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'swe', label: 'SWE' },
  { value: 'ds', label: 'DS' },
  { value: 'ml', label: 'ML' },
  { value: 'ai', label: 'AI' },
  { value: 'security', label: 'Security' },
  { value: 'devops', label: 'DevOps' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'finance', label: 'Finance' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'pm', label: 'PM' },
];
const LEVELS: { value: ExperienceLevel | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new_grad', label: 'New Grad' },
  { value: 'entry_level', label: 'Entry Level' },
  { value: 'internship', label: 'Internship' },
];
const POSTED_OPTIONS: { value: JobFilters['postedWithin']; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Last 24h' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last week' },
];
const LOCATION_OPTIONS: { value: Exclude<JobFilters['location'], ''>; label: string }[] = [
  { value: 'usa', label: 'USA' },
  { value: 'other', label: 'Other' },
];
const SOURCES = [
  { value: 'github_repos',           label: 'GitHub Repos' },
  { value: 'pittcsc',                label: 'Simplify (New Grad)' },
  { value: 'simplify_internships',   label: 'Simplify (Internships)' },
  { value: 'vanshb03_newgrad',       label: 'vanshb03 (New Grad)' },
  { value: 'vanshb03_internships',   label: 'vanshb03 (Internships)' },
  { value: 'ambicuity',              label: 'New Grad Jobs' },
  { value: 'speedyapply_ai_newgrad', label: 'SpeedyApply AI (New Grad)' },
  { value: 'speedyapply_swe_newgrad', label: 'SpeedyApply SWE' },
  { value: 'jobright_swe',           label: 'Jobright AI (SWE)' },
  { value: 'jobright_data',          label: 'Jobright AI (Data)' },
  { value: 'jobright_business',      label: 'Jobright (Business)' },
  { value: 'jobright_design',        label: 'Jobright (Design)' },
  { value: 'jobright_marketing',     label: 'Jobright (Marketing)' },
  { value: 'jobright_accounting',    label: 'Jobright (Accounting)' },
  { value: 'jobright_pm',            label: 'Jobright (PM)' },
  { value: 'zapplyjobs',             label: 'ZapplyJobs' },
  { value: 'hackernews',             label: 'Hacker News' },
  { value: 'greenhouse',             label: 'Greenhouse' },
  { value: 'lever',                  label: 'Lever' },
  { value: 'ashby',                  label: 'Ashby' },
  { value: 'recruitee',              label: 'Recruitee' },
  { value: 'workday',                label: 'Workday' },
  { value: 'workable',               label: 'Workable' },
  { value: 'smartrecruiters',        label: 'SmartRecruiters' },
  { value: 'personio',               label: 'Personio' },
  { value: 'adzuna',                 label: 'Adzuna' },
  { value: 'arbeitnow',              label: 'Arbeitnow' },
  { value: 'remoteok',               label: 'RemoteOK' },
  { value: 'themuse',                label: 'The Muse' },
  { value: 'jobspy_indeed',          label: 'Indeed' },
  { value: 'usajobs',                label: 'USAJobs' },
  { value: 'dice',                   label: 'Dice' },
  { value: 'simplyhired',            label: 'SimplyHired' },
  { value: 'ziprecruiter',           label: 'ZipRecruiter' },
  { value: 'glassdoor',              label: 'Glassdoor' },
  { value: 'careerjet',              label: 'Careerjet' },
  { value: 'workatastartup',         label: 'Work at a Startup' },
  { value: 'builtin',                label: 'BuiltIn' },
  { value: 'breezy',                 label: 'Breezy HR' },
  { value: 'icims',                  label: 'iCIMS' },
  { value: 'jazzhr',                 label: 'JazzHR' },
  { value: 'jobvite',                label: 'Jobvite' },
  { value: 'oraclecloud',            label: 'Oracle Cloud' },
];

type FreeSourceOption = 'all' | 'github_repos' | 'job_boards';

interface FilterSidebarProps {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
  isPro?: boolean;
  forYou: boolean;
  onForYouChange: (v: boolean) => void;
  userPreferences: { target_roles: string[]; target_levels: string[] };
}

function getFreeSourceSelection(sources: string[]): FreeSourceOption | null {
  if (sources.length === 0) return 'all';
  if (sources.length === 1 && sources[0] === 'github_repos') return 'github_repos';
  if (sources.every(source => GITHUB_REPO_SOURCE_SET.has(source))) return 'github_repos';
  if (sources.every(source => JOB_BOARD_SOURCE_SET.has(source))) return 'job_boards';
  return null;
}

export default function FilterSidebar({
  filters,
  onChange,
  isPro = false,
  forYou,
  onForYouChange,
  userPreferences,
}: FilterSidebarProps) {
  const sectionLabelClassName =
    'mb-3 text-xs font-semibold uppercase tracking-wider text-[#9999bb]';
  const optionLabelClassName = 'flex items-center gap-2.5 cursor-pointer group';
  const sourceOptionButtonClassName = cn(
    optionLabelClassName,
    'w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'
  );

  function toggleRole(role: Role | 'all') {
    if (role === 'all') {
      onChange({ ...filters, roles: [], page: 1 });
      return;
    }
    // Clicking the active role deselects it (back to 'all'); clicking another switches to it
    const roles = filters.roles[0] === role ? [] : [role];
    onChange({ ...filters, roles, page: 1 });
  }

  function toggleSource(source: string) {
    // Single-select: selecting '' means no filter; selecting the active source deselects it
    const sources = source === '' || filters.sources[0] === source ? [] : [source];
    onChange({ ...filters, sources, page: 1 });
  }

  function renderSourceOption({
    checked,
    label,
    onClick,
  }: {
    checked: boolean;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        aria-pressed={checked}
        className={sourceOptionButtonClassName}
        onClick={onClick}
      >
        <span className={`flex h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-indigo-500 bg-indigo-500' : 'border-[#444455] bg-transparent group-hover:border-[#6666aa]'
        }`}>
          {checked && (
            <span className="m-auto h-1.5 w-1.5 rounded-full bg-[#0d0d12]" />
          )}
        </span>
        <span className="text-sm text-[#f0f0fa]">{label}</span>
      </button>
    );
  }

  const freeSourceSelection = getFreeSourceSelection(filters.sources);
  const hasPreferences =
    userPreferences.target_roles.length > 0 ||
    userPreferences.target_levels.length > 0;
  const showOnlyForYouSelection = forYou;
  const disabledForYouTitle = hasPreferences
    ? undefined
    : 'Set your job preferences in Profile to use this filter';

  return (
    <aside className="w-full overflow-x-hidden space-y-6 bg-[#0f0f12]">
      <div>
        <button
          type="button"
          title={disabledForYouTitle}
          aria-pressed={forYou}
          aria-disabled={!hasPreferences}
          onClick={() => {
            if (!hasPreferences) return;
            onForYouChange(!forYou);
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
            forYou
              ? 'border-indigo-400/50 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20'
              : 'border-[#2a2a35] bg-[#171720] text-[#f0f0fa] hover:border-[#3a3a45] hover:bg-[#1d1d28]',
            !hasPreferences && 'cursor-not-allowed border-[#2a2a35] bg-[#12121a] text-[#9da1ba] hover:border-[#2a2a35] hover:bg-[#12121a] hover:text-[#9da1ba]'
          )}
        >
          <Sparkles className={cn('h-5 w-5 shrink-0', forYou ? 'text-white' : 'text-[#c7cbff]')} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">For You</div>
            <div className={cn('mt-0.5 text-xs', forYou ? 'text-white/80' : 'text-[#a9adca]')}>
              Uses your saved job preferences
            </div>
          </div>
        </button>
        <Separator className="mt-5 bg-[#1e1e28]" />
      </div>

      {/* Roles */}
      <div>
        <p className={sectionLabelClassName}>
          Role
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(({ value, label }) => {
            const isSelected =
              !showOnlyForYouSelection && (value === 'all'
                ? filters.roles.length === 0
                : filters.roles.includes(value as Role));
            const colorClass = isSelected
              ? 'bg-indigo-500 border-indigo-500 text-[#f0f0fa]'
              : 'border-[#35374a] bg-transparent text-[#f0f0fa] hover:border-[#4a4d63] hover:bg-[#171720]';
            return (
              <button
                key={value}
                onClick={() => toggleRole(value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-all border',
                  colorClass
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Level */}
      <div>
        <p className={sectionLabelClassName}>
          Experience Level
        </p>
        <div className="space-y-2">
          {LEVELS.map(({ value, label }) => {
            const checked = !showOnlyForYouSelection && filters.level === value;

            return (
              <label key={label} className={optionLabelClassName}>
                <input
                  type="radio"
                  name="level"
                  value={value}
                  checked={checked}
                  onMouseDown={e => e.preventDefault()}
                  onChange={() => onChange({ ...filters, level: value, page: 1 })}
                  className="sr-only"
                />
                <span className={`flex h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
                  checked ? 'border-indigo-500 bg-indigo-500' : 'border-[#444455] bg-transparent group-hover:border-[#6666aa]'
                }`}>
                  {checked && (
                    <span className="m-auto h-1.5 w-1.5 rounded-full bg-[#0d0d12]" />
                  )}
                </span>
                <span className="text-sm text-[#f0f0fa]">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Remote */}
      <div className="flex items-center justify-between">
        <Label htmlFor="remote-toggle" className="text-sm text-[#f0f0fa]">
          Remote only
        </Label>
        <Switch
          id="remote-toggle"
          checked={showOnlyForYouSelection ? false : filters.remote}
          onCheckedChange={checked => onChange({ ...filters, remote: checked, page: 1 })}
          className="border border-[#444455] data-checked:border-indigo-400/60 data-checked:bg-indigo-500 data-unchecked:border-[#444455] data-unchecked:bg-[#1a1a24] [&_[data-slot=switch-thumb]]:bg-[#f5f5ff] dark:[&_[data-slot=switch-thumb]]:bg-[#f5f5ff]"
        />
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Location */}
      <div>
        <p className={sectionLabelClassName}>
          Location
        </p>
        <div className="space-y-2">
          {LOCATION_OPTIONS.map(({ value, label }) => {
            const checked = !showOnlyForYouSelection && (filters.location || 'usa') === value;

            return (
              <label key={value} className={optionLabelClassName}>
                <input
                  type="radio"
                  name="location"
                  value={value}
                  checked={checked}
                  onMouseDown={e => e.preventDefault()}
                  onChange={() => onChange({ ...filters, location: value, page: 1 })}
                  className="sr-only"
                />
                <span className={`flex h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
                  checked ? 'border-indigo-500 bg-indigo-500' : 'border-[#444455] bg-transparent group-hover:border-[#6666aa]'
                }`}>
                  {checked && (
                    <span className="m-auto h-1.5 w-1.5 rounded-full bg-[#0d0d12]" />
                  )}
                </span>
                <span className="text-sm text-[#f0f0fa]">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Posted within */}
      <div>
        <p className={sectionLabelClassName}>
          Posted within
        </p>
        <div className="space-y-2">
          {POSTED_OPTIONS.map(({ value, label }) => {
            const checked = !showOnlyForYouSelection && filters.postedWithin === value;

            return (
              <label key={label} className={optionLabelClassName}>
                <input
                  type="radio"
                  name="posted"
                  value={value}
                  checked={checked}
                  onMouseDown={e => e.preventDefault()}
                  onChange={() => onChange({ ...filters, postedWithin: value, page: 1 })}
                  className="sr-only"
                />
                <span className={`flex h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
                  checked ? 'border-indigo-500 bg-indigo-500' : 'border-[#444455] bg-transparent group-hover:border-[#6666aa]'
                }`}>
                  {checked && (
                    <span className="m-auto h-1.5 w-1.5 rounded-full bg-[#0d0d12]" />
                  )}
                </span>
                <span className="text-sm text-[#f0f0fa]">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Sources */}
      <div>
        <p className={sectionLabelClassName}>
          Source
        </p>
        {isPro ? (
          <div className="space-y-2" role="group" aria-label="Source">
            {renderSourceOption({
              checked: !showOnlyForYouSelection && filters.sources.length === 0,
              label: 'All',
              onClick: () => toggleSource(''),
            })}
            {SOURCES.map(({ value, label }) => {
              const checked = !showOnlyForYouSelection && filters.sources[0] === value;

              return (
                <div key={value}>
                  {renderSourceOption({
                    checked,
                    label,
                    onClick: () => toggleSource(value),
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2" role="group" aria-label="Source">
            {renderSourceOption({
              checked: !showOnlyForYouSelection && freeSourceSelection === 'all',
              label: 'All Sources',
              onClick: () => onChange({ ...filters, sources: [], page: 1 }),
            })}
            {renderSourceOption({
              checked: !showOnlyForYouSelection && freeSourceSelection === 'github_repos',
              label: 'GitHub Repos',
              onClick: () => onChange({ ...filters, sources: ['github_repos'], page: 1 }),
            })}
            {renderSourceOption({
              checked: !showOnlyForYouSelection && freeSourceSelection === 'job_boards',
              label: 'Job Boards',
              onClick: () => onChange({ ...filters, sources: [...JOB_BOARD_SOURCES], page: 1 }),
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
