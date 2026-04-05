import { scrapePittCSC }             from './sources/pittcsc';
import { scrapeSimplifyInternships } from './sources/simplify-internships';
import { scrapeAdzuna }              from './sources/adzuna';
import { scrapeRemoteOK }            from './sources/remoteok';
import { scrapeArbeitnow }           from './sources/arbeitnow';
import { scrapeTheMuse }             from './sources/themuse';
import { scrapeJobSpy }              from './sources/jobspy';
import { uploadJobs, deactivateStaleJobs } from './utils/upload';
import { NormalizedJob } from './utils/normalize';

const SCRAPERS: { name: string; fn: () => Promise<NormalizedJob[]> }[] = [
  // Week 1 — active
  { name: 'pittcsc',              fn: scrapePittCSC },
  { name: 'simplify_internships', fn: scrapeSimplifyInternships },
  { name: 'adzuna',               fn: scrapeAdzuna },
  { name: 'remoteok',             fn: scrapeRemoteOK },
  { name: 'arbeitnow',            fn: scrapeArbeitnow },
  { name: 'themuse',              fn: scrapeTheMuse },
  { name: 'jobspy',               fn: scrapeJobSpy },
  // Week 2 (uncomment when ready):
  // { name: 'jobright',          fn: scrapeJobright },
  // { name: 'otta',              fn: scrapeOtta },
  // { name: 'levels',            fn: scrapeLevels },
  // Week 3 (requires proxy):
  // { name: 'linkedin',          fn: scrapeLinkedIn },
  // { name: 'indeed',            fn: scrapeIndeed },
  // { name: 'handshake',         fn: scrapeHandshake },
  // { name: 'wellfound',         fn: scrapeWellfound },
  // { name: 'dice',              fn: scrapeDice },
];

// Runs a single scraper end-to-end: fetch → upload → deactivate stale
async function runScraper(name: string, fn: () => Promise<NormalizedJob[]>) {
  const start = Date.now();
  console.log(`  [${name}] Starting...`);

  try {
    const jobs = await fn();
    console.log(`  [${name}] Fetched ${jobs.length} jobs`);

    await uploadJobs(jobs);
    // jobspy jobs carry per-site sources (e.g. jobspy_indeed) so we can't
    // deactivate stale entries by the orchestrator-level name 'jobspy'.
    if (name !== 'jobspy') {
      await deactivateStaleJobs(name, jobs.map(j => j.dedup_hash));
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${name}] ✓ Done in ${elapsed}s`);

    return { name, count: jobs.length, success: true, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`  [${name}] ✗ Failed after ${elapsed}s:`, (err as Error).message);
    return { name, count: 0, success: false, elapsed };
  }
}

async function run() {
  console.log(`\n🚀 NexTRole scrape run — ${new Date().toISOString()}`);
  console.log(`   Running ${SCRAPERS.length} scrapers concurrently...\n`);

  const globalStart = Date.now();

  // All scrapers fire simultaneously — total time = slowest scraper, not sum
  const results = await Promise.allSettled(
    SCRAPERS.map(({ name, fn }) => runScraper(name, fn))
  );

  // Summarize
  const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(1);
  const summary = results.map(r =>
    r.status === 'fulfilled' ? r.value : { name: 'unknown', count: 0, success: false }
  );

  console.log('\n─── Scrape Summary ───────────────────────────────');
  for (const s of summary) {
    const icon = s.success ? '✓' : '✗';
    console.log(`  ${icon} ${s.name.padEnd(22)} ${s.success ? `${s.count} jobs` : 'FAILED'}`);
  }
  console.log(`\n  Total jobs processed: ${summary.reduce((acc, s) => acc + s.count, 0)}`);
  console.log(`  Wall time: ${totalElapsed}s`);
  console.log('──────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});