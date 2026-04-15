import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

function assignGrades(entries: Array<{ id: string; similarity: number }>): Map<string, string> {
  const gradeMap = new Map<string, string>();
  const n = entries.length;
  if (n === 0) return gradeMap;
  const sorted = [...entries].sort((a, b) => b.similarity - a.similarity);
  sorted.forEach(({ id }, i) => {
    const pct = i / n;
    let grade: string;
    if (pct < 0.10)      grade = 'A';
    else if (pct < 0.25) grade = 'B';
    else if (pct < 0.50) grade = 'C';
    else if (pct < 0.75) grade = 'D';
    else                 grade = 'F';
    gradeMap.set(id, grade);
  });
  return gradeMap;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch profile — need updated_at to detect resume changes
    const { data: profile } = await admin
      .from('profiles')
      .select('tier, resume_embedding, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.tier !== 'pro') {
      return NextResponse.json({ upgrade: true }, { status: 402 });
    }

    if (!profile.resume_embedding) {
      return NextResponse.json({ scores: {}, noResume: true });
    }

    // Parse resume embedding
    let resumeEmbedding: number[];
    try {
      const raw = profile.resume_embedding as string | number[];
      resumeEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
    } catch {
      return NextResponse.json({ scores: {}, noResume: true });
    }

    // Validate request body
    let body: { jobIds?: unknown };
    try {
      body = await req.json() as { jobIds?: unknown };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!Array.isArray(body.jobIds)) {
      return NextResponse.json({ error: 'jobIds must be an array' }, { status: 400 });
    }

    const jobIds = (body.jobIds as unknown[])
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 50);

    if (jobIds.length === 0) {
      return NextResponse.json({ scores: {} });
    }

    // Treat missing updated_at as epoch 0 — any cached score will be considered fresh
    const profileUpdatedAt = profile.updated_at
      ? new Date(profile.updated_at as string)
      : new Date(0);

    // ── Step 1: Check which requested jobs already have fresh cached scores ──
    const { data: cachedRows } = await admin
      .from('job_scores')
      .select('job_id, similarity, grade, computed_at')
      .eq('user_id', user.id)
      .in('job_id', jobIds);

    const validCached = new Map<string, { similarity: number; grade: string }>();
    const needsCompute = new Set(jobIds);

    for (const row of cachedRows ?? []) {
      if (new Date(row.computed_at as string) > profileUpdatedAt) {
        validCached.set(row.job_id as string, {
          similarity: row.similarity as number,
          grade: row.grade as string,
        });
        needsCompute.delete(row.job_id as string);
      }
    }

    // Early return: every requested job is already cached and fresh
    if (needsCompute.size === 0) {
      const scores: Record<string, { grade: string; similarity: number }> = {};
      for (const [id, s] of validCached) scores[id] = s;
      return NextResponse.json({ scores });
    }

    // ── Step 2: Compute similarities for stale / missing jobs ──
    const { data: jobs } = await admin
      .from('jobs')
      .select('id, embedding')
      .in('id', [...needsCompute]);

    const newlyComputed: Array<{ id: string; similarity: number }> = [];
    for (const job of jobs ?? []) {
      if (!job.embedding) continue;
      let jobEmbedding: number[];
      try {
        const raw = job.embedding as string | number[];
        jobEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
      } catch { continue; }
      newlyComputed.push({
        id: job.id as string,
        similarity: cosineSimilarity(resumeEmbedding, jobEmbedding),
      });
    }

    // ── Step 3: Fetch ALL existing similarities for this user ──
    const { data: allExisting } = await admin
      .from('job_scores')
      .select('job_id, similarity')
      .eq('user_id', user.id);

    // Build combined map — newly computed takes precedence over cached
    const allSimilarities = new Map<string, number>();
    for (const row of allExisting ?? []) {
      allSimilarities.set(row.job_id as string, row.similarity as number);
    }
    for (const { id, similarity } of newlyComputed) {
      allSimilarities.set(id, similarity);
    }

    // ── Step 4: Re-grade across the full combined set ──
    const allEntries = [...allSimilarities.entries()].map(([id, similarity]) => ({ id, similarity }));
    const gradeMap = assignGrades(allEntries);

    // ── Step 5: Upsert ALL rows — grades may have shifted for existing jobs ──
    const now = new Date().toISOString();
    const upsertRows = allEntries.map(({ id, similarity }) => ({
      user_id: user.id,
      job_id: id,
      similarity,
      grade: gradeMap.get(id) ?? 'F',
      computed_at: now,
    }));

    if (upsertRows.length > 0) {
      await admin
        .from('job_scores')
        .upsert(upsertRows, { onConflict: 'user_id,job_id' });
    }

    // ── Step 6: Return scores for the requested job IDs ──
    const scores: Record<string, { grade: string; similarity: number }> = {};
    for (const id of jobIds) {
      const similarity = allSimilarities.get(id);
      const grade = gradeMap.get(id);
      if (similarity !== undefined && grade !== undefined) {
        scores[id] = { grade, similarity };
      }
    }

    return NextResponse.json({ scores });
  } catch (err) {
    console.error('[match-scores] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
