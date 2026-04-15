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


export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check tier
    const { data: profile } = await admin
      .from('profiles')
      .select('tier, resume_embedding')
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

    // Fetch job embeddings
    const { data: jobs } = await admin
      .from('jobs')
      .select('id, embedding')
      .in('id', jobIds);

    const scores: Record<string, { grade: string; similarity: number }> = {};

    // First pass: compute all similarities for jobs that have embeddings
    const computed: Array<{ id: string; similarity: number }> = [];
    for (const job of jobs ?? []) {
      if (!job.embedding) continue;
      let jobEmbedding: number[];
      try {
        const raw = job.embedding as string | number[];
        jobEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
      } catch {
        continue;
      }
      computed.push({ id: job.id as string, similarity: cosineSimilarity(resumeEmbedding, jobEmbedding) });
    }

    // Second pass: assign grades by percentile rank within this batch
    const n = computed.length;
    if (n > 0) {
      const sorted = [...computed].sort((a, b) => b.similarity - a.similarity);
      sorted.forEach(({ id, similarity }, i) => {
        const pct = i / n;
        let grade: 'A' | 'B' | 'C' | 'D' | 'F';
        if (pct < 0.10) grade = 'A';
        else if (pct < 0.25) grade = 'B';
        else if (pct < 0.50) grade = 'C';
        else if (pct < 0.75) grade = 'D';
        else grade = 'F';
        scores[id] = { grade, similarity };
      });
    }

    return NextResponse.json({ scores });
  } catch (err) {
    console.error('[match-scores] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
