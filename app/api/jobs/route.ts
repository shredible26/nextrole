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
const US_STATE_ABBREVS = [
  ', AL', ', AK', ', AZ', ', AR', ', CA', ', CO', ', CT', ', DE',
  ', DC', ', FL', ', GA', ', HI', ', ID', ', IL', ', IN', ', IA',
  ', KS', ', KY', ', LA', ', ME', ', MD', ', MA', ', MI', ', MN',
  ', MS', ', MO', ', MT', ', NE', ', NV', ', NH', ', NJ', ', NM',
  ', NY', ', NC', ', ND', ', OH', ', OK', ', OR', ', PA', ', RI',
  ', SC', ', SD', ', TN', ', TX', ', UT', ', VT', ', VA', ', WA',
  ', WV', ', WI', ', WY', ', PR', ', GU', ', VI', ', AS', ', MP',
];
const US_STATE_NAMES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'Puerto Rico', 'Guam',
  'Virgin Islands', 'American Samoa', 'Northern Mariana Islands',
];
const US_CITY_NAMES = [
  'New York', 'Los Angeles', 'San Francisco', 'San Jose',
  'San Diego', 'Seattle', 'Chicago', 'Boston', 'Austin',
  'Denver', 'Atlanta', 'Miami', 'Dallas', 'Houston',
  'Phoenix', 'Portland', 'Minneapolis', 'Detroit', 'Nashville',
  'Philadelphia', 'Pittsburgh', 'Baltimore', 'Washington',
  'Raleigh', 'Charlotte', 'Columbus', 'Indianapolis',
  'Salt Lake City', 'Las Vegas', 'Sacramento', 'Oakland',
  'Sunnyvale', 'Santa Clara', 'Mountain View', 'Palo Alto',
  'Menlo Park', 'Redwood City', 'San Mateo', 'Bellevue',
  'Kirkland', 'Redmond', 'Cambridge', 'Somerville',
  'New Haven', 'Hartford', 'Stamford', 'Jersey City',
  'Hoboken', 'Brooklyn', 'Manhattan', 'Queens',
];
const US_EXPLICIT = [
  'United States',
  'United States of America',
  'USA',
  'U.S.A.',
  'U.S.',
  'US ',
  ', US',
  ', USA',
  ' US,',
  'America',
  'Remote - US',
  'Remote, US',
  'US Remote',
  'Remote (US)',
  'Remote (United States)',
  'Anywhere in the US',
  'Anywhere in the USA',
];
const USA_SUBSTRING_PATTERNS = [
  ...US_EXPLICIT,
  ...US_STATE_NAMES,
  ...US_CITY_NAMES,
];
const US_STATE_ABBREV_CODES = US_STATE_ABBREVS.map(pattern => pattern.slice(2));
const USA_SUBSTRING_REGEX_SOURCE = `(${USA_SUBSTRING_PATTERNS.map(escapeRegExp).join('|')})`;
const US_STATE_ABBREV_REGEX_SOURCE =
  `,\\s(${US_STATE_ABBREV_CODES.map(escapeRegExp).join('|')})(,|\\s|\\)|/|$)`;
const USA_SUBSTRING_REGEX = new RegExp(USA_SUBSTRING_REGEX_SOURCE, 'i');
const US_STATE_ABBREV_REGEX = new RegExp(US_STATE_ABBREV_REGEX_SOURCE, 'i');
const NON_US_LOCATION_REGEXES = [
  /\bPerth,\sWA(?:$|,|\s|\)|\/)/i,
];

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

function quotePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUsaLocationOrFilter() {
  return [
    'remote.eq.true',
    'location.is.null',
    'location.eq.""',
    `location.imatch.${quotePostgrestValue(USA_SUBSTRING_REGEX_SOURCE)}`,
    `location.imatch.${quotePostgrestValue(US_STATE_ABBREV_REGEX_SOURCE)}`,
  ].join(',');
}

function isUsaJob(job: { remote?: boolean; location?: string | null }): boolean {
  if (job.remote) return true;
  const rawLocation = job.location;
  if (!rawLocation) return true;

  if (NON_US_LOCATION_REGEXES.some(regex => regex.test(rawLocation))) {
    return false;
  }

  return USA_SUBSTRING_REGEX.test(rawLocation) || US_STATE_ABBREV_REGEX.test(rawLocation);
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
  const locationFilter = params.get('location') ?? 'usa';
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

    if (locationFilter === 'usa') {
      jobs = jobs.filter(isUsaJob);
    } else if (locationFilter === 'other') {
      jobs = jobs.filter(job => !isUsaJob(job));
    }

    jobs = jobs.sort((a, b) => {
      const rankDelta = (b.rank ?? 0) - (a.rank ?? 0);
      if (rankDelta !== 0) return rankDelta;
      return new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime();
    });

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

  if (locationFilter === 'usa') {
    query = query
      .or(buildUsaLocationOrFilter())
      .not('location', 'ilike', '%Perth, WA%');
  } else if (locationFilter === 'other') {
    query = query
      .eq('remote', false)
      .not('location', 'is', null)
      .not('location', 'eq', '')
      .not('location', 'ilike', '%Remote%US%')
      .not('location', 'imatch', USA_SUBSTRING_REGEX_SOURCE)
      .not('location', 'imatch', US_STATE_ABBREV_REGEX_SOURCE);
  }

  query = query
    .order('posted_at', { ascending: false, nullsFirst: false })
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
