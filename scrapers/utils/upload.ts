import { createClient } from '@supabase/supabase-js';
import { NormalizedJob } from './normalize';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key — bypasses RLS
);

const UPSERT_CHUNK_SIZE = 500;

export async function uploadJobs(jobs: NormalizedJob[]): Promise<void> {
  if (jobs.length === 0) return;

  for (let i = 0; i < jobs.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from('jobs')
      .upsert(chunk, { onConflict: 'dedup_hash', ignoreDuplicates: true });

    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`  ✓ Uploaded ${jobs.length} jobs`);
}

export async function deactivateStaleJobs(
  sourceName: string,
  activeHashes: string[]
): Promise<void> {
  if (activeHashes.length === 0) return;

  // Fetch all currently-active jobs for this source
  const { data: existingJobs, error: fetchError } = await supabase
    .from('jobs')
    .select('id, dedup_hash')
    .eq('source', sourceName)
    .eq('is_active', true);

  if (fetchError) {
    console.warn(`  ⚠ Stale job fetch failed for ${sourceName}:`, fetchError.message);
    return;
  }

  const activeHashSet = new Set(activeHashes);
  const staleIds = (existingJobs ?? [])
    .filter(job => !activeHashSet.has(job.dedup_hash))
    .map(job => job.id);

  if (staleIds.length === 0) return;

  // Chunk to avoid hitting Supabase's IN-clause limits
  const CHUNK_SIZE = 500;
  for (let i = 0; i < staleIds.length; i += CHUNK_SIZE) {
    const chunk = staleIds.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('jobs')
      .update({ is_active: false })
      .in('id', chunk);

    if (error) console.warn(`  ⚠ Stale cleanup chunk failed for ${sourceName}:`, error.message);
  }

  console.log(`  ↩ Deactivated ${staleIds.length} stale jobs for ${sourceName}`);
}
