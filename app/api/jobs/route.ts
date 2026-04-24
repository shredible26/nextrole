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
const US_STATE_AND_DC_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA',
  'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];
const US_STATE_AND_DC_CODE_LOOKUP = new Set(US_STATE_AND_DC_CODES);
const US_TERRITORY_CODES = ['PR', 'GU', 'VI', 'AS', 'MP'];
const US_LOCATION_SUFFIX_CODES = [...US_STATE_AND_DC_CODES, ...US_TERRITORY_CODES];
const CANADIAN_PROVINCE_CODES = ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL'];
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
  'West Virginia', 'Wisconsin', 'Wyoming',
];
const US_TERRITORY_NAMES = [
  'Puerto Rico', 'Guam', 'Virgin Islands', 'American Samoa',
  'Northern Mariana Islands',
];
const US_CITY_SHORT_CODES = [
  'SF', 'SFO', 'NYC', 'NY', 'LA', 'DC', 'ATL', 'BOS', 'SEA', 'CHI',
  'PHX', 'DEN', 'AUS', 'MIA', 'PDX', 'DFW', 'SLC', 'LAS', 'ORD', 'MSP',
  'DTW', 'PHL', 'CLT', 'IAD', 'BWI', 'RDU', 'MCO', 'TPA',
];
const US_CITY_NAMES = Array.from(new Set([
  'New York', 'Los Angeles', 'San Francisco', 'Chicago', 'Seattle',
  'Boston', 'Austin', 'Denver', 'Atlanta', 'Miami', 'Phoenix', 'Dallas',
  'Houston', 'San Jose', 'San Diego', 'Portland', 'Nashville',
  'Minneapolis', 'Detroit', 'Philadelphia', 'Charlotte', 'Washington',
  'Las Vegas', 'Salt Lake City', 'Sacramento', 'Pittsburgh', 'Baltimore',
  'Cincinnati', 'Columbus', 'Cleveland', 'Indianapolis', 'Kansas City',
  'St. Louis', 'St Louis', 'Tampa', 'Orlando', 'Raleigh', 'Richmond',
  'Louisville', 'Memphis', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno',
  'Mesa', 'Omaha', 'Colorado Springs', 'Reno', 'Henderson', 'Buffalo',
  'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Riverside',
  'Lexington', 'Anchorage', 'Stockton', 'Newark', 'Irvine', 'Laredo',
  'Madison', 'Durham', 'Lubbock', 'Winston-Salem', 'Garland',
  'Scottsdale', 'Norfolk', 'Baton Rouge', 'Fremont', 'Gilbert',
  'Birmingham', 'Rochester', 'Spokane', 'Des Moines', 'Montgomery',
  'Modesto', 'Tacoma', 'Fontana', 'Moreno Valley', 'Fayetteville',
  'Glendale', 'Akron', 'Yonkers', 'Huntington Beach', 'Aurora', 'Tempe',
  'Oxnard', 'Knoxville', 'Providence', 'Grand Rapids', 'Chattanooga',
  'Oceanside', 'Fort Lauderdale', 'Rancho Cucamonga', 'Santa Ana',
  'Tallahassee', 'Huntsville', 'Worcester', 'Brownsville',
  'Overland Park', 'Garden Grove', 'Ontario', 'Newport News',
  'Santa Clarita', 'Elk Grove', 'Salem', 'Peoria', 'Cary', 'Lancaster',
  'Eugene', 'Shreveport', 'Lafayette', 'Cape Coral', 'Fort Collins',
  'Jackson', 'Alexandria', 'Hayward', 'Corona', 'Pasadena', 'Salinas',
  'Pomona', 'Escondido', 'Sunnyvale', 'Surprise', 'Lakewood',
  'Hollywood', 'Clarksville', 'Paterson', 'Torrance', 'Bridgeport',
  'Macon', 'Savannah', 'Springfield', 'Roseville', 'Warren',
  'Bellevue', 'Murfreesboro', 'Rockford', 'Gainesville', 'McAllen',
  'Frisco', 'Hampton', 'Killeen', 'Mesquite', 'Waco', 'Sioux Falls',
  'Columbia', 'Sterling Heights', 'Topeka', 'Dayton', 'Cedar Rapids',
  'Thousand Oaks', 'Visalia', 'Elizabeth', 'Carrollton', 'Fullerton',
  'New Haven', 'Simi Valley', 'Concord', 'Hartford', 'Evansville',
  'Olathe', 'Fargo', 'Independence', 'Ann Arbor', 'Provo', 'El Monte',
  'Clearwater', 'Beaumont', 'Costa Mesa', 'West Valley City', 'Carlsbad',
  'Cambridge', 'Arvada', 'Abilene', 'Fairfield', 'Palm Bay', 'Erie',
  'Lansing', 'Downey', 'Inglewood', 'Centennial', 'Manchester',
  'Berkeley', 'Elgin', 'Murrieta', 'Midland', 'Westminster', 'Denton',
  'Lowell', 'Wilmington', 'Pueblo', 'Antioch', 'West Palm Beach',
  'Norwalk', 'Everett', 'Pompano Beach', 'Burbank', 'Round Rock',
  'Norman', 'Waterbury', 'Athens', 'Santa Rosa', 'Fort Wayne',
  'Little Rock', 'Chandler', 'Irving', 'Chesapeake', 'North Las Vegas',
  'Jersey City', 'Plano', 'New Orleans', 'Bakersfield',
  'Oakland', 'Santa Clara', 'Mountain View', 'Palo Alto', 'Menlo Park',
  'Redwood City', 'San Mateo', 'Kirkland', 'Redmond', 'Somerville',
  'Stamford', 'Hoboken', 'Brooklyn', 'Manhattan', 'Queens', 'Anaheim',
  'San Antonio', 'Flagstaff', 'Boulder', 'Santa Fe', 'Lincoln',
  'Virginia Beach', 'Reston', 'Tysons', 'Chantilly', 'Fairfax',
  'Annapolis Junction', 'Greensboro', 'Chapel Hill',
  'Research Triangle', 'Burlington', 'Boise', 'Olympia', 'Honolulu',
  'Fort Meade', 'Hanover', 'Annapolis', 'Joint Base', 'Dublin, OH',
  'Dublin, Ohio', 'Paris, TX', 'Paris, Texas',
]));
const US_EXPLICIT_SUBSTRING_PATTERNS = [
  'United States',
  'United States of America',
  'USA',
  'U.S.A.',
  'U.S.',
  'US',
  'Remote US',
  'Remote, US',
  'Remote - US',
  'Remote - USA',
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
  'Remote - United States',
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
  'Remote eligible in US',
  'Remote Eligible in the US',
  'United States (Remote)',
  'US (Remote)',
  'Remote, Anywhere US',
  'Anywhere US',
  'US-based',
  'Must be located in the US',
  'Must be based in the US',
  'US candidates only',
  'Remote/Teleworker US',
  'Teleworker US',
  'USA - Remote',
  'US - Remote',
  'Virtual - US',
  'Virtual US',
  'Anywhere in US',
  'Remote within US',
  'Remote within the US',
  'Hybrid (US)',
  'Remote | United States',
];
const USA_REMOTE_EXACT_PATTERNS = [
  'Remote', 'Remote US', 'Remote, US', 'Remote (Any State)',
  '100% Remote', 'Work From Home', 'WFH', 'Telework', 'Telecommute',
  'Teleworker', 'Virtual', 'Hybrid Remote', 'Nationwide',
];
const WORKDAY_MULTI_LOCATION_REGEX = /^\d+ Locations?$/i;
const WORKDAY_US_PREFIX_REGEX = /^US[,\s]/i;
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
  '%Remote, United States%',
  '%Remote United States%',
  '%Remote - United States%',
  '%United States Remote%',
  '%United States, Remote%',
  '%Remote in the US%',
  '%Anywhere in the US%',
  '%Anywhere in the USA%',
  '%Anywhere in the United States%',
  '%Remote anywhere in the US%',
  '%Any location in US%',
  '%Remote, Anywhere US%',
  '%Anywhere US%',
  '%Must be located in the US%',
  '%Must be based in the US%',
  '%US candidates only%',
];
const USA_BARE_LOCATION_ILIKE_PATTERNS = Array.from(new Set([
  'US',
  'USA',
  'U.S.',
  'U.S.A.',
  ...USA_REMOTE_EXACT_PATTERNS,
  ...US_CITY_SHORT_CODES,
  ...US_CITY_NAMES,
]));
const USA_SUBSTRING_PATTERNS = Array.from(new Set([
  ...US_EXPLICIT_SUBSTRING_PATTERNS,
  ...US_STATE_NAMES,
  ...US_TERRITORY_NAMES,
  ...US_CITY_SHORT_CODES,
  ...US_CITY_NAMES,
  'AFB',
  'Naval',
  'Pentagon',
  'Quantico',
  'Langley',
  'Stennis',
  'Joint Base',
]));
const USA_SUBSTRING_REGEX_SOURCE =
  `(^|[^A-Za-z])(${USA_SUBSTRING_PATTERNS.map(escapeRegExp).join('|')})($|[^A-Za-z])`;
