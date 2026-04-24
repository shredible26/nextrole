'use client';

import { type FocusEvent, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import FilterSidebar from './FilterSidebar';
import JobCard from './JobCard';
import UpgradeModal from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Job, JobFilters } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTrackedIds, addTrackedId, removeTrackedId, writeTrackedIds } from '@/lib/trackedStorage';
import { Loader2, Lock, Search, SlidersHorizontal, X } from 'lucide-react';

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
const FEED_SNAPSHOT_KEY = 'nextrole.jobs.feed-snapshot';
const FEED_RESTORE_KEY = 'nextrole.jobs.restore-feed';

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

type MatchScore = { grade: string; similarity: number };

interface FeedResponse {
  jobs: Job[];
  total: number;
  page: number;
  perPage: number;
  error?: string;
  upgrade?: boolean;
  retryable?: boolean;
}

interface ApplyResponse {
  success?: boolean;
  error?: string;
  upgrade?: boolean;
  reason?: 'tracker';
}

interface FeedSnapshot {
  version: 1;
  hasFetched: boolean;
  filters: JobFilters;
  jobs: Job[];
  total: number;
  hasMore: boolean;
  searchInput: string;
  sortBy: 'default' | 'best_match';
  matchScores: Record<string, MatchScore>;
  isPro: boolean;
  showResumePrompt: boolean;
  resumePromptDismissed: boolean;
  showGrades: boolean;
  scrollTop: number;
  sidebarScrollTop: number;
}

function looksLikeHtml(value: string) {
  return /<!doctype html|<html|<body|<head|Cloudflare Ray ID/i.test(value);
}

function normalizeFeedErrorMessage(value?: string) {
  if (!value) return 'Jobs service temporarily unavailable. Please try again.';
  if (looksLikeHtml(value)) return 'Jobs service temporarily unavailable. Please try again.';

  const lower = value.toLowerCase();
  if (
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout') ||
    lower.includes('cloudflare') ||
    lower.includes('upstream')
  ) {
    return 'Jobs service temporarily unavailable. Please try again.';
  }

  return value;
}

function hasFeedRestorePending() {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(FEED_RESTORE_KEY) === '1';
}

function markFeedForRestore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(FEED_RESTORE_KEY, '1');
}

function clearFeedRestoreFlag() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(FEED_RESTORE_KEY);
}

function isSnapshotFilters(value: unknown): value is JobFilters {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<JobFilters>;
  return (
    Array.isArray(candidate.roles) &&
    typeof candidate.search === 'string' &&
    typeof candidate.level === 'string' &&
    typeof candidate.remote === 'boolean' &&
    typeof candidate.location === 'string' &&
    typeof candidate.postedWithin === 'string' &&
    Array.isArray(candidate.sources) &&
    typeof candidate.page === 'number'
  );
}

