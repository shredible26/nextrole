// Source: https://remoteok.com/api
// Fully public API — no key, no auth. Remote jobs only.
// Docs: https://remoteok.com/api

import { generateHash } from '../utils/dedup';
import { inferRoles, NormalizedJob } from '../utils/normalize';

const TECH_KEYWORDS = [
  'engineer', 'developer', 'scientist', 'analyst',
  'ml', 'ai', 'data', 'backend', 'frontend', 'fullstack',
];

export async function scrapeRemoteOK(): Promise<NormalizedJob[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'NexTRole Job Aggregator (nextrole.io)' },
  });
  const data = await res.json();

  return data
    .filter((job: any) => job.slug) // first element is metadata, skip it
    .filter((job: any) => {
      const title = (job.position ?? '').toLowerCase();
      return TECH_KEYWORDS.some(k => title.includes(k));
    })
    .map((job: any): NormalizedJob => ({
      source: 'remoteok',
      source_id: String(job.id),
      title: job.position,
      company: job.company,
      location: 'Remote',
      remote: true,
      url: job.url,
      description: job.description,
      salary_min: job.salary_min ? Number(job.salary_min) : undefined,
      salary_max: job.salary_max ? Number(job.salary_max) : undefined,
      experience_level: 'entry_level',
      roles: inferRoles(job.position),
      posted_at: new Date(job.epoch * 1000).toISOString(),
      dedup_hash: generateHash(job.company, job.position, 'Remote'),
    }));
}
