'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { JobFilters, Role, ExperienceLevel, ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLES: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'SWE', label: 'SWE' },
  { value: 'DS', label: 'DS' },
  { value: 'ML', label: 'ML' },
  { value: 'AI', label: 'AI' },
  { value: 'Analyst', label: 'Analyst' },
  { value: 'PM', label: 'PM' },
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
const SOURCES = [
  { value: 'github_repos',           label: 'GitHub Repos' },
  { value: 'pittcsc',                label: 'Simplify (New Grad)' },
  { value: 'simplify_internships',   label: 'Simplify (Internships)' },
  { value: 'vanshb03_newgrad',       label: 'vanshb03 (New Grad)' },
  { value: 'vanshb03_internships',   label: 'vanshb03 (Internships)' },
  { value: 'speedyapply_swe',        label: 'SpeedyApply (SWE)' },
  { value: 'speedyapply_ai',         label: 'SpeedyApply (AI)' },
  { value: 'greenhouse',             label: 'Greenhouse' },
  { value: 'lever',                  label: 'Lever' },
  { value: 'workday',                label: 'Workday' },
  { value: 'adzuna',                 label: 'Adzuna' },
  { value: 'arbeitnow',              label: 'Arbeitnow' },
  { value: 'remoteok',               label: 'RemoteOK' },
  { value: 'themuse',                label: 'The Muse' },
  { value: 'jobspy_indeed',          label: 'Indeed' },
  { value: 'wellfound',              label: 'Wellfound' },
  { value: 'dice',                   label: 'Dice' },
  { value: 'handshake',              label: 'Handshake' },
  { value: 'ashby',                  label: 'Ashby' },
  { value: 'bamboohr',               label: 'BambooHR' },
  { value: 'rippling',               label: 'Rippling' },
  { value: 'dice_rss',               label: 'Dice' },
  { value: 'usajobs',                label: 'USAJobs' },
];

interface Props {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
}

export default function FilterSidebar({ filters, onChange }: Props) {
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

  return (
    <aside className="w-64 shrink-0 space-y-6">
      {/* Roles */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Role
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(({ value, label }) => {
            const isSelected =
              value === 'all'
                ? filters.roles.length === 0
                : filters.roles.includes(value as Role);
            const colorClass =
              isSelected && value !== 'all'
                ? ROLE_COLORS[value as Role] + ' border-transparent'
                : isSelected
                ? 'bg-foreground text-background border-transparent'
                : 'border-border text-muted-foreground hover:border-foreground/30';
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

      <Separator />

      {/* Level */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Experience Level
        </p>
        <div className="space-y-2">
          {LEVELS.map(({ value, label }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="level"
                value={value}
                checked={filters.level === value}
                onChange={() => onChange({ ...filters, level: value, page: 1 })}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Remote */}
      <div className="flex items-center justify-between">
        <Label htmlFor="remote-toggle" className="text-sm">
          Remote only
        </Label>
        <Switch
          id="remote-toggle"
          checked={filters.remote}
          onCheckedChange={checked => onChange({ ...filters, remote: checked, page: 1 })}
        />
      </div>

      <Separator />

      {/* Posted within */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Posted within
        </p>
        <div className="space-y-2">
          {POSTED_OPTIONS.map(({ value, label }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="posted"
                value={value}
                checked={filters.postedWithin === value}
                onChange={() => onChange({ ...filters, postedWithin: value, page: 1 })}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sources */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Source
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="source"
              value=""
              checked={filters.sources.length === 0}
              onChange={() => toggleSource('')}
              className="accent-primary"
            />
            All
          </label>
          {SOURCES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="source"
                value={value}
                checked={filters.sources[0] === value}
                onChange={() => toggleSource(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
