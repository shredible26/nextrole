// Source: https://api.lever.co/v0/postings/{company}?mode=json
// Fully public API — no auth, no key. Returns JSON postings for each company.
// Strategy: fire all company fetches concurrently; silently skip 404/500s.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const COMPANIES = [
  'netflix', 'lyft', 'doordash', 'instacart', 'grubhub', 'gopuff',
  'rivian', 'lucid', 'canoo', 'fisker',
  'twitter', 'reddit', 'pinterest', 'snap', 'spotify', 'soundcloud',
  'twitch', 'unity', 'epicgames', 'roblox', 'niantic',
  'shopify', 'squareup', 'affirm', 'afterpay', 'klarna', 'marqeta',
  'carta', 'angellist', 'lattice', 'rippling', 'gusto', 'justworks',
  'greenhouse', 'lever', 'workday', 'servicenow', 'salesforce',
  'okta', 'crowdstrike', 'zscaler', 'sentinelone', 'lacework',
  'cloudflare', 'fastly', 'akamai', 'netlify', 'heroku',
  'digitalocean', 'linode', 'vultr', 'fly', 'render',
  'neon', 'turso', 'upstash', 'convex', 'xata',
];

const TECH_KEYWORDS = [
  'engineer', 'developer', 'scientist', 'analyst', 'ml', 'ai', 'data',
  'software', 'backend', 'frontend', 'fullstack', 'full stack', 'product manager',
];

function isTechRole(title: string): boolean {
  const lower = title.toLowerCase();
  return TECH_KEYWORDS.some(k => lower.includes(k));
}

async function fetchCompany(company: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${company}?mode=json`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return []; // company not on Lever — skip silently

    const jobs: any[] = await res.json();
    if (!Array.isArray(jobs)) return [];

    const normalized: NormalizedJob[] = [];
    for (const job of jobs) {
      if (!isTechRole(job.text ?? '')) continue;
      const description = job.descriptionPlain ?? job.description ?? undefined;
      const level = inferExperienceLevel(job.text ?? '', description);
      if (level === null) continue;

      const location: string = job.categories?.location ?? job.categories?.allLocations?.[0] ?? '';
      // Lever doesn't return company name in the posting — derive from slug
      const companyName = company.charAt(0).toUpperCase() + company.slice(1);
      normalized.push({
        source: 'lever',
        source_id: job.id ?? '',
        title: job.text ?? '',
        company: companyName,
        location,
        remote: inferRemote(location),
        url: job.hostedUrl ?? '',
        description,
        experience_level: level,
        roles: inferRoles(job.text ?? ''),
        // createdAt is Unix milliseconds
        posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        dedup_hash: generateHash(companyName, job.text ?? '', location),
      });
    }
    return normalized;
  } catch {
    return []; // timeout or network error — skip silently
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrapeLever(): Promise<NormalizedJob[]> {
  const BATCH_SIZE = 10;
  const DELAY_MS = 200;
  const all: NormalizedJob[] = [];

  for (let i = 0; i < COMPANIES.length; i += BATCH_SIZE) {
    const batch = COMPANIES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fetchCompany));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      }
    }

    if (i + BATCH_SIZE < COMPANIES.length) {
      await sleep(DELAY_MS);
    }
  }

  return all;
}
