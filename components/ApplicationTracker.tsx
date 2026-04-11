'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Application, ApplicationStatus, Role, ROLE_LABELS, STATUS_LABELS } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink, Loader2, LayoutGrid, Table2, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { removeTrackedId } from '@/lib/trackedStorage';

const KANBAN_COLUMNS: ApplicationStatus[] = [
  'applied', 'phone_screen', 'oa', 'interview', 'offer',
];
const TERMINAL_STATUSES: ApplicationStatus[] = ['rejected', 'withdrawn'];
const ALL_STATUSES = [...KANBAN_COLUMNS, ...TERMINAL_STATUSES] as ApplicationStatus[];

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  applied:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  phone_screen:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  oa:            'bg-orange-500/20 text-orange-300 border-orange-500/30',
  interview:     'bg-purple-500/20 text-purple-300 border-purple-500/30',
  offer:         'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected:      'bg-red-500/20 text-red-300 border-red-500/30',
  withdrawn:     'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const SOURCE_LABELS: Record<string, string> = {
  pittcsc: 'SimplifyJobs',
  simplify_internships: 'Simplify Internships',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  adzuna: 'Adzuna',
  themuse: 'The Muse',
};

const ROLE_OPTIONS: Role[] = ['swe', 'ds', 'ml', 'ai', 'analyst', 'pm'];

const ROLE_CHIP_COLORS: Record<Role, string> = {
  swe:     'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  ds:      'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  ml:      'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  ai:      'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  analyst: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  pm:      'bg-violet-500/20 text-violet-300 border border-violet-500/30',
};

