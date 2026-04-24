import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { GITHUB_REPO_SOURCES } from '@/lib/source-groups';
import { NextRequest, NextResponse } from 'next/server';
import { parseDescription } from '@/lib/parse-description';

const FREE_PER_PAGE = 30;
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
  'Irvine', 'Anaheim', 'Riverside', 'Fresno', 'Bakersfield',
  'Fort Worth', 'San Antonio', 'El Paso', 'Plano', 'Irving',
  'Tempe', 'Scottsdale', 'Mesa', 'Tucson', 'Chandler',
  'Gilbert', 'Flagstaff', 'Aurora', 'Fort Collins',
  'Colorado Springs', 'Boulder', 'Kansas City', 'St. Louis',
  'St Louis', 'Louisville', 'Lexington', 'Memphis',
  'Knoxville', 'Chattanooga', 'Albuquerque', 'Santa Fe',
  'Omaha', 'Lincoln', 'Richmond', 'Virginia Beach',
  'Norfolk', 'Arlington', 'Alexandria', 'Reston', 'Tysons',
  'Chantilly', 'Fairfax', 'Annapolis Junction', 'Baton Rouge',
  'New Orleans', 'Birmingham', 'Huntsville', 'Durham',
  'Winston-Salem', 'Greensboro', 'Chapel Hill',
  'Research Triangle', 'Providence', 'Burlington', 'Boise',
  'Spokane', 'Tacoma', 'Olympia', 'Eugene', 'Salem',
  'Honolulu', 'Anchorage', 'Sioux Falls', 'Fargo',
  'Des Moines', 'Madison', 'Milwaukee', 'Grand Rapids',
  'Ann Arbor', 'Lansing', 'Cleveland', 'Cincinnati',
  'Dayton', 'Toledo', 'Akron', 'Fort Wayne', 'Springfield',
  'Peoria', 'Rockford', 'Fort Meade', 'Hanover',
  'Annapolis', 'Joint Base', 'Bridgeport', 'Dublin, OH',
  'Dublin, Ohio', 'Paris, TX', 'Paris, Texas',
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
  'Remote, United States',
  'Remote United States',
  'United States Remote',
  'United States - Remote',
  'United States \u2013 Remote',
  'United States, Remote',
  'Remote in US',
  'Remote in the US',
  'Remote in United States',
  'Virtual',
  'Virtual - United States',
  'Nationwide Remote',
  'Any location in US',
  'Anywhere in the United States',
  'Remote anywhere in the US',
  'Continental United States',
  'CONUS',
  'Lower 48',
  'Flexible (US)',
  'In-office or Remote (US)',
  'Hybrid - US',
  'Hybrid - United States',
  'Hybrid Remote',
  'Remote eligible in US',
  'Remote Eligible in the US',
  'Telecommute',
  'Teleworker',
  'United States (Remote)',
  'US (Remote)',
  'Remote, Anywhere US',
  'Anywhere US',
  'US-based',
  'Must be located in the US',
  'Must be based in the US',
  'US candidates only',
];
const WORKDAY_MULTI_LOCATION_REGEX = /^\d+ Locations?$/i;
const WORKDAY_US_PREFIX_REGEX = /^US[,\s]/i;
const REMOTE_US_PATTERNS = [
  'Remote (Any State)',
  'Remote/Teleworker US',
  'Teleworker US',
  'USA - Remote',
  'Remote - USA',
  'US - Remote',
  'Remote - US',
  '100% Remote',
  'Work From Home',
  'WFH',
  'Telework',
  'Virtual - US',
  'Virtual US',
  'Anywhere in US',
  'Nationwide',
  'Remote - United States',
  'Remote | United States',
  'Remote in the US',
  'Remote within US',
  'Remote within the US',
  'Hybrid - US',
  'Hybrid (US)',
  'Hybrid Remote',
  'Telecommute',
  'Virtual - United States',
  'Continental United States',
  'CONUS',
  'Virtual',
];
const USA_LOCATION_ILIKE_PATTERNS = [
  '% Locations',
  '1 Location',
  'US,_%',
  'US %',
  '%Remote%US%',
  '%Teleworker US%',
  '%USA - Remote%',
  '%Remote - USA%',
  '%100% Remote%',
  '%Work From Home%',
  '%Telework%',
  '%Nationwide%',
  '%Remote (Any State)%',
  '%WFH%',
  '%Virtual - US%',
  '%Virtual US%',
  '%Anywhere in US%',
  '%CONUS%',
  '%Continental United States%',
  '%Remote in US%',
  '%Remote within US%',
  '%US-based%',
  '%Virtual - United States%',
  '%Telecommute%',
  '%Hybrid - US%',
  '%Hybrid (US)%',
  '%United States \u2013 Remote%',
  '%United States - Remote%',
  '%Virtual%',
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
const NON_US_COUNTRY_PATTERNS = [
  'Germany', 'Austria', 'Switzerland', 'Netherlands', 'France', 'Spain',
  'Italy', 'Poland', 'Portugal', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Belgium', 'Czech Republic', 'Romania', 'Hungary', 'Ireland',
  'United Kingdom', 'UK', 'Canada', 'Australia', 'India', 'Singapore',
  'Brazil', 'Mexico', 'Japan', 'China', 'South Korea',
  'Israel', 'United Arab Emirates', 'UAE', 'Saudi Arabia', 'Qatar',
  'Turkey', 'South Africa', 'New Zealand', 'Argentina', 'Colombia',
  'Chile', 'Peru', 'Pakistan', 'Bangladesh', 'Philippines', 'Malaysia',
  'Indonesia', 'Thailand', 'Vietnam', 'Taiwan', 'Ukraine', 'Russia',
  'Greece', 'Ontario', 'Quebec', 'British Columbia', 'Alberta',
  'Saskatchewan', 'Manitoba', 'Nova Scotia', 'New Brunswick',
];
const NON_US_CITY_PATTERNS = [
  'Berlin', 'Munich', 'M\u00fcnchen', 'Hamburg', 'Frankfurt', 'Cologne',
  'K\u00f6ln', 'Stuttgart', 'D\u00fcsseldorf', 'Dortmund', 'Leipzig',
  'Dresden', 'Nuremberg', 'N\u00fcrnberg', 'Hanover, Germany', 'Hannover',
  'Bremen', 'Bochum', 'Wuppertal', 'Bonn', 'Mannheim', 'Karlsruhe',
  'Augsburg', 'Wiesbaden', 'M\u00f6nchengladbach', 'Gelsenkirchen',
  'Aachen', 'Kiel', 'Freiburg', 'Erfurt', 'Mainz', 'Rostock', 'Kassel',
  'Halle', 'Magdeburg', 'Saarbr\u00fccken', 'Potsdam', 'L\u00fcbeck',
  'Oldenburg', 'Osnabr\u00fcck', 'Heidelberg', 'Darmstadt', 'Regensburg',
  'Ingolstadt', 'W\u00fcrzburg', 'Amsterdam', 'Rotterdam', 'Utrecht',
  'The Hague', 'Eindhoven', 'Vienna', 'Wien', 'Zurich', 'Z\u00fcrich',
  'Basel', 'Geneva', 'Genf', 'Bern', 'Paris, France', 'Lyon', 'Marseille',
  'Barcelona', 'Madrid', 'Milan', 'Milano', 'Rome', 'Roma', 'Warsaw',
  'Warszawa', 'Prague', 'Praha', 'Budapest', 'Bucharest', 'Stockholm',
  'Oslo', 'Copenhagen', 'Helsinki', 'Brussels', 'Bruxelles', 'Dublin, Ireland',
  'Lisbon', 'Lisboa', 'Athens', 'London', 'Manchester',
  'Leeds', 'Glasgow', 'Edinburgh', 'Bristol', 'Liverpool', 'Sheffield',
  'Newcastle', 'Toronto', 'Vancouver', 'Calgary', 'Ottawa', 'Montreal',
  'Edmonton', 'Winnipeg', 'Hamilton, ON', 'Hamilton, Ontario',
  'Victoria, BC', 'Victoria, British Columbia', 'Sydney', 'Melbourne',
  'Brisbane', 'Adelaide', 'Canberra', 'Bangalore', 'Bengaluru',
  'Mumbai', 'Hyderabad', 'Pune', 'Chennai', 'Gurgaon', 'Noida',
  'New Delhi', 'Tel Aviv', 'Ramat Gan', 'Herzliya', 'Dubai',
  'Abu Dhabi', 'Riyadh', 'Doha', 'Tokyo', 'Osaka', 'Beijing',
  'Shanghai', 'Shenzhen', 'Seoul', 'Busan', 'Taipei', 'Hsinchu',
  'Tbilisi', 'Birmingham, UK', 'Birmingham, England', 'Cambridge, UK',
  'Cambridge, England', 'London, Ontario', 'London, Canada',
  'S\u00e3o Paulo', 'Sao Paulo', 'Mexico City', 'Guadalajara',
  'Monterrey', 'Buenos Aires', 'Bogot\u00e1', 'Bogota', 'Santiago',
];
const NON_US_SUFFIX_CODES = [
  'DE', 'AT', 'CH', 'NL', 'FR', 'ES', 'IT', 'PL', 'PT', 'SE', 'NO',
  'DK', 'FI', 'BE', 'CZ', 'RO', 'HU', 'IE', 'GB', 'UK', 'CA', 'AU',
  'IN', 'SG', 'BR', 'MX', 'JP', 'CN', 'KR',
];
const NON_US_COUNTRY_REGEX_SOURCE =
  `(^|[^A-Za-z])(${NON_US_COUNTRY_PATTERNS.map(escapeRegExp).join('|')})(?=$|[^A-Za-z])`;
const NON_US_CITY_REGEX_SOURCE =
  `(^|[,(/-]\\s*)(${NON_US_CITY_PATTERNS.map(escapeRegExp).join('|')})(?=$|\\s*[,)/-])`;
const NON_US_SUFFIX_REGEX_SOURCE =
  `,\\s(${NON_US_SUFFIX_CODES.map(escapeRegExp).join('|')})(,|\\s|\\)|/|$)`;
const NON_US_LOCATION_REGEXES = [
  new RegExp(NON_US_COUNTRY_REGEX_SOURCE, 'i'),
  new RegExp(NON_US_CITY_REGEX_SOURCE, 'i'),
  new RegExp(NON_US_SUFFIX_REGEX_SOURCE, 'i'),
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

type SupabaseErrorLike = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseErrorLike | null;
  count?: number | null;
};

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

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

function buildPostgrestCondition(column: string, operator: string, value: string) {
  return `${column}.${operator}.${quotePostgrestValue(value)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toCardSnippet(raw: string | null | undefined): string {
  if (!raw) return '';
  const parsed = parseDescription(raw);
  const plain = parsed
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 200 ? plain.slice(0, 200) + '...' : plain;
}

function looksLikeHtml(value: string) {
  return /<!doctype html|<html|<body|<head|Cloudflare Ray ID/i.test(value);
}

function compactErrorMessage(value?: string | null) {
  if (!value) return '';

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRetryableSupabaseError(error?: SupabaseErrorLike | null) {
  const combined = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    looksLikeHtml(combined) ||
    /(^|[^0-9])(502|503|504)([^0-9]|$)/.test(combined) ||
    combined.includes('bad gateway') ||
    combined.includes('service unavailable') ||
    combined.includes('gateway timeout') ||
    combined.includes('cloudflare') ||
    combined.includes('cf-ray') ||
    combined.includes('upstream') ||
    combined.includes('fetch failed') ||
    combined.includes('connection terminated') ||
    combined.includes('timed out')
  );
}

function toPublicSupabaseError(error?: SupabaseErrorLike | null) {
  const message = compactErrorMessage(
    [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  );

  if (!message || looksLikeHtml(message) || isRetryableSupabaseError(error)) {
    return 'Jobs service temporarily unavailable. Please try again.';
  }

  return message;
}

function logSupabaseError(label: string, error?: SupabaseErrorLike | null) {
  if (!error) return;

  console.error(`[jobs/route] ${label}`, {
    code: error.code ?? null,
    message: compactErrorMessage(error.message).slice(0, 300),
    details: compactErrorMessage(error.details).slice(0, 300),
    hint: compactErrorMessage(error.hint).slice(0, 300),
  });
}

async function withSupabaseRetry<T extends SupabaseResult<unknown>>(
  label: string,
  operation: () => PromiseLike<T>,
  maxAttempts = 2
): Promise<T> {
  let lastResult: T | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await operation();
    lastResult = result;

    if (!result.error) {
      return result;
    }

    if (!isRetryableSupabaseError(result.error) || attempt === maxAttempts) {
      return result;
    }

    logSupabaseError(`${label} failed on attempt ${attempt}, retrying`, result.error);
    await delay(attempt * 250);
  }

  return lastResult as T;
}

function buildUsaLocationOrFilter() {
  return [
    'remote.eq.true',
    'location.is.null',
    buildPostgrestCondition('location', 'eq', ''),
    ...USA_LOCATION_ILIKE_PATTERNS.map(pattern =>
      buildPostgrestCondition('location', 'ilike', pattern)
    ),
    buildPostgrestCondition('location', 'imatch', USA_SUBSTRING_REGEX_SOURCE),
    buildPostgrestCondition('location', 'imatch', US_STATE_ABBREV_REGEX_SOURCE),
  ].join(',');
}

function isNonUSLocation(location: string): boolean {
  const loc = location.trim();

  if (!loc) return false;

  return NON_US_LOCATION_REGEXES.some(regex => regex.test(loc));
}

function isUsaJob(job: { remote?: boolean; location?: string | null }): boolean {
  const rawLocation = job.location;
  const loc = rawLocation?.trim() ?? '';

  if (loc && isNonUSLocation(loc)) {
    return false;
  }

  if (job.remote) return true;
  if (!rawLocation) return true;
  if (WORKDAY_MULTI_LOCATION_REGEX.test(loc)) return true;
  if (WORKDAY_US_PREFIX_REGEX.test(loc)) return true;
  if (REMOTE_US_PATTERNS.some(pattern =>
    loc.toLowerCase().includes(pattern.toLowerCase())
  )) return true;
  if (
    loc.toLowerCase().includes('hybrid') &&
    (USA_SUBSTRING_REGEX.test(loc) || US_STATE_ABBREV_REGEX.test(loc))
  ) return true;

  return USA_SUBSTRING_REGEX.test(loc) || US_STATE_ABBREV_REGEX.test(loc);
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const admin = createAdminClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logSupabaseError('auth.getUser failed', { message: authError.message });
    return NextResponse.json(
      {
        error: 'Authentication service temporarily unavailable. Please refresh and try again.',
        retryable: true,
      },
      { status: 503 }
    );
  }

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only need tier — no more daily counter reads or writes
  const profileResult = await withSupabaseRetry<SupabaseResult<{ tier: string }>>(
    'profile lookup',
    () =>
      admin
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .maybeSingle()
  );
  let profile = profileResult.data;

  if (!profile) {
    if (profileResult.error) {
      logSupabaseError('profile lookup failed, defaulting to free tier', profileResult.error);
    } else {
      // First sign-in — profile may not have been created yet by the auth callback.
      const insertResult = await withSupabaseRetry<SupabaseResult<null>>(
        'profile insert',
        () =>
          admin
            .from('profiles')
            .insert({ id: user.id, email: user.email ?? '' })
      );

      if (insertResult.error) {
        logSupabaseError('profile insert failed, defaulting to free tier', insertResult.error);
      }
    }

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

  const searchParam = params.get('search')?.trim();
  if (searchParam && profile.tier === 'free') {
    return Response.json({ error: 'Pro required', upgrade: true }, { status: 402 });
  }

  if (cutoffIso) {
    console.log(`[jobs/route] postedWithin="${postedWithin}" → cutoff=${cutoffIso}`);
  }

  if (search) {
    const searchResult = await withSupabaseRetry<SupabaseResult<RankedJob[]>>(
      'search_jobs_ranked',
      () =>
        admin.rpc('search_jobs_ranked', {
          search_query: search,
          is_active_filter: true,
        })
    );

    if (searchResult.error) {
      logSupabaseError('search_jobs_ranked failed', searchResult.error);
      return NextResponse.json(
        {
          error: toPublicSupabaseError(searchResult.error),
          retryable: isRetryableSupabaseError(searchResult.error),
        },
        { status: isRetryableSupabaseError(searchResult.error) ? 503 : 500 }
      );
    }

    let jobs = (searchResult.data ?? []) as RankedJob[];

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
      .map(job => {
        const { rank: _rank, ...rest } = job;
        return { ...rest, description: toCardSnippet(rest.description) };
      });

    return NextResponse.json({
      jobs: pagedJobs,
      total: jobs.length,
      page,
      perPage,
    });
  }

  const runJobsQuery = (countMode: 'exact' | 'planned') => {
    let query = admin
      .from('jobs')
      .select('*', { count: countMode })
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
        .not('location', 'eq', '');

      for (const pattern of USA_LOCATION_ILIKE_PATTERNS) {
        query = query.not('location', 'ilike', pattern);
      }

      query = query
        .not('location', 'imatch', USA_SUBSTRING_REGEX_SOURCE)
        .not('location', 'imatch', US_STATE_ABBREV_REGEX_SOURCE);
    }

    return query
      .order('posted_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + perPage - 1);
  };

  let jobsResult = await withSupabaseRetry<SupabaseResult<Record<string, unknown>[]>>(
    'jobs query (planned count)',
    () => runJobsQuery('planned')
  );

  if (jobsResult.error) {
    logSupabaseError('jobs query failed', jobsResult.error);
    return NextResponse.json(
      {
        error: toPublicSupabaseError(jobsResult.error),
        retryable: isRetryableSupabaseError(jobsResult.error),
      },
      { status: isRetryableSupabaseError(jobsResult.error) ? 503 : 500 }
    );
  }

  return NextResponse.json({
    jobs: (jobsResult.data ?? []).map(job => ({
      ...job,
      description: toCardSnippet(job.description as string | null | undefined),
    })),
    total: jobsResult.count ?? 0,
    page,
    perPage,
  });
}
