'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getMinimumInterviewCountForStatus,
  getNextInterviewCount,
  normalizeInterviewCount,
} from '@/lib/interviews';
import { Application, ApplicationStatus, Role, ROLE_LABELS, STATUS_LABELS } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink, Loader2, LayoutGrid, Table2, X, Trash2 } from 'lucide-react';
import { removeTrackedId } from '@/lib/trackedStorage';
import AddCustomJobModal from '@/components/AddCustomJobModal';

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
  custom: 'Custom',
  pittcsc: 'SimplifyJobs',
  simplify_internships: 'Simplify Internships',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  adzuna: 'Adzuna',
  themuse: 'The Muse',
  recruitee: 'Recruitee',
  personio: 'Personio',
  jobright_business: 'Jobright (Business)',
  jobright_design: 'Jobright (Design)',
  jobright_marketing: 'Jobright (Marketing)',
  jobright_accounting: 'Jobright (Accounting)',
  jobright_pm: 'Jobright (PM)',
};

const ROLE_OPTIONS: Role[] = [
  'swe',
  'ds',
  'ml',
  'ai',
  'security',
  'devops',
  'consulting',
  'finance',
  'analyst',
  'pm',
];

type ApplicationPatch = {
  interviewCount?: number;
  notes?: string;
  status?: ApplicationStatus;
};

function normalizeApplication(app: Application) {
  return {
    ...app,
    interview_count: Math.max(
      normalizeInterviewCount(app.interview_count),
      getMinimumInterviewCountForStatus(app.status),
    ),
  };
}