const US_STATE_ABBREV_REGEX_SOURCE =
  `(^|,\\s)(${US_LOCATION_SUFFIX_CODES.map(escapeRegExp).join('|')})($|,|\\s|\\)|/)`;
const USA_REMOTE_EXACT_REGEX_SOURCE =
  `^(${USA_REMOTE_EXACT_PATTERNS.map(escapeRegExp).join('|')})$`;
const US_GOV_LOCATION_REGEX_SOURCE =
  `(^|[^A-Za-z])(Fort\\s+[A-Za-z]+)($|[^A-Za-z])`;
const WORKDAY_US_STATE_CODE_REGEX_SOURCE =
  `^(${US_STATE_AND_DC_CODES.map(escapeRegExp).join('|')})-[A-Za-z0-9 '&./()_-]+-\\d+$`;
const USA_LOCATION_IMATCH_REGEX_SOURCES = [
  '^\\d+ Locations?$',
  '^US[,\\s]',
  USA_REMOTE_EXACT_REGEX_SOURCE,
  USA_SUBSTRING_REGEX_SOURCE,
  US_STATE_ABBREV_REGEX_SOURCE,
  US_GOV_LOCATION_REGEX_SOURCE,
  WORKDAY_US_STATE_CODE_REGEX_SOURCE,
];
const USA_SUBSTRING_REGEX = new RegExp(USA_SUBSTRING_REGEX_SOURCE, 'i');
const US_STATE_ABBREV_REGEX = new RegExp(US_STATE_ABBREV_REGEX_SOURCE, 'i');
const USA_REMOTE_EXACT_REGEX = new RegExp(USA_REMOTE_EXACT_REGEX_SOURCE, 'i');
const US_GOV_LOCATION_REGEX = new RegExp(US_GOV_LOCATION_REGEX_SOURCE, 'i');
const WORKDAY_US_STATE_CODE_REGEX = new RegExp(WORKDAY_US_STATE_CODE_REGEX_SOURCE, 'i');
const USA_BARE_LOCATION_LOOKUP = new Set(
  USA_BARE_LOCATION_ILIKE_PATTERNS.map(pattern => pattern.toLowerCase())
);
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
const NON_US_CANADIAN_PROVINCE_REGEX_SOURCE =
  `,\\s(${CANADIAN_PROVINCE_CODES.map(escapeRegExp).join('|')})(,|\\s|\\)|/|$)`;
