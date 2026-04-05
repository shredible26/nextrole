import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const FREE_DAILY_LIMIT = 20;

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('tier, jobs_viewed_today, last_reset_date')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // First sign-in — profile may not have been created yet by the auth callback.
    // Insert a minimal row and proceed with free-tier defaults.
    await supabase
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? '' });

    profile = {
      tier: 'free',
      jobs_viewed_today: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    };
  }

  // Reset daily counter if new day
  const today = new Date().toISOString().split('T')[0];
  if (profile.last_reset_date !== today) {
    await supabase
      .from('profiles')
      .update({ jobs_viewed_today: 0, last_reset_date: today })
      .eq('id', user.id);
    profile.jobs_viewed_today = 0;
  }

  const isPro = profile.tier === 'pro';
  const remaining = isPro ? Infinity : FREE_DAILY_LIMIT - profile.jobs_viewed_today;

  if (!isPro && remaining <= 0) {
    return NextResponse.json({
      error: 'Daily limit reached',
      upgrade: true,
      limit: FREE_DAILY_LIMIT,
    }, { status: 402 });
  }

  // Parse query params
  const params = req.nextUrl.searchParams;
  const rolesParam  = params.get('roles');
  const roles       = rolesParam ? rolesParam.split(',').filter(Boolean) : [];
  const remote      = params.get('remote') === 'true';
  const level       = params.get('level');
  const sourcesParam = params.get('source');
  const sources     = sourcesParam ? sourcesParam.split(',').filter(Boolean) : [];
  const postedWithin = params.get('postedWithin');
  const page        = Math.max(1, Number(params.get('page') ?? 1));
  const perPage     = isPro ? 50 : Math.min(50, remaining);

  // Build query
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (roles.length > 0)   query = query.overlaps('roles', roles);
  if (remote)             query = query.eq('remote', true);
  if (level)              query = query.eq('experience_level', level);
  if (sources.length > 0) query = query.in('source', sources);

  if (postedWithin) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(postedWithin));
    query = query.gte('posted_at', cutoff.toISOString());
  }

  const { data: jobs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment view count for free users
  if (!isPro && jobs?.length) {
    await supabase
      .from('profiles')
      .update({ jobs_viewed_today: profile.jobs_viewed_today + jobs.length })
      .eq('id', user.id);
  }

  return NextResponse.json({
    jobs,
    total: count,
    page,
    perPage,
    remaining: isPro ? null : remaining - (jobs?.length ?? 0),
  });
}
