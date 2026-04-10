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

export const ROLE_OPTIONS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'swe', label: 'SWE' },
  { value: 'ds', label: 'DS' },
  { value: 'ml', label: 'ML' },
  { value: 'ai', label: 'AI' },
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
  { value: 'zapplyjobs',             label: 'ZapplyJobs' },
  { value: 'hackernews',             label: 'Hacker News' },
  { value: 'greenhouse',             label: 'Greenhouse' },
  { value: 'lever',                  label: 'Lever' },
  { value: 'ashby',                  label: 'Ashby' },
  { value: 'workday',                label: 'Workday' },
  { value: 'workable',               label: 'Workable' },
  { value: 'smartrecruiters',        label: 'SmartRecruiters' },
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
];

type FreeSourceOption = 'all' | 'github_repos' | 'job_boards';

interface FilterSidebarProps {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
  isPro?: boolean;
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
}: FilterSidebarProps) {
  const sectionLabelClassName =
    'mb-3 text-xs font-semibold uppercase tracking-wider text-[#9999bb]';
  const radioInputClassName = 'accent-indigo-500';
  const optionLabelClassName = 'flex items-center gap-2 cursor-pointer text-sm text-[#f0f0fa]';

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

  const freeSourceSelection = getFreeSourceSelection(filters.sources);

  return (
    <aside className="w-full overflow-x-hidden space-y-6 bg-[#0f0f12]">
      {/* Roles */}
      <div>
        <p className={sectionLabelClassName}>
          Role
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(({ value, label }) => {
            const isSelected =
              value === 'all'
                ? filters.roles.length === 0
                : filters.roles.includes(value as Role);
            const colorClass = isSelected
              ? 'bg-indigo-500 border-indigo-500 text-[#f0f0fa]'
              : 'border-[#2a2a35] bg-transparent text-[#f0f0fa]';
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
          {LEVELS.map(({ value, label }) => (
            <label key={label} className={optionLabelClassName}>
              <input
                type="radio"
                name="level"
                value={value}
                checked={filters.level === value}
                onChange={() => onChange({ ...filters, level: value, page: 1 })}
                className={radioInputClassName}
              />
              {label}
            </label>
          ))}
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
          checked={filters.remote}
          onCheckedChange={checked => onChange({ ...filters, remote: checked, page: 1 })}
          className="data-checked:bg-indigo-500 data-unchecked:bg-[#2a2a35]"
        />
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Location */}
      <div>
        <p className={sectionLabelClassName}>
          Location
        </p>
        <div className="space-y-2">
          {LOCATION_OPTIONS.map(({ value, label }) => (
            <label key={value} className={optionLabelClassName}>
              <input
                type="radio"
                name="location"
                value={value}
                checked={(filters.location || 'usa') === value}
                onChange={() => onChange({ ...filters, location: value, page: 1 })}
                className={radioInputClassName}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Posted within */}
      <div>
        <p className={sectionLabelClassName}>
          Posted within
        </p>
        <div className="space-y-2">
          {POSTED_OPTIONS.map(({ value, label }) => (
            <label key={label} className={optionLabelClassName}>
              <input
                type="radio"
                name="posted"
                value={value}
                checked={filters.postedWithin === value}
                onChange={() => onChange({ ...filters, postedWithin: value, page: 1 })}
                className={radioInputClassName}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Separator className="bg-[#1e1e28]" />

      {/* Sources */}
      <div>
        <p className={sectionLabelClassName}>
          Source
        </p>
        {isPro ? (
          <div className="space-y-2">
            <label className={optionLabelClassName}>
              <input
                type="radio"
                name="source"
                value=""
                checked={filters.sources.length === 0}
                onChange={() => toggleSource('')}
                className={radioInputClassName}
              />
              All
            </label>
            {SOURCES.map(({ value, label }) => (
              <label key={value} className={optionLabelClassName}>
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={filters.sources[0] === value}
                  onChange={() => toggleSource(value)}
                  className={radioInputClassName}
                />
                {label}
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <label className={optionLabelClassName}>
              <input
                type="radio"
                name="source"
                value=""
                checked={freeSourceSelection === 'all'}
                onChange={() => onChange({ ...filters, sources: [], page: 1 })}
                className={radioInputClassName}
              />
              All Sources
            </label>
            <label className={optionLabelClassName}>
              <input
                type="radio"
                name="source"
                value="github_repos"
                checked={freeSourceSelection === 'github_repos'}
                onChange={() => onChange({ ...filters, sources: ['github_repos'], page: 1 })}
                className={radioInputClassName}
              />
              GitHub Repos
            </label>
            <label className={optionLabelClassName}>
              <input
                type="radio"
                name="source"
                value="job_boards"
                checked={freeSourceSelection === 'job_boards'}
                onChange={() => onChange({ ...filters, sources: [...JOB_BOARD_SOURCES], page: 1 })}
                className={radioInputClassName}
              />
              Job Boards
            </label>
          </div>
        )}
      </div>
    </aside>
  );
}