function readFeedSnapshot(): FeedSnapshot | null {
  if (!hasFeedRestorePending()) return null;

  try {
    const raw = window.sessionStorage.getItem(FEED_SNAPSHOT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FeedSnapshot> | null;
    if (!parsed || parsed.version !== 1 || !parsed.hasFetched || !isSnapshotFilters(parsed.filters)) {
      return null;
    }
    if (!Array.isArray(parsed.jobs) || typeof parsed.total !== 'number' || typeof parsed.hasMore !== 'boolean') {
      return null;
    }
    if (typeof parsed.searchInput !== 'string' || (parsed.sortBy !== 'default' && parsed.sortBy !== 'best_match')) {
      return null;
    }
    if (!parsed.matchScores || typeof parsed.matchScores !== 'object') {
      return null;
    }

    return {
      version: 1,
      hasFetched: true,
      filters: parsed.filters,
      jobs: parsed.jobs,
      total: parsed.total,
      hasMore: parsed.hasMore,
      searchInput: parsed.searchInput,
      sortBy: parsed.sortBy,
      matchScores: parsed.matchScores as Record<string, MatchScore>,
      isPro: typeof parsed.isPro === 'boolean' ? parsed.isPro : false,
      showResumePrompt: typeof parsed.showResumePrompt === 'boolean' ? parsed.showResumePrompt : false,
      resumePromptDismissed: typeof parsed.resumePromptDismissed === 'boolean' ? parsed.resumePromptDismissed : false,
      showGrades: typeof parsed.showGrades === 'boolean' ? parsed.showGrades : true,
      scrollTop: typeof parsed.scrollTop === 'number' ? parsed.scrollTop : 0,
      sidebarScrollTop: typeof parsed.sidebarScrollTop === 'number' ? parsed.sidebarScrollTop : 0,
    };
  } catch {
    return null;
  }
}

function writeFeedSnapshot(snapshot: FeedSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(FEED_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage write failures.
  }
}

export default function JobFeed() {
  const supabase = createClient();
  const pathname = usePathname();
  const initialSnapshotRef = useRef<FeedSnapshot | null>(null);
  if (typeof window !== 'undefined' && initialSnapshotRef.current === null) {
    initialSnapshotRef.current = readFeedSnapshot();
  }
  const initialSnapshot = initialSnapshotRef.current;
  const [filters, setFilters] = useState<JobFilters>(initialSnapshot?.filters ?? DEFAULT_FILTERS);
  const [jobs, setJobs] = useState<Job[]>(initialSnapshot?.jobs ?? []);
  const [total, setTotal] = useState(initialSnapshot?.total ?? 0);
  const [loading, setLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(initialSnapshot?.searchInput ?? '');
  // Seed from localStorage immediately so cards render correct state before Supabase resolves
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => getTrackedIds());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'search' | 'pagination' | 'tracker'>('pagination');
  const [hasMore, setHasMore] = useState(initialSnapshot?.hasMore ?? false);
  const [isPro, setIsPro] = useState(initialSnapshot?.isPro ?? false);
  const [matchScores, setMatchScores] = useState<Record<string, MatchScore>>(initialSnapshot?.matchScores ?? {});
  const [showResumePrompt, setShowResumePrompt] = useState(initialSnapshot?.showResumePrompt ?? false);
  const [resumePromptDismissed, setResumePromptDismissed] = useState(initialSnapshot?.resumePromptDismissed ?? false);
  const [sortBy, setSortBy] = useState<'default' | 'best_match'>(initialSnapshot?.sortBy ?? 'default');
  const [showGrades, setShowGrades] = useState<boolean>(initialSnapshot?.showGrades ?? true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const requestIdRef = useRef(0);
  const jobsRef = useRef<Job[]>(initialSnapshot?.jobs ?? []);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoredJobIdsRef = useRef<Set<string>>(new Set(Object.keys(initialSnapshot?.matchScores ?? {})));
  const hasFetchedRef = useRef(Boolean(initialSnapshot?.hasFetched));
  const skipInitialFetchRef = useRef(Boolean(initialSnapshot?.hasFetched));
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const feedScrollTopRef = useRef(initialSnapshot?.scrollTop ?? 0);
  const sidebarScrollTopRef = useRef(initialSnapshot?.sidebarScrollTop ?? 0);
  const snapshotStateRef = useRef({
    filters: initialSnapshot?.filters ?? DEFAULT_FILTERS,
    jobs: initialSnapshot?.jobs ?? [],
    total: initialSnapshot?.total ?? 0,
    hasMore: initialSnapshot?.hasMore ?? false,
    searchInput: initialSnapshot?.searchInput ?? '',
    sortBy: (initialSnapshot?.sortBy ?? 'default') as 'default' | 'best_match',
    matchScores: initialSnapshot?.matchScores ?? {},
    isPro: initialSnapshot?.isPro ?? false,
    showResumePrompt: initialSnapshot?.showResumePrompt ?? false,
    resumePromptDismissed: initialSnapshot?.resumePromptDismissed ?? false,
    showGrades: initialSnapshot?.showGrades ?? true,
  });

  const persistFeedState = useCallback(() => {
    if (!hasFetchedRef.current) return;

    writeFeedSnapshot({
      version: 1,
      hasFetched: true,
      filters: snapshotStateRef.current.filters,
      jobs: snapshotStateRef.current.jobs,
      total: snapshotStateRef.current.total,
      hasMore: snapshotStateRef.current.hasMore,
      searchInput: snapshotStateRef.current.searchInput,
      sortBy: snapshotStateRef.current.sortBy,
      matchScores: snapshotStateRef.current.matchScores,
      isPro: snapshotStateRef.current.isPro,
      showResumePrompt: snapshotStateRef.current.showResumePrompt,
      resumePromptDismissed: snapshotStateRef.current.resumePromptDismissed,
      showGrades: snapshotStateRef.current.showGrades,
      scrollTop: feedContainerRef.current?.scrollTop ?? feedScrollTopRef.current,
      sidebarScrollTop: sidebarContainerRef.current?.scrollTop ?? sidebarScrollTopRef.current,
    });
  }, []);

  useEffect(() => {
    snapshotStateRef.current = {
      filters,
      jobs,
      total,
      hasMore,
      searchInput,
      sortBy,
      matchScores,
      isPro,
      showResumePrompt,
      resumePromptDismissed,
      showGrades,
    };

    persistFeedState();
  }, [
    filters,
    jobs,
    total,
    hasMore,
    searchInput,
    sortBy,
    matchScores,
    isPro,
    showResumePrompt,
    resumePromptDismissed,
    showGrades,
    persistFeedState,
  ]);

  useEffect(() => {
    if (!hasFeedRestorePending()) return;

    if (!initialSnapshot) {
      clearFeedRestoreFlag();
      return;
    }

    clearFeedRestoreFlag();

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = initialSnapshot.scrollTop;
        }
        if (sidebarContainerRef.current) {
          sidebarContainerRef.current.scrollTop = initialSnapshot.sidebarScrollTop;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [initialSnapshot]);

  useEffect(() => {
    window.addEventListener('pagehide', persistFeedState);
    return () => window.removeEventListener('pagehide', persistFeedState);
  }, [persistFeedState]);

  // Body scroll lock when mobile filter sheet open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileFiltersOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [mobileFiltersOpen]);

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
    if (append) {
      setLoadingMore(true);
    } else if (jobsRef.current.length === 0) {
      setLoading(true);
    } else {
      setIsRefetching(true);
    }
    try {
      let lastError = 'Failed to load jobs. Please try again.';

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const res = await fetch(`/api/jobs?${buildQuery(f)}`, { cache: 'no-store' });
        const contentType = res.headers.get('content-type') ?? '';
        let data: FeedResponse;

        if (contentType.includes('application/json')) {
          data = await res.json() as FeedResponse;
        } else {
          const text = await res.text();
          data = {
            jobs: [],
            total: 0,
            page: f.page,
            perPage: 0,
            error: normalizeFeedErrorMessage(text),
            retryable: res.status >= 500 || looksLikeHtml(text),
          };
        }

        if (requestId !== requestIdRef.current) return;

        if (data.error) {
          data.error = normalizeFeedErrorMessage(data.error);
          lastError = data.error;
        }

        const shouldRetry = Boolean(data.retryable || res.status >= 500) && attempt < 2;
        if (shouldRetry) {
          await new Promise(resolve => window.setTimeout(resolve, attempt * 400));
          if (requestId !== requestIdRef.current) return;
          continue;
        }

        if (data.upgrade) {
          setUpgradeReason('pagination');
          setShowUpgrade(true);
          return;
        }
        if (data.error) {
          toast.error(data.error);
          return;
        }

        const newJobs = data.jobs ?? [];
        if (append) {
          setJobs(prev => {
            const next = [...prev, ...newJobs];
            jobsRef.current = next;
            return next;
          });
        } else {
          scoredJobIdsRef.current = new Set();
          setMatchScores({});
          setJobs(() => {
            jobsRef.current = newJobs;
            return newJobs;
          });
        }
        hasFetchedRef.current = true;
        setTotal(data.total ?? 0);
        setHasMore((data.jobs?.length ?? 0) === data.perPage && data.total > f.page * data.perPage);

        return;
      }

      toast.error(lastError);
    } catch {
      if (requestId !== requestIdRef.current) return;
      toast.error('Failed to load jobs. Please try again.');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setIsRefetching(false);
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
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }

    const nextFilters = filters.page === 1 ? filters : { ...filters, page: 1 };

    if (nextFilters !== filters) {
      setFilters(nextFilters);
    }

    fetchJobs(nextFilters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.roles.join(), filters.search, filters.level, filters.remote, filters.location, filters.postedWithin, filters.sources.join()]);

  // Fetch match scores whenever jobs change.
  // Only sends IDs not yet scored to avoid re-scoring jobs already in matchScores.
  useEffect(() => {
    if (jobs.length === 0) return;
    const unseenIds = jobs.map(j => j.id).filter(id => !scoredJobIdsRef.current.has(id));
    if (unseenIds.length === 0) return;
    fetch('/api/jobs/match-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: unseenIds }),
    })
      .then(r => r.json())
      .then((result: { scores?: Record<string, { grade: string; similarity: number }>; noResume?: boolean }) => {
        unseenIds.forEach(id => scoredJobIdsRef.current.add(id));
        if (result.noResume) {
          setShowResumePrompt(true);
        } else if (result.scores) {
          setMatchScores(prev => ({ ...prev, ...result.scores }));
        }
      })
      .catch(() => { /* non-blocking */ });
  }, [jobs]);

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

  function handleOpenJob() {
    markFeedForRestore();
    persistFeedState();
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
  const showBlockingLoader = loading && jobs.length === 0;

  const activeFilterCount =
    (filters.roles.length > 0 ? 1 : 0) +
    (filters.level !== '' ? 1 : 0) +
    (filters.remote ? 1 : 0) +
    (filters.location !== 'usa' ? 1 : 0) +
    (filters.postedWithin !== '' ? 1 : 0) +
    (filters.sources.length > 0 ? 1 : 0);

  function handleClearAllFilters() {
    setSearchInput('');
    setFilters({ ...DEFAULT_FILTERS });
  }

  return (
    <div className="flex flex-1 flex-col bg-[#0d0d12] md:min-h-0 md:overflow-hidden">
      <UpgradeModal open={showUpgrade} reason={upgradeReason} onClose={() => setShowUpgrade(false)} />

      {/* Mobile filter bottom sheet */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#0f0f12] shadow-2xl"
          >
            <div className="mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-[#2a2a35]" />
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-base font-semibold text-white">Filters</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="rounded-md px-3 py-1.5 text-sm text-[#aaaacc] transition-colors hover:bg-[#1a1a24] hover:text-white"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#aaaacc] transition-colors hover:bg-[#1a1a24] hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-5 pb-4">
              <FilterSidebar filters={filters} onChange={handleFilterChange} isPro={isPro} />
            </div>
            <div className="sticky bottom-0 border-t border-[#1e1e28] bg-[#0f0f12] px-5 py-4">
              <Button
                onClick={() => setMobileFiltersOpen(false)}
                disabled={loading || isRefetching}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-base font-semibold text-white hover:from-indigo-400 hover:to-violet-400"
              >
                {isRefetching || loading ? 'Loading…' : `Show ${total.toLocaleString()} job${total === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-col bg-[#0d0d12] md:h-[calc(100vh-57px)] md:min-h-0 md:flex-row md:overflow-hidden">
        {/* Sidebar — independent scroll */}
        <div
          ref={sidebarContainerRef}
          className="hidden min-h-0 w-64 shrink-0 overflow-y-auto overflow-x-hidden border-r border-[#1e1e28] bg-[#0f0f12] px-6 py-6 md:block"
          onScrollCapture={e => e.stopPropagation()}
          onScroll={e => {
            sidebarScrollTopRef.current = e.currentTarget.scrollTop;
          }}
          style={{ scrollBehavior: 'auto' }}
        >
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            isPro={isPro}
          />
        </div>

        {/* Feed — independent scroll on desktop, natural page scroll on mobile */}
        <div
          ref={feedContainerRef}
          className="flex min-w-0 flex-1 flex-col bg-[#0d0d12] px-4 py-4 sm:px-8 sm:py-6 md:min-h-0 md:overflow-y-auto"
          onScroll={e => {
            feedScrollTopRef.current = e.currentTarget.scrollTop;
          }}
        >
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

            {/* Mobile-only Filters trigger */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a35] bg-[#1a1a24] px-4 text-sm font-medium text-white transition-colors hover:bg-[#22222e]"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white">
                {isSearching ? 'Searching...' : (loading || isRefetching) ? 'Loading…' : `${total.toLocaleString()} jobs found`}
              </p>
              {Object.keys(matchScores).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <label
                    className="group flex cursor-pointer items-center gap-2 rounded-md border border-[#2a2a35] bg-[#1a1a24] px-2.5 py-1 text-xs text-[#d8d9e6] transition-colors hover:border-[#3a3a45]"
                    title={showGrades ? 'Hide match grades' : 'Show match grades'}
                  >
                    <span className="select-none font-medium">Show grades</span>
                    <Switch
                      size="sm"
                      checked={showGrades}
                      onCheckedChange={setShowGrades}
                      className="data-checked:bg-indigo-500"
                      aria-label="Toggle match grades"
                    />
                  </label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'default' | 'best_match')}
                    className="h-7 rounded-md border border-[#2a2a35] bg-[#1a1a24] px-2 text-xs text-[#f0f0fa] focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="default">Sort: Latest</option>
                    <option value="best_match">Sort: Best Match</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Resume prompt banner */}
          {showResumePrompt && !resumePromptDismissed && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#2a2a35] bg-[#1a1a24] px-4 py-2.5 text-sm text-[#aaaacc]">
              <span>Upload your resume on the <a href="/profile" className="text-indigo-400 hover:underline">Profile page</a> to see AI match scores for each job</span>
              <button
                onClick={() => setResumePromptDismissed(true)}
                className="shrink-0 text-[#555566] hover:text-[#aaaacc] transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {showBlockingLoader ? (
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
              {[...jobs]
                .sort((a, b) => {
                  if (sortBy !== 'best_match') return 0;
                  const gradeA = GRADE_ORDER[matchScores[a.id]?.grade ?? ''] ?? 99;
                  const gradeB = GRADE_ORDER[matchScores[b.id]?.grade ?? ''] ?? 99;
                  if (gradeA !== gradeB) return gradeA - gradeB;
                  return new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime();
                })
                .map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    tracked={trackedIds.has(job.id)}
                    onTrack={handleTrack}
                    onOpen={handleOpenJob}
                    fromUrl={pathname}
                    matchScore={matchScores[job.id]}
                    showGrade={showGrades}
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
                className="w-full sm:w-auto sm:min-w-32"
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
