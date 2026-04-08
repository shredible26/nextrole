import { createServerClient } from '@/lib/supabase/server';
import { GITHUB_REPO_SOURCES } from '@/lib/source-groups';
import { NextRequest, NextResponse } from 'next/server';

const FREE_PER_PAGE = 20;
const PRO_PER_PAGE  = 50;

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
  const sources     = sourcesParam ? sourcesParam.split(',').filter(Boolean) : [];
  const postedWithin = params.get('postedWithin');
  const page        = Math.max(1, Number(params.get('page') ?? 1));
  const perPage     = isPro ? PRO_PER_PAGE : FREE_PER_PAGE;

  // Free users are limited to page 1 — block deeper pagination
  if (!isPro && page > 1) {
    return NextResponse.json({
      error: 'Upgrade to see more jobs',
      upgrade: true,
    }, { status: 402 });
  }

  // Build query
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (search) {
    query = query.textSearch('fts', search, {
      type: 'websearch',
      config: 'english',
    });
  }

  if (roles.length > 0) {
    for (const role of roles) {
      query = query.contains('roles', [role]);
    }
  }
  if (remote)             query = query.eq('remote', true);
  if (level)              query = query.eq('experience_level', level);

  if (sources.length > 0) {
    if (sources.includes('github_repos')) {
      // Expand 'github_repos' group to all individual GitHub-backed sources
      const expanded = [
        ...GITHUB_REPO_SOURCES,
        ...sources.filter(s => s !== 'github_repos'),
      ];
      query = query.in('source', [...new Set(expanded)]);
    } else {
      query = query.in('source', sources);
    }
  }

  if (postedWithin) {
    const MS_MAP: Record<string, number> = {
      '1': 24 * 60 * 60 * 1000,
      '3': 3 * 24 * 60 * 60 * 1000,
      '7': 7 * 24 * 60 * 60 * 1000,
    };
    const ms = MS_MAP[postedWithin];
    if (ms) {
      const cutoff = new Date(Date.now() - ms).toISOString();
      console.log(`[jobs/route] postedWithin="${postedWithin}" → cutoff=${cutoff}`);
      query = query.gte('posted_at', cutoff);
    }
  }

  query = query
    .order('posted_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data: jobs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    jobs,
    total: count,
    page,
    perPage,
  });
}
