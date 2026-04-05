// Source: https://developer.adzuna.com/
// Free API tier — register for app_id + app_key (takes 2 minutes).
// Returns real job listings, legally, with salary data.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const BASE = 'https://api.adzuna.com/v1/api/jobs/us/search';

const SEARCH_TERMS = [
  'software engineer new grad',
  'software engineer entry level',
  'data scientist new grad',
  'machine learning engineer entry level',
  'data analyst entry level',
];


export async function scrapeAdzuna(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    console.warn('  ⚠ Adzuna: no API keys set, skipping');
    return [];
  }
  for (const term of SEARCH_TERMS) {
    try {
      const url = new URL(`${BASE}/1`);
      url.searchParams.set('app_id', process.env.ADZUNA_APP_ID!);
      url.searchParams.set('app_key', process.env.ADZUNA_APP_KEY!);
      url.searchParams.set('what', term);
      url.searchParams.set('results_per_page', '50');
      url.searchParams.set('max_days_old', '7');
      url.searchParams.set('content-type', 'application/json');

      const res = await fetch(url.toString());
      const data = await res.json();

      for (const job of data.results ?? []) {
        const location = job.location?.display_name ?? '';
        results.push({
          source: 'adzuna',
          source_id: job.id,
          title: job.title,
          company: job.company?.display_name ?? 'Unknown',
          location,
          remote: inferRemote(location),
          url: job.redirect_url,
          description: job.description,
          salary_min: job.salary_min ? Math.round(job.salary_min) : undefined,
          salary_max: job.salary_max ? Math.round(job.salary_max) : undefined,
          experience_level: 'entry_level',
          roles: inferRoles(job.title),
          posted_at: job.created,
          dedup_hash: generateHash(job.company?.display_name ?? '', job.title, location),
        });
      }

      await new Promise(r => setTimeout(r, 500)); // be polite between requests
    } catch (err) {
      console.warn(`  ⚠ Adzuna term "${term}" failed:`, err);
    }
  }

  return results;
}
