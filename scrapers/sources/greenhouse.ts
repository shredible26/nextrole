// Source: https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true
// Fully public API — no auth, no key. Hundreds of tech companies use Greenhouse.
// Strategy: fire all company fetches concurrently; silently skip 404/500s.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const COMPANIES = [
  'google', 'meta', 'stripe', 'airbnb', 'notion', 'linear', 'figma',
  'discord', 'coinbase', 'robinhood', 'plaid', 'brex', 'ramp', 'scale',
  'openai', 'anthropic', 'databricks', 'snowflake', 'hashicorp', 'vercel',
  'planetscale', 'supabase', 'retool', 'airtable', 'asana', 'hubspot',
  'zendesk', 'twilio', 'sendgrid', 'segment', 'amplitude', 'mixpanel',
  'datadog', 'pagerduty', 'elastic', 'mongodb', 'redis', 'confluent',
  'dbt', 'fivetran', 'hightouch', 'census', 'rudderstack', 'posthog',
  'sentry', 'loom', 'miro', 'coda', 'roamresearch',
  'benchling', 'relativity', 'palantir', 'anduril', 'shield',
  'waymo', 'cruise', 'zoox', 'nuro', 'aurora', 'comma',
  'jane', 'hims', 'tempus', 'flatiron', 'cityblock',
  'chime', 'sofi', 'dave', 'current', 'mercury', 'relay',
  'faire', 'toast', 'squarespace', 'wix', 'webflow',
  'duolingo', 'chegg', 'coursera', 'udemy', 'masterclass',
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
      `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return []; // 404 = company doesn't use Greenhouse; skip silently

    const data = await res.json();
    const jobs: any[] = data.jobs ?? [];

    const normalized: NormalizedJob[] = [];
    for (const job of jobs) {
      if (!isTechRole(job.title ?? '')) continue;
      const level = inferExperienceLevel(job.title ?? '', job.content ?? '');
      if (level === null) continue;

      const location: string = job.location?.name ?? '';
      // Greenhouse stores company name in the board metadata; fall back to slug
      const companyName: string = data.company?.name ?? company;
      normalized.push({
        source: 'greenhouse',
        source_id: String(job.id),
        title: job.title,
        company: companyName,
        location,
        remote: inferRemote(location),
        url: job.absolute_url ?? '',
        description: job.content ?? undefined,
        experience_level: level,
        roles: inferRoles(job.title),
        posted_at: job.updated_at ?? undefined,
        dedup_hash: generateHash(companyName, job.title, location),
      });
    }
    return normalized;
  } catch {
    return []; // timeout or network error — skip silently
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrapeGreenhouse(): Promise<NormalizedJob[]> {
  // Stagger requests in small batches to be polite while still being fast
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
