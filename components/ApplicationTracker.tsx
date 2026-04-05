'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Application, ApplicationStatus, STATUS_LABELS } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink, Loader2 } from 'lucide-react';

const KANBAN_COLUMNS: ApplicationStatus[] = [
  'applied', 'phone_screen', 'oa', 'interview', 'offer',
];
const TERMINAL_STATUSES: ApplicationStatus[] = ['rejected', 'withdrawn'];
const ALL_STATUSES = [...KANBAN_COLUMNS, ...TERMINAL_STATUSES] as ApplicationStatus[];

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  applied:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  phone_screen:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  oa:            'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  interview:     'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  offer:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  withdrawn:     'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

async function patchApplication(id: string, status: ApplicationStatus, notes?: string) {
  const res = await fetch(`/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error('Update failed');
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
      className="w-full text-left rounded-lg border border-border/70 bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-1.5"
    >
      <p className="font-medium text-sm leading-snug">{app.job?.company ?? '—'}</p>
      <p className="text-xs text-muted-foreground truncate">{app.job?.title ?? '—'}</p>
      <p className="text-xs text-muted-foreground">
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
  }, []);

  async function handleStatusChange(app: Application, status: ApplicationStatus) {
    const prev = apps;
    setApps(apps.map(a => a.id === app.id ? { ...a, status } : a));
    try {
      await patchApplication(app.id, status, app.notes);
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch {
      setApps(prev);
      toast.error('Failed to update status');
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <p className="text-lg font-medium">No applications yet</p>
        <p className="text-sm">Click Apply on any job card and it'll appear here automatically.</p>
      </div>
    );
  }

  return (
    <>
      {/* Detail slide-over */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{selected.job?.title ?? 'Job'}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selected.job?.company}</p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {/* Status */}
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

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Recruiter name, interview round, etc."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="min-h-32 resize-none"
                  />
                </div>

                {/* Job link */}
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

      <Tabs defaultValue="kanban" className="flex flex-col flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Application Tracker</h1>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
        </div>

        {/* ── KANBAN ── */}
        <TabsContent value="kanban" className="flex-1">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map(col => {
              const colApps = apps.filter(a => a.status === col);
              return (
                <div key={col} className="flex flex-col gap-3 min-w-[200px] w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {STATUS_LABELS[col]}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {colApps.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {colApps.map(app => (
                      <KanbanCard key={app.id} app={app} onClick={() => openSlideOver(app)} />
                    ))}
                    {colApps.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
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
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Closed
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {apps.filter(a => TERMINAL_STATUSES.includes(a.status)).length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {apps
                  .filter(a => TERMINAL_STATUSES.includes(a.status))
                  .map(app => (
                    <KanbanCard key={app.id} app={app} onClick={() => openSlideOver(app)} />
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TABLE ── */}
        <TabsContent value="table" className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="pb-3 pr-4 font-medium">Company</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Applied</th>
                <th className="pb-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {apps.map(app => (
                <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4 font-medium">{app.job?.company ?? '—'}</td>
                  <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">
                    {app.job?.title ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <Select
                      value={app.status}
                      onValueChange={val => handleStatusChange(app, val as ApplicationStatus)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
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
                  <td className="py-3 pr-4 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {app.job?.source ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </>
  );
}
