'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { JobFilters, Role, ExperienceLevel, ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLES: Role[] = ['SWE', 'DS', 'ML', 'AI', 'Analyst', 'PM'];
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
  { value: 'pittcsc', label: 'SimplifyJobs (New Grad)' },
  { value: 'simplify_internships', label: 'Simplify Internships' },
  { value: 'adzuna', label: 'Adzuna' },
  { value: 'remoteok', label: 'RemoteOK' },
  { value: 'arbeitnow', label: 'Arbeitnow' },
  { value: 'themuse', label: 'The Muse' },
  { value: 'jobspy_indeed', label: 'Indeed' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' },
  { value: 'workday', label: 'Workday' },
  { value: 'wellfound', label: 'Wellfound' },
  { value: 'dice', label: 'Dice' },
  { value: 'handshake', label: 'Handshake' },
];

interface Props {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
}

export default function FilterSidebar({ filters, onChange }: Props) {
  function toggleRole(role: Role) {
    // Single-select: clicking the active chip deselects; clicking another switches to it
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
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => toggleRole(role)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-all border',
                filters.roles.includes(role)
                  ? ROLE_COLORS[role] + ' border-transparent'
                  : 'border-border text-muted-foreground hover:border-foreground/30'
              )}
            >
              {role}
            </button>
          ))}
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
