'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FilterSidebar from './FilterSidebar';
import JobCard from './JobCard';
import UpgradeModal from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { Job, JobFilters } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTrackedIds, addTrackedId, removeTrackedId, writeTrackedIds } from '@/lib/trackedStorage';
import { Loader2 } from 'lucide-react';

const DEFAULT_FILTERS: JobFilters = {
  roles: [],
  level: '',
  remote: false,
  postedWithin: '',
  sources: [],
  page: 1,
};

interface FeedResponse {
  jobs: Job[];
  total: number;
  page: number;
  perPage: number;
  error?: string;
  upgrade?: boolean;
}

export default function JobFeed() {
  const supabase = createClient();
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Seed from localStorage immediately so cards render correct state before Supabase resolves
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => getTrackedIds());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const isFirstLoad = useRef(true);

  // Pre-populate tracked IDs from the user's existing applications
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('job_id')
        .eq('user_id', user.id);
      if (data) {
        // Supabase is source of truth — overwrite localStorage with authoritative set
        const ids = new Set(data.map((a: { job_id: string }) => a.job_id));
        setTrackedIds(ids);
        writeTrackedIds(ids);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildQuery = useCallback((f: JobFilters) => {
    const params = new URLSearchParams();
    if (f.roles.length) params.set('roles', f.roles.join(','));
    if (f.level) params.set('level', f.level);
    if (f.remote) params.set('remote', 'true');
    if (f.postedWithin) params.set('postedWithin', f.postedWithin);
    if (f.sources.length) params.set('source', f.sources.join(','));
    params.set('page', String(f.page));
    return params.toString();
  }, []);

  const fetchJobs = useCallback(async (f: JobFilters, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await fetch(`/api/jobs?${buildQuery(f)}`);
      const data: FeedResponse = await res.json();

      if (data.upgrade) {
        setShowUpgrade(true);
        return;
      }
      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (append) {
        setJobs(prev => [...prev, ...(data.jobs ?? [])]);
      } else {
        setJobs(data.jobs ?? []);
      }
      setTotal(data.total ?? 0);
      setHasMore((data.jobs?.length ?? 0) === data.perPage && data.total > f.page * data.perPage);
    } catch {
      toast.error('Failed to load jobs. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  // On filter change, reset to page 1 and fetch fresh results
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
    }
    const f = { ...filters, page: 1 };
    setFilters(f);
    fetchJobs(f, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.roles.join(), filters.level, filters.remote, filters.postedWithin, filters.sources.join()]);

  // Initial load
  useEffect(() => {
    fetchJobs(filters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTrack(job: Job) {
    // Optimistic update — both React state and localStorage
    setTrackedIds(prev => new Set([...prev, job.id]));
    addTrackedId(job.id);

    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(() => {
      // Revert both on failure
      setTrackedIds(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      removeTrackedId(job.id);
      toast.error('Failed to track application');
    });
  }

  function handleLoadMore() {
    const next = { ...filters, page: filters.page + 1 };
    setFilters(next);
    fetchJobs(next, true);
  }

  function handleFilterChange(f: JobFilters) {
    setFilters(f);
  }

  return (
    <>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* h-14 = 56px navbar height; both columns scroll independently */}
      <div className="flex h-[calc(100vh-56px)] overflow-hidden mx-auto w-full max-w-7xl">
        {/* Sidebar — independent scroll */}
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto border-r px-6 py-6">
          <FilterSidebar filters={filters} onChange={handleFilterChange} />
        </aside>

        {/* Feed — independent scroll */}
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${total.toLocaleString()} jobs found`}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <p className="font-medium">No jobs found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  tracked={trackedIds.has(job.id)}
                  onTrack={handleTrack}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="min-w-32"
              >
                {loadingMore ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
