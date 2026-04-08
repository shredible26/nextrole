import { createServerClient } from '@/lib/supabase/server';
import { GITHUB_REPO_SOURCES } from '@/lib/source-groups';
import { NextRequest, NextResponse } from 'next/server';

const FREE_PER_PAGE = 20;
const PRO_PER_PAGE = 50;
const POSTED_WITHIN_MS: Record<string, number> = {
  '1': 24 * 60 * 60 * 1000,
  '3': 3 * 24 * 60 * 60 * 1000,
  '7': 7 * 24 * 60 * 60 * 1000,
};

type RankedJob = {
  id: string;
  source: string;
  source_id: string | null;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  experience_level: string;
  roles: string[];
  posted_at: string | null;
  scraped_at: string | null;
  is_active: boolean;
  dedup_hash: string;
  rank: number | null;
};

function expandSources(sources: string[]) {
  if (!sources.includes('github_repos')) return sources;

  return [...new Set([
    ...GITHUB_REPO_SOURCES,
    ...sources.filter(source => source !== 'github_repos'),
  ])];
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only need tier — no more daily counter reads or writes
  let { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // First sign-in — profile may not have been created yet by the auth callback.
    await supabase
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? '' });

    profile = { tier: 'free' };
  }

  const isPro = profile.tier === 'pro';

  // Parse query params
  const url = req.nextUrl;
  const params      = url.searchParams;
  const rolesParam  = params.get('roles');
  const search      = url.searchParams.get('search')?.trim() ?? '';
  // Strip 'all' — it means no filter
  const roles       = rolesParam
    ? rolesParam
        .split(',')
        .map(role => role.trim().toLowerCase())
        .filter(role => role && role !== 'all')
    : [];
  const remote      = params.get('remote') === 'true';
  const level       = params.get('level');
  const sourcesParam = params.get('source');
  const sources = sourcesParam ? sourcesParam.split(',').filter(Boolean) : [];
  const postedWithin = params.get('postedWithin');
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const perPage = isPro ? PRO_PER_PAGE : FREE_PER_PAGE;
  const offset = (page - 1) * perPage;
  const expandedSources = expandSources(sources);
  const cutoffMs = postedWithin ? POSTED_WITHIN_MS[postedWithin] : undefined;
  const cutoffIso = cutoffMs ? new Date(Date.now() - cutoffMs).toISOString() : null;

  // Free users are limited to page 1 — block deeper pagination
  if (!isPro && page > 1) {
    return NextResponse.json({
      error: 'Upgrade to see more jobs',
      upgrade: true,
    }, { status: 402 });
  }

  if (cutoffIso) {
    console.log(`[jobs/route] postedWithin="${postedWithin}" → cutoff=${cutoffIso}`);
  }

  if (search) {
    const { data, error } = await supabase.rpc('search_jobs_ranked', {
      search_query: search,
      is_active_filter: true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let jobs = (data ?? []) as RankedJob[];

    if (roles.length > 0) {
      jobs = jobs.filter(job => roles.every(role => job.roles?.includes(role) ?? false));
    }
    if (remote) jobs = jobs.filter(job => job.remote === true);
    if (level) jobs = jobs.filter(job => job.experience_level === level);

    if (expandedSources.length > 0) {
      const sourceSet = new Set(expandedSources);
      jobs = jobs.filter(job => sourceSet.has(job.source));
    }

    if (cutoffIso) {
      jobs = jobs.filter(job => job.posted_at && job.posted_at >= cutoffIso);
    }

    const pagedJobs = jobs
      .slice(offset, offset + perPage)
      .map(({ rank, ...job }) => job);

    return NextResponse.json({
      jobs: pagedJobs,
      total: jobs.length,
      page,
      perPage,
    });
  }

  // Build query
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (roles.length > 0) {
    for (const role of roles) {
      query = query.contains('roles', [role]);
    }
  }
  if (remote)             query = query.eq('remote', true);
  if (level)              query = query.eq('experience_level', level);

  if (expandedSources.length > 0) {
    query = query.in('source', expandedSources);
  }

  if (cutoffIso) {
    query = query.gte('posted_at', cutoffIso);
  }

  query = query
    .order('posted_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  const { data: jobs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    jobs,
    total: count ?? 0,
    page,
    perPage,
  });
}
