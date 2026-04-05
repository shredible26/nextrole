// Source: https://www.themuse.com/api/public/jobs
// Public API — optional key for higher rate limits. Entry-level focused.
// Filter by level=Entry Level and category=Engineering etc.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const CATEGORIES = ['Engineering', 'Data Science', 'IT', 'Product'];
const BASE = 'https://www.themuse.com/api/public/jobs';

export async function scrapeTheMuse(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (const category of CATEGORIES) {
    try {
      const url = new URL(BASE);
      url.searchParams.set('category', category);
      url.searchParams.set('level', 'Entry Level');
      url.searchParams.set('page', '0');
      if (process.env.MUSE_API_KEY) {
        url.searchParams.set('api_key', process.env.MUSE_API_KEY);
      }

      const res = await fetch(url.toString());
      const data = await res.json();

      for (const job of data.results ?? []) {
        const location = job.locations?.[0]?.name ?? '';
        results.push({
          source: 'themuse',
          source_id: String(job.id),
          title: job.name,
          company: job.company?.name ?? 'Unknown',
          location,
          remote: inferRemote(location),
          url: job.refs?.landing_page ?? '',
          experience_level: 'entry_level',
          roles: inferRoles(job.name),
          posted_at: job.publication_date,
          dedup_hash: generateHash(
            job.company?.name ?? '',
            job.name,
            location
          ),
        });
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.warn(`  ⚠ TheMuse category "${category}" failed:`, err);
    }
  }

  return results;
}