async function patchApplication(id: string, status?: ApplicationStatus, notes?: string) {
  const body: Record<string, unknown> = {};
  if (status !== undefined) body.status = status;
  if (notes !== undefined) body.notes = notes;

  const res = await fetch(`/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Update failed');
}

function NotesCell({
  appId,
  initialNotes,
  onSave,
}: {
  appId: string;
  initialNotes: string;
  onSave: (id: string, notes: string) => void;
}) {
  const [value, setValue] = useState(initialNotes);

  function handleBlur() {
    if (value !== initialNotes) {
      onSave(appId, value);
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Add notes…"
      className="w-full min-w-[140px] h-7 text-xs bg-transparent border border-transparent rounded-md px-2 hover:border-[#2a2a35] focus:border-[#2a2a35] focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-[#555566]"
    />
  );
}

function KanbanCard({
  app,
  onClick,
}: {
  app: Application;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-[#2a2a35] bg-[#1a1a24] p-3 hover:border-[#3a3a45] transition-colors space-y-1.5"
    >
      <p className="font-medium text-sm leading-snug text-[#f0f0fa]">{app.job?.company ?? '—'}</p>
      <p className="text-xs text-[#c0c0d8] line-clamp-2">{app.job?.title ?? '—'}</p>
      <p className="text-xs text-[#8888aa]">
        {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
      </p>
      <Badge className={`text-[10px] px-1.5 py-0 border-transparent ${STATUS_COLORS[app.status]}`}>
        {STATUS_LABELS[app.status]}
      </Badge>
    </button>
  );
}

export default function ApplicationTracker() {
  const supabase = createClient();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // View toggle — default to table
  const [view, setView] = useState<'table' | 'kanban'>('table');

  // Row pending inline confirm before delete
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Filters
  const [filterRoles, setFilterRoles] = useState<Role[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('any');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(*)')
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) toast.error('Failed to load applications');
      else setApps((data ?? []) as Application[]);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side filtering
  const filteredApps = apps.filter(app => {
    if (filterRoles.length > 0) {
      const jobRoles = (app.job?.roles ?? []) as string[];
      if (!filterRoles.some(r => jobRoles.includes(r))) return false;
    }
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;
    if (filterDate !== 'any') {
      const hoursMap: Record<string, number> = { '1': 24, '3': 72, '7': 168, '30': 720 };
      const maxHours = hoursMap[filterDate];
      if (maxHours) {
        const diffHours = (Date.now() - new Date(app.applied_at).getTime()) / 3600000;
        if (diffHours > maxHours) return false;
      }
    }
    return true;
  });

  const hasActiveFilters = filterRoles.length > 0 || filterStatus !== 'all' || filterDate !== 'any';

  function clearFilters() {
    setFilterRoles([]);
    setFilterStatus('all');
    setFilterDate('any');
  }

  function toggleRole(role: Role) {
    setFilterRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function handleStatusChange(app: Application, status: ApplicationStatus) {
    const prev = apps;
    setApps(apps.map(a => a.id === app.id ? { ...a, status } : a));
    try {
      await patchApplication(app.id, status);
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch {
      setApps(prev);
      toast.error('Failed to update status');
    }
  }

  async function handleNoteSave(appId: string, newNotes: string) {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, notes: newNotes } : a));
    try {
      await patchApplication(appId, undefined, newNotes);
    } catch {
      toast.error('Failed to save notes');
    }
  }

  async function handleDeleteApp(appId: string, jobId: string | undefined) {
    // Optimistic: remove from local state and localStorage immediately
    setApps(prev => prev.filter(a => a.id !== appId));
    setConfirmingDeleteId(null);
    if (jobId) removeTrackedId(jobId);

    try {
      const res = await fetch(`/api/applications/${appId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to remove application');
      // Re-fetch would be ideal here; for now the user can reload
    }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      await patchApplication(selected.id, selected.status, notes);
      setApps(apps.map(a => a.id === selected.id ? { ...a, notes } : a));
      toast.success('Notes saved');
      setSelected(null);
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  function openSlideOver(app: Application) {
    setSelected(app);
    setNotes(app.notes ?? '');
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#555566]" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24 gap-3 text-[#8888aa]">
        <p className="text-lg font-medium">No applications yet</p>
        <p className="text-sm">Click &quot;+ Track&quot; on any job card and it&apos;ll appear here.</p>
      </div>
    );
  }

  return (
    <>
      {/* Detail slide-over */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[#1a1a24] border-[#2a2a35]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base text-[#f0f0fa]">{selected.job?.title ?? 'Job'}</SheetTitle>
                <p className="text-sm text-[#c0c0d8]">{selected.job?.company}</p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={selected.status}
                    onValueChange={val => {
                      const status = val as ApplicationStatus;
                      setSelected({ ...selected, status });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Recruiter name, interview round, etc."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="min-h-32 resize-none"
                  />
                </div>

                {selected.job?.url && (
                  <a
                    href={selected.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View job posting
                  </a>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveNotes} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 gap-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#f0f0fa]">Application Tracker</h1>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-sm border-[#2a2a35] text-[#f0f0fa] bg-[#1a1a24] hover:bg-[#2a2a35]"
            onClick={() => setView(v => v === 'table' ? 'kanban' : 'table')}
          >
            {view === 'table' ? (
              <><LayoutGrid className="h-4 w-4" />Switch to Kanban view</>
            ) : (
              <><Table2 className="h-4 w-4" />Switch to Table view</>
            )}
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2a2a35] bg-[#1a1a24]/30 px-4 py-3">
          {/* Role chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {ROLE_OPTIONS.map(role => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  filterRoles.includes(role)
                    ? ROLE_CHIP_COLORS[role]
                    : 'border-[#2a2a35] bg-transparent text-[#f0f0fa] hover:border-[#3a3a45]'
                )}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#2a2a35] hidden sm:block" />

          {/* Status dropdown */}
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? 'all')}>
            <SelectTrigger className="h-7 w-36 text-xs bg-[#1a1a24] border-[#2a2a35] text-[#f0f0fa]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {ALL_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date applied dropdown */}
          <Select value={filterDate} onValueChange={v => setFilterDate(v ?? 'any')}>
            <SelectTrigger className="h-7 w-36 text-xs bg-[#1a1a24] border-[#2a2a35] text-[#f0f0fa]">
              <SelectValue placeholder="Date applied" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any" className="text-xs">Any time</SelectItem>
              <SelectItem value="1" className="text-xs">Last 24h</SelectItem>
              <SelectItem value="3" className="text-xs">Last 3 days</SelectItem>
              <SelectItem value="7" className="text-xs">Last week</SelectItem>
              <SelectItem value="30" className="text-xs">Last month</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[#c0c0d8] hover:text-[#f0f0fa] transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Application count */}
        <p className="text-sm text-[#c0c0d8] -mt-2">
          {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
        </p>

        {/* No results */}
        {filteredApps.length === 0 && hasActiveFilters ? (
          <div className="flex flex-1 flex-col items-center justify-center py-20 gap-3 text-[#8888aa]">
            <p className="font-medium">No applications match your filters</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : view === 'table' ? (
          /* ── TABLE ── */
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a35] text-left text-xs text-[#888899] uppercase tracking-wider">
                  <th className="pb-3 pr-4 font-medium">Company</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Applied</th>
                  <th className="pb-3 pr-4 font-medium">Source</th>
                  <th className="pb-3 pr-4 font-medium">Notes</th>
                  <th className="pb-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a35]/60">
                {filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-[#1a1a24]/50 transition-colors">
                    <td className="py-3 pr-4 font-medium whitespace-nowrap text-[#f0f0fa]">{app.job?.company ?? '—'}</td>
                    <td className="py-3 pr-4 text-[#c0c0d8] max-w-[240px]">
                      {app.job?.title ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <Select
                        value={app.status}
                        onValueChange={val => handleStatusChange(app, val as ApplicationStatus)}
                      >
                        <SelectTrigger
                          className={`h-7 w-36 text-xs border bg-[#1a1a24] focus:ring-1 focus:ring-indigo-500/50 ${
                            STATUS_COLORS[app.status] ?? 'border-[#2a2a35] text-[#f0f0fa]'
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pr-4 text-[#c0c0d8] text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#c0c0d8] whitespace-nowrap">
                      {SOURCE_LABELS[app.job?.source ?? ''] ?? app.job?.source ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <NotesCell
                        key={app.id}
                        appId={app.id}
                        initialNotes={app.notes ?? ''}
                        onSave={handleNoteSave}
                      />
                    </td>
                    <td className="py-3 text-right">
                      {confirmingDeleteId === app.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-[#c0c0d8] whitespace-nowrap">Remove?</span>
                          <button
                            onClick={() => handleDeleteApp(app.id, app.job_id)}
                            className="font-medium text-red-500 hover:text-red-400 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-[#c0c0d8] hover:text-[#f0f0fa] transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(app.id)}
                          className="p-1 rounded text-[#555566] hover:text-red-500 transition-colors"
                          aria-label="Remove application"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── KANBAN ── */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map(col => {
              const colApps = filteredApps.filter(a => a.status === col);
              return (
                <div key={col} className="flex flex-col gap-3 min-w-[200px] w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#888899]">
                      {STATUS_LABELS[col]}
                    </span>
                    <span className="rounded-full bg-[#1a1a24] px-2 py-0.5 text-xs text-[#888899]">
                      {colApps.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {colApps.map(app => (
                      <KanbanCard key={app.id} app={app} onClick={() => openSlideOver(app)} />
                    ))}
                    {colApps.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[#2a2a35] p-4 text-center text-xs text-[#555566]">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Rejected / Withdrawn combined column */}
            <div className="flex flex-col gap-3 min-w-[200px] w-[200px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#888899]">
                  Closed
                </span>
                <span className="rounded-full bg-[#1a1a24] px-2 py-0.5 text-xs text-[#888899]">
                  {filteredApps.filter(a => TERMINAL_STATUSES.includes(a.status)).length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {filteredApps
                  .filter(a => TERMINAL_STATUSES.includes(a.status))
                  .map(app => (
                    <KanbanCard key={app.id} app={app} onClick={() => openSlideOver(app)} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
