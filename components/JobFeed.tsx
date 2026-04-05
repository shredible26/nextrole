'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FilterSidebar from './FilterSidebar';
import JobCard from './JobCard';
import UpgradeModal from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { Job, JobFilters } from '@/lib/types';
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
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const isFirstLoad = useRef(true);

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
        // Keep existing jobs visible — do not replace the list
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

  // On filter change, always reset to page 1 and fetch fresh results
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

  async function handleApply(job: Job) {
    setAppliedIds(prev => new Set([...prev, job.id]));

    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(() => {});

    window.open(job.url, '_blank', 'noopener,noreferrer');
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

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 sm:px-6 py-8">
        {/* Sidebar */}
        <div className="hidden md:block">
          <div className="sticky top-20">
            <FilterSidebar filters={filters} onChange={handleFilterChange} />
          </div>
        </div>

        {/* Feed */}
        <div className="flex flex-1 flex-col min-w-0">
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
                  applied={appliedIds.has(job.id)}
                  onApply={handleApply}
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