async function patchApplication(id: string, { status, notes, interviewCount }: ApplicationPatch) {
  const body: Record<string, unknown> = {};
  if (status !== undefined) body.status = status;
  if (notes !== undefined) body.notes = notes;
  if (interviewCount !== undefined) body.interview_count = interviewCount;

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
  const [supabase] = useState(() => createClient());
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [interviewCount, setInterviewCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // View toggle — default to table
  const [view, setView] = useState<'table' | 'kanban'>('table');

  // Row pending inline confirm before delete
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Filters
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('all');

  const fetchApplications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setApps([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .select('*, job:jobs(*)')
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false });

    if (error) {
      toast.error('Failed to load applications');
    } else {
      setApps(((data ?? []) as Application[]).map(normalizeApplication));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  // Client-side filtering
  const filteredApps = apps.filter(app => {
    if (filterRole !== 'all') {
      const jobRoles = (app.job?.roles ?? []) as string[];
      if (!jobRoles.includes(filterRole)) return false;
    }
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;
    if (filterDate !== 'all') {
      const hoursMap: Record<string, number> = { '7': 168, '30': 720, '90': 2160 };
      const maxHours = hoursMap[filterDate];
      if (maxHours) {
        const diffHours = (Date.now() - new Date(app.applied_at).getTime()) / 3600000;
        if (diffHours > maxHours) return false;
      }
    }
    return true;
  });

  const hasActiveFilters = filterRole !== 'all' || filterStatus !== 'all' || filterDate !== 'all';

  function clearFilters() {
    setFilterRole('all');
    setFilterStatus('all');
    setFilterDate('all');
  }

  async function handleStatusChange(app: Application, status: ApplicationStatus) {
    const nextInterviewCount = getNextInterviewCount({
      currentStatus: app.status,
      nextStatus: status,
      currentCount: app.interview_count,
    });
    const prev = apps;
    setApps(apps.map(a => (
      a.id === app.id
        ? { ...a, status, interview_count: nextInterviewCount }
        : a
    )));

    if (selected?.id === app.id) {
      setSelected({ ...selected, status, interview_count: nextInterviewCount });
      setInterviewCount(nextInterviewCount);
    }

    try {
      await patchApplication(app.id, { status, interviewCount: nextInterviewCount });
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch {
      setApps(prev);
      if (selected?.id === app.id) {
        const normalizedApp = normalizeApplication(app);
        setSelected(normalizedApp);
        setInterviewCount(normalizedApp.interview_count ?? 0);
      }
      toast.error('Failed to update status');
    }
  }

  async function handleNoteSave(appId: string, newNotes: string) {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, notes: newNotes } : a));
    try {
      await patchApplication(appId, { notes: newNotes });
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
      await patchApplication(selected.id, {
        status: selected.status,
        notes,
        interviewCount,
      });
      setApps(apps.map(a => (
        a.id === selected.id
          ? { ...a, status: selected.status, notes, interview_count: interviewCount }
          : a
      )));
      toast.success('Application updated');
      setSelected(null);
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  function openSlideOver(app: Application) {
    const normalizedApp = normalizeApplication(app);
    setSelected(normalizedApp);
    setNotes(app.notes ?? '');
    setInterviewCount(normalizedApp.interview_count ?? 0);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#555566]" />
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
                      const nextInterviewCount = getNextInterviewCount({
                        currentStatus: selected.status,
                        nextStatus: status,
                        currentCount: interviewCount,
                      });
                      setSelected({ ...selected, status, interview_count: nextInterviewCount });
                      setInterviewCount(nextInterviewCount);
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
                  <Label htmlFor={`interview-count-${selected.id}`}>Interview count</Label>
                  <Input
                    id={`interview-count-${selected.id}`}
                    type="number"
                    min={getMinimumInterviewCountForStatus(selected.status)}
                    step="1"
                    inputMode="numeric"
                    value={interviewCount}
                    onChange={e => {
                      const nextValue = Number.parseInt(e.target.value, 10);
                      const minimumInterviewCount = getMinimumInterviewCountForStatus(selected.status);
                      const normalizedValue = Number.isNaN(nextValue)
                        ? minimumInterviewCount
                        : Math.max(minimumInterviewCount, nextValue);
                      setInterviewCount(normalizedValue);
                      setSelected({ ...selected, interview_count: normalizedValue });
                    }}
                  />
                  <p className="text-xs text-[#888899]">
                    Count recruiter phone calls and each interview round. Do not count OA, assessments, or HireVue.
                  </p>
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

                {selected.job?.url && selected.job.url !== '#' && (
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-[#f0f0fa]">Application Tracker</h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <AddCustomJobModal onJobAdded={fetchApplications} />
            {apps.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-2 text-sm border-[#2a2a35] text-[#f0f0fa] bg-[#1a1a24] hover:bg-[#2a2a35]"
                onClick={() => setView(v => v === 'table' ? 'kanban' : 'table')}
              >
                {view === 'table' ? (
                  <><LayoutGrid className="h-4 w-4" />Switch to Kanban view</>
                ) : (
                  <><Table2 className="h-4 w-4" />Switch to Table view</>
                )}
              </Button>
            )}
          </div>
        </div>

        {apps.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 gap-3 text-[#8888aa]">
            <p className="text-lg font-medium">No applications yet</p>
            <p className="text-sm text-center">
              Click &quot;+ Track&quot; on any job card or use Add Custom Job to track one manually.
            </p>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex justify-center py-1">
              <div className="flex items-end gap-8">
                {/* Role filter */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Role</span>
                  <Select value={filterRole} onValueChange={v => setFilterRole(v ?? 'all')}>
                    <SelectTrigger className="h-9 w-44 bg-[#12121e] border border-[#2a2a3e] text-indigo-300 rounded-lg text-sm font-medium transition-all duration-200 hover:border-indigo-500/50 hover:shadow-[0_0_8px_rgba(99,102,241,0.2)] focus:ring-1 focus:ring-indigo-500/30 focus:ring-offset-0 [&>svg]:text-indigo-300/60 [&>svg]:opacity-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status filter */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Status</span>
                  <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? 'all')}>
                    <SelectTrigger className="h-9 w-44 bg-[#12121e] border border-[#2a2a3e] text-indigo-300 rounded-lg text-sm font-medium transition-all duration-200 hover:border-indigo-500/50 hover:shadow-[0_0_8px_rgba(99,102,241,0.2)] focus:ring-1 focus:ring-indigo-500/30 focus:ring-offset-0 [&>svg]:text-indigo-300/60 [&>svg]:opacity-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {ALL_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Applied Date filter */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Applied Date</span>
                  <Select value={filterDate} onValueChange={v => setFilterDate(v ?? 'all')}>
                    <SelectTrigger className="h-9 w-44 bg-[#12121e] border border-[#2a2a3e] text-indigo-300 rounded-lg text-sm font-medium transition-all duration-200 hover:border-indigo-500/50 hover:shadow-[0_0_8px_rgba(99,102,241,0.2)] focus:ring-1 focus:ring-indigo-500/30 focus:ring-offset-0 [&>svg]:text-indigo-300/60 [&>svg]:opacity-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7">Last 7 Days</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                      <SelectItem value="90">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-[#c0c0d8] hover:text-[#f0f0fa] transition-colors mb-2"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
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
          </>
        )}
      </div>
    </>
  );
}
