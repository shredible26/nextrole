import { scrapePittCSC }             from './sources/pittcsc';
import { scrapeSimplifyInternships } from './sources/simplify-internships';
import { scrapeVanshb03Newgrad }     from './sources/vanshb03-newgrad';
import { scrapeVanshb03Internships } from './sources/vanshb03-internships';
import { scrapeSpeedyapplySwe }      from './sources/speedyapply-swe';
import { scrapeSpeedyapplyAi }       from './sources/speedyapply-ai';
import { scrapeAdzuna }              from './sources/adzuna';
import { scrapeRemoteOK }            from './sources/remoteok';
import { scrapeArbeitnow }           from './sources/arbeitnow';
import { scrapeTheMuse }             from './sources/themuse';
import { scrapeJobSpy }              from './sources/jobspy';
import { scrapeGreenhouse }          from './sources/greenhouse';
import { scrapeLever }               from './sources/lever';
import { scrapeWorkday }             from './sources/workday';
import { scrapeZipRecruiter }        from './sources/ziprecruiter';
import { scrapeGlassdoor }           from './sources/glassdoor';
import { scrapeCareerjet }           from './sources/careerjet';
import { scrapeWorkAtAStartup }      from './sources/workatastartup';
import { scrapeBuiltIn }             from './sources/builtin';
import { scrapeWellfound }           from './sources/wellfound';
import { scrapeDice }                from './sources/dice';
import { scrapeHandshake }           from './sources/handshake';
import { scrapeAshby }              from './sources/ashby';
import { scrapeBambooHR }           from './sources/bamboohr';
import { scrapeRippling }           from './sources/rippling';
import { scrapeDiceRss }            from './sources/dice-rss';
import { scrapeUSAJobs }            from './sources/usajobs';
import { uploadJobs, deactivateStaleJobs } from './utils/upload';
import { NormalizedJob } from './utils/normalize';

const SCRAPERS: { name: string; fn: () => Promise<NormalizedJob[]> }[] = [
  // Week 1 — active
  { name: 'pittcsc',               fn: scrapePittCSC },
  { name: 'simplify_internships',  fn: scrapeSimplifyInternships },
  { name: 'vanshb03_newgrad',      fn: scrapeVanshb03Newgrad },
  { name: 'vanshb03_internships',  fn: scrapeVanshb03Internships },
  { name: 'speedyapply_swe',       fn: scrapeSpeedyapplySwe },
  { name: 'speedyapply_ai',        fn: scrapeSpeedyapplyAi },
  { name: 'adzuna',                fn: scrapeAdzuna },
  { name: 'remoteok',             fn: scrapeRemoteOK },
  { name: 'arbeitnow',            fn: scrapeArbeitnow },
  { name: 'themuse',              fn: scrapeTheMuse },
  { name: 'jobspy',               fn: scrapeJobSpy },
  { name: 'greenhouse',           fn: scrapeGreenhouse },
  { name: 'lever',                fn: scrapeLever },
  { name: 'workday',              fn: scrapeWorkday },
  { name: 'ziprecruiter',         fn: scrapeZipRecruiter },
  { name: 'glassdoor',            fn: scrapeGlassdoor },
  { name: 'careerjet',            fn: scrapeCareerjet },
  { name: 'workatastartup',       fn: scrapeWorkAtAStartup },
  { name: 'builtin',              fn: scrapeBuiltIn },
  { name: 'wellfound',            fn: scrapeWellfound },
  { name: 'dice',                 fn: scrapeDice },
  { name: 'handshake',            fn: scrapeHandshake },
  { name: 'ashby',               fn: scrapeAshby },
  { name: 'bamboohr',            fn: scrapeBambooHR },
  { name: 'rippling',            fn: scrapeRippling },
  { name: 'dice_rss',            fn: scrapeDiceRss },
  { name: 'usajobs',             fn: scrapeUSAJobs },
  // Week 2 (uncomment when ready):
  // { name: 'jobright',          fn: scrapeJobright },
  // { name: 'otta',              fn: scrapeOtta },
  // { name: 'levels',            fn: scrapeLevels },
  // Week 3 (requires proxy):
  // { name: 'linkedin',          fn: scrapeLinkedIn },
  // { name: 'indeed',            fn: scrapeIndeed },
  // { name: 'handshake',         fn: scrapeHandshake },
  // (wellfound + dice are now active above)
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
  console.log(`\n🚀 NextRole scrape run — ${new Date().toISOString()}`);
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
