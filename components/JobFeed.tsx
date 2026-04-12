'use client';

import { type FocusEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FilterSidebar from './FilterSidebar';
import JobCard from './JobCard';
import UpgradeModal from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Job, JobFilters } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTrackedIds, addTrackedId, removeTrackedId, writeTrackedIds } from '@/lib/trackedStorage';
import { Loader2, Lock, Search, X } from 'lucide-react';

const DEFAULT_FILTERS: JobFilters = {
  roles: [],
  search: '',
  level: '',
  remote: false,
  location: 'usa',
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

interface ApplyResponse {
  success?: boolean;
  error?: string;
  upgrade?: boolean;
  reason?: 'tracker';
}

export default function JobFeed() {
  const supabase = createClient();
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  // Seed from localStorage immediately so cards render correct state before Supabase resolves
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => getTrackedIds());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'search' | 'pagination' | 'tracker'>('pagination');
  const [hasMore, setHasMore] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-populate tracked IDs and tier from Supabase
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      setIsPro(profile?.tier === 'pro');

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
    if (f.search) params.set('search', f.search);
    if (f.level) params.set('level', f.level);
    if (f.remote) params.set('remote', 'true');
    if (f.location) params.set('location', f.location);
    if (f.postedWithin) params.set('postedWithin', f.postedWithin);
    if (f.sources.length) params.set('source', f.sources.join(','));
    params.set('page', String(f.page));
    return params.toString();
  }, []);

  const fetchJobs = useCallback(async (f: JobFilters, append = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await fetch(`/api/jobs?${buildQuery(f)}`);
      const data: FeedResponse = await res.json();

      if (requestId !== requestIdRef.current) return;

      if (data.upgrade) {
        setUpgradeReason('pagination');
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
      if (requestId !== requestIdRef.current) return;
      toast.error('Failed to load jobs. Please try again.');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      setFilters(prev =>
        prev.search === nextSearch
          ? prev
          : { ...prev, search: nextSearch, page: 1 }
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // On filter change, reset to page 1 and fetch fresh results
  useEffect(() => {
    const nextFilters = filters.page === 1 ? filters : { ...filters, page: 1 };

    if (nextFilters !== filters) {
      setFilters(nextFilters);
    }

    fetchJobs(nextFilters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.roles.join(), filters.search, filters.level, filters.remote, filters.location, filters.postedWithin, filters.sources.join()]);

  async function handleTrack(job: Job) {
    // Optimistic update — both React state and localStorage
    setTrackedIds(prev => new Set([...prev, job.id]));
    addTrackedId(job.id);

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id }),
      });
      const data: ApplyResponse = await res.json();

      if (data.upgrade && data.reason === 'tracker') {
        setTrackedIds(prev => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        removeTrackedId(job.id);
        setUpgradeReason('tracker');
        setShowUpgrade(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to track application');
      }
    } catch {
      // Revert both on failure
      setTrackedIds(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      removeTrackedId(job.id);
      toast.error('Failed to track application');
    }
  }

  function handleLoadMore() {
    const next = { ...filters, page: filters.page + 1 };
    setFilters(next);
    fetchJobs(next, true);
  }

  function handleFilterChange(f: JobFilters) {
    setFilters(f);
  }

  function handleClearSearch() {
    if (inputRef.current) {
      inputRef.current.blur();
    }
  }

  function openUpgradeModal(reason: 'search' | 'pagination' | 'tracker' = 'pagination') {
    setUpgradeReason(reason);
    window.setTimeout(() => {
      setShowUpgrade(true);
    }, 50);
  }

  function handleSearchFocus(e: FocusEvent<HTMLInputElement>) {
    if (isPro) return;
    if (showUpgrade) return;
    e.preventDefault();
    e.currentTarget.blur();
    openUpgradeModal('search');
  }

  function handleSearchChange(value: string) {
    if (!isPro) {
      openUpgradeModal('search');
      return;
    }

    setSearchInput(value);
  }

  const isSearching = loading && (searchInput.trim().length > 0 || filters.search.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0d0d12]">
      <UpgradeModal open={showUpgrade} reason={upgradeReason} onClose={() => setShowUpgrade(false)} />

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden bg-[#0d0d12]">
        {/* Sidebar — independent scroll */}
        <aside className="hidden min-h-0 w-64 shrink-0 overflow-y-auto overflow-x-hidden border-r border-[#1e1e28] bg-[#0f0f12] px-6 py-6 md:block">
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            isPro={isPro}
          />
        </aside>

        {/* Feed — independent scroll */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#0d0d12] px-6 py-6 sm:px-8">
          <div className="mb-4 space-y-3">
            <div className="flex w-full items-center gap-2">
              <div className="relative w-full">
                {isPro ? (
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555566]" />
                ) : (
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555566]" />
                )}
                <Input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onFocus={handleSearchFocus}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder={isPro ? 'Search jobs, companies, or keywords...' : 'Search jobs, companies, or keywords... (Pro)'}
                  className="h-11 border-[#2a2a35] bg-[#1a1a24] pl-9 pr-9 text-[#f5f5ff] placeholder:text-white/60 focus-visible:border-indigo-500/50 focus-visible:ring-0"
                  aria-label="Search jobs, companies, or keywords"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#555566] transition-colors hover:bg-[#1e1e28] hover:text-[#aaaacc]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-white">
              {isSearching ? 'Searching...' : loading ? 'Loading…' : `${total.toLocaleString()} jobs found`}
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

          {hasMore && !loading && (
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
    </div>
  );
}