const NON_US_LOCATION_REGEXES = [
  new RegExp(NON_US_COUNTRY_REGEX_SOURCE, 'i'),
  new RegExp(NON_US_CITY_REGEX_SOURCE, 'i'),
  new RegExp(NON_US_SUFFIX_REGEX_SOURCE, 'i'),
  new RegExp(NON_US_CANADIAN_PROVINCE_REGEX_SOURCE, 'i'),
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

type RoleFilterableJob = Pick<RankedJob, 'title' | 'company' | 'description'>;

const NON_TECH_ROLE_TITLE_REGEX =
  /\b(foreman|machinist|welder|electrician|plumber|carpenter|technician(?! software| it| computer))\b/i;
const SWE_NON_SOFTWARE_TITLE_REGEX =
  /\b(mechanical|hardware|electrical|electronic|civil|structural|chemical|aerospace|propulsion|pcb|circuit|hvac|plumbing|manufacturing|industrial|controls|automation|robotics hardware|field service|test engineer(?! automation))\b/i;
const SWE_KEEP_TITLE_REGEXES = [
  /\bautomation engineer\b/i,
  /\brobotics software engineer\b/i,
  /\bembedded software\b/i,
  /\bfirmware engineer\b/i,
];
const SOFTWARE_CONTEXT_REGEX =
  /\b(software|backend|frontend|full[- ]stack|platform|infrastructure|infra|developer tools|distributed systems|web|api|cloud|data|machine learning|ml|product engineering|site reliability|sre|devops|ios|android|mobile|security)\b/i;

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

function normalizeLocation(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function isWorkdayUsStateCodeLocation(location: string) {
  const match = location.match(/^([A-Za-z]{2})-[A-Za-z0-9 '&./()_-]+-\d+$/);
  return !!match && US_STATE_AND_DC_CODE_LOOKUP.has(match[1].toUpperCase());
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

function hasSoftwareContext(job: RoleFilterableJob) {
  const combined = [job.title, job.company, job.description]
    .filter(Boolean)
    .join(' ');

  return SOFTWARE_CONTEXT_REGEX.test(combined);
}

function shouldExcludeForRoleFilters(job: RoleFilterableJob, selectedRoles: string[]) {
  if (NON_TECH_ROLE_TITLE_REGEX.test(job.title)) return true;
  if (!selectedRoles.includes('swe')) return false;
  if (SWE_KEEP_TITLE_REGEXES.some(regex => regex.test(job.title))) return false;
  if (/\bhardware engineer\b/i.test(job.title) && hasSoftwareContext(job)) return false;

  return SWE_NON_SOFTWARE_TITLE_REGEX.test(job.title);
}

function applyRoleTitlePostFilter<T extends RoleFilterableJob>(jobs: T[], selectedRoles: string[]) {
  if (selectedRoles.length === 0) return jobs;

  return jobs.filter(job => !shouldExcludeForRoleFilters(job, selectedRoles));
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
    ...USA_BARE_LOCATION_ILIKE_PATTERNS.map(pattern =>
      buildPostgrestCondition('location', 'ilike', pattern)
    ),
    ...USA_LOCATION_IMATCH_REGEX_SOURCES.map(source =>
      buildPostgrestCondition('location', 'imatch', source)
    ),
  ].join(',');
}

function isNonUSLocation(location: string): boolean {
  const loc = location.trim();

  if (!loc) return false;

  return NON_US_LOCATION_REGEXES.some(regex => regex.test(loc));
}

function isUsaJob(job: { remote?: boolean; location?: string | null }): boolean {
  const rawLocation = job.location;
  const loc = normalizeLocation(rawLocation ?? '');

  if (loc && isNonUSLocation(loc)) {
    return false;
  }

  if (job.remote) return true;
  if (!rawLocation) return true;
  if (!loc) return true;
  if (USA_BARE_LOCATION_LOOKUP.has(loc.toLowerCase())) return true;
  if (WORKDAY_MULTI_LOCATION_REGEX.test(loc)) return true;
  if (WORKDAY_US_PREFIX_REGEX.test(loc)) return true;
  if (USA_REMOTE_EXACT_REGEX.test(loc)) return true;
  if (isWorkdayUsStateCodeLocation(loc)) return true;

  return (
    USA_SUBSTRING_REGEX.test(loc) ||
    US_STATE_ABBREV_REGEX.test(loc) ||
    US_GOV_LOCATION_REGEX.test(loc) ||
    WORKDAY_US_STATE_CODE_REGEX.test(loc)
  );
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
  const shouldPostFilterRoles = roles.length > 0;
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
      jobs = applyRoleTitlePostFilter(jobs, roles);
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

  const runJobsQuery = (countMode: 'exact' | 'planned', paginate = true) => {
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

      for (const source of USA_LOCATION_IMATCH_REGEX_SOURCES) {
        query = query.not('location', 'imatch', source);
      }
    }

    query = query.order('posted_at', { ascending: false, nullsFirst: false });

    return paginate ? query.range(offset, offset + perPage - 1) : query;
  };

  if (shouldPostFilterRoles) {
    const allJobsResult = await withSupabaseRetry<SupabaseResult<Record<string, unknown>[]>>(
      'jobs query (role post-filter)',
      () => runJobsQuery('planned', false)
    );

    if (allJobsResult.error) {
      logSupabaseError('jobs query failed', allJobsResult.error);
      return NextResponse.json(
        {
          error: toPublicSupabaseError(allJobsResult.error),
          retryable: isRetryableSupabaseError(allJobsResult.error),
        },
        { status: isRetryableSupabaseError(allJobsResult.error) ? 503 : 500 }
      );
    }

    const filteredJobs = applyRoleTitlePostFilter(
      (allJobsResult.data ?? []) as RankedJob[],
      roles
    );

    return NextResponse.json({
      jobs: filteredJobs
        .slice(offset, offset + perPage)
        .map(job => ({
          ...job,
          description: toCardSnippet(job.description),
        })),
      total: filteredJobs.length,
      page,
      perPage,
    });
  }

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
