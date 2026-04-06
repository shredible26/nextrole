import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const DICE_PRIMARY = 'https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search';
const DICE_FALLBACK = 'https://www.dice.com/api/rest/jobsearch/v1/simple';
const MAX_PAGES = 3;

const SEARCH_TERMS = [
  'software engineer entry level',
  'software engineer new grad',
  'data scientist entry level',
  'machine learning engineer entry level',
  'junior software engineer',
  'associate software engineer',
  'data analyst entry level',
  'frontend engineer entry level',
  'backend engineer entry level',
];

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; NextRole job aggregator)',
  Accept: 'application/json',
};

function parseSalary(salaryStr?: string): { salary_min?: number; salary_max?: number } {
  if (!salaryStr) return {};
  const numbers = salaryStr.replace(/,/g, '').match(/\d+(?:\.\d+)?k?/gi) ?? [];
  const parsed = numbers
    .map(n => {
      const val = parseFloat(n);
      return n.toLowerCase().endsWith('k') ? val * 1000 : val;
    })
    .filter(n => n >= 1000);
  if (parsed.length === 0) return {};
  if (parsed.length === 1) return { salary_min: parsed[0] };
  return { salary_min: Math.min(...parsed), salary_max: Math.max(...parsed) };
}

function mapRaw(raw: Record<string, unknown>): NormalizedJob | null {
  const title = (raw.jobTitle ?? raw.title ?? '') as string;
  const description = (raw.jobDescription ?? raw.description ?? '') as string;

  const experienceLevel = inferExperienceLevel(title, description);
  if (!experienceLevel) return null;

  const company = (raw.companyName ?? raw.company ?? 'Unknown') as string;
  const location = (raw.location ?? raw.city ?? '') as string;
  const workplaceTypes = (raw.workplaceTypes ?? []) as string[];
  const isRemote =
    raw.isRemote === true ||
    inferRemote(location) ||
    workplaceTypes.some(t => t.toLowerCase() === 'remote');

  const url = (raw.applyUrl ?? raw.jobDetailUrl ?? raw.detailUrl ?? '') as string;
  const rawSalary = (raw.salary ?? raw.salaryRange ?? raw.wage ?? '') as string;
  const { salary_min, salary_max } = parseSalary(rawSalary);

  const postedRaw = raw.postedDate ?? raw.date ?? raw.publishDate;
  let posted_at: string | undefined;
  if (postedRaw) {
    try {
      posted_at = new Date(postedRaw as string).toISOString();
    } catch {
      // ignore malformed dates
    }
  }

  return {
    source: 'dice',
    source_id: String(raw.jobId ?? raw.id ?? raw.adId ?? ''),
    title,
    company,
    location,
    remote: isRemote,
    url,
    description,
    salary_min,
    salary_max,
    experience_level: experienceLevel,
    roles: inferRoles(title),
    posted_at,
    dedup_hash: generateHash(company, title, location),
  };
}

async function fetchPrimary(term: string, page: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    q: term,
    countryCode: 'US',
    pageSize: '50',
    pageNum: String(page),
    'filters.employmentType': 'FULLTIME',
    'filters.postedDate': 'ONE_WEEK',
  });

  const res = await fetch(`${DICE_PRIMARY}?${params}`, { headers: HEADERS });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`AUTH_REQUIRED:${res.status}`);
  }
  if (!res.ok) throw new Error(`Dice primary responded ${res.status}`);

  const json = await res.json() as Record<string, unknown>;
  return (json.data ?? json.hits ?? json.results ?? []) as Record<string, unknown>[];
}

async function fetchFallback(term: string, page: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    text: term,
    country: 'US',
    city: '',
    state: '',
    page: String(page),
    pageSize: '50',
  });

  const res = await fetch(`${DICE_FALLBACK}?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Dice fallback responded ${res.status}`);

  const json = await res.json() as Record<string, unknown>;
  return (json.resultItemList ?? json.results ?? json.jobs ?? []) as Record<string, unknown>[];
}

export async function scrapeDice(): Promise<NormalizedJob[]> {
  const allJobs: NormalizedJob[] = [];
  const seenHashes = new Set<string>();
  let useFallback = false;

  for (const term of SEARCH_TERMS) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        let rawJobs: Record<string, unknown>[];

        if (useFallback) {
          rawJobs = await fetchFallback(term, page);
        } else {
          try {
            rawJobs = await fetchPrimary(term, page);
          } catch (err) {
            if ((err as Error).message.startsWith('AUTH_REQUIRED')) {
              console.warn('  ⚠ Dice primary API requires auth — switching to fallback for all remaining terms');
              useFallback = true;
              rawJobs = await fetchFallback(term, page);
            } else {
              throw err;
            }
          }
        }

        if (rawJobs.length === 0) break;

        for (const raw of rawJobs) {
          const job = mapRaw(raw);
          if (!job) continue;
          if (seenHashes.has(job.dedup_hash)) continue;
          seenHashes.add(job.dedup_hash);
          allJobs.push(job);
        }

        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.warn(`  ⚠ Dice "${term}" page ${page} failed: ${(err as Error).message}`);
        break; // move on to next term
      }
    }
  }

  if (allJobs.length === 0) {
    console.warn('  ⚠ Dice: 0 jobs returned — API may require auth or have changed');
  }

  return allJobs;
}
