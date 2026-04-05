import { createClient } from '@supabase/supabase-js';
import { NormalizedJob } from './normalize';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key — bypasses RLS
);

export async function uploadJobs(jobs: NormalizedJob[]): Promise<void> {
  if (jobs.length === 0) return;

  const { error } = await supabase
    .from('jobs')
    .upsert(jobs, { onConflict: 'dedup_hash', ignoreDuplicates: true });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log(`  ✓ Uploaded ${jobs.length} jobs`);
}

export async function deactivateStaleJobs(
  sourceName: string,
  activeHashes: string[]
): Promise<void> {
  if (activeHashes.length === 0) return;

  // Mark any jobs from this source NOT in the current scrape as inactive
  const { error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('source', sourceName)
    .not('dedup_hash', 'in', `(${activeHashes.map(h => `'${h}'`).join(',')})`);

  if (error) console.warn(`  ⚠ Stale job cleanup failed for ${sourceName}:`, error.message);
}
