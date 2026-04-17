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

function assignGrades(entries: Array<{ id: string; score: number }>): Map<string, string> {
  const gradeMap = new Map<string, string>();
  const n = entries.length;
  if (n === 0) return gradeMap;
  const sorted = [...entries].sort((a, b) => b.score - a.score);
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

interface ClaudeApiResponse {
  content?: Array<{ type: string; text: string }>;
}

async function getClaudeScore(
  resumeText: string,
  job: {
    title: string;
    company: string;
    description: string | null;
    roles: string[];
    experience_level: string;
  },
  apiKey: string
): Promise<number | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system:
          'You are a job-resume matcher. Rate how well this candidate\'s resume matches this job on a scale of 0-100. Respond with ONLY a JSON object: {"score": <number>}. Consider: skills overlap, experience level appropriateness, role relevance. Be generous for entry-level/new-grad roles where potential matters more than exact experience.',
        messages: [
          {
            role: 'user',
            content:
              `Resume summary: ${resumeText}\n\n` +
              `Job: ${job.title} at ${job.company}\n` +
              (job.description
                ? `Description: ${job.description.slice(0, 500)}`
                : 'No description available - judge by title and company only') +
              `\nRoles: ${job.roles.join(', ')}\nExperience level: ${job.experience_level}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as ClaudeApiResponse;
    const text = data.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as { score?: unknown };
    const score = Number(parsed.score);
    if (isNaN(score) || score < 0 || score > 100) return null;
    return score;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch profile — need resume_text for Claude scoring, resume_embedding for cosine similarity
    const { data: profile } = await admin
      .from('profiles')
      .select('tier, resume_embedding, resume_text, updated_at')
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
      .select('job_id, similarity, grade, claude_score, computed_at')
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
    // Also fetch metadata needed for Claude scoring
    const { data: jobs } = await admin
      .from('jobs')
      .select('id, title, company, description, roles, experience_level, embedding')
      .in('id', [...needsCompute]);

    type NewlyComputedJob = {
      id: string;
      similarity: number;
      title: string;
      company: string;
      description: string | null;
      roles: string[];
      experience_level: string;
    };

    const newlyComputed: NewlyComputedJob[] = [];
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
        title: (job.title as string | null) ?? '',
        company: (job.company as string | null) ?? '',
        description: job.description as string | null,
        roles: Array.isArray(job.roles) ? (job.roles as string[]) : [],
        experience_level: (job.experience_level as string | null) ?? '',
      });
    }

    // ── Step 3: Fetch ALL existing similarities + claude_scores for this user ──
    const { data: allExisting } = await admin
      .from('job_scores')
      .select('job_id, similarity, claude_score')
      .eq('user_id', user.id);

    // Build combined maps — newly computed takes precedence for similarity
    const allRawSimilarities = new Map<string, number>();
    const allClaudeScores = new Map<string, number | null>();

    for (const row of allExisting ?? []) {
      allRawSimilarities.set(row.job_id as string, row.similarity as number);
      const cs = row.claude_score;
      allClaudeScores.set(
        row.job_id as string,
        cs !== undefined && cs !== null ? (cs as number) : null
      );
    }
    for (const { id, similarity } of newlyComputed) {
      allRawSimilarities.set(id, similarity);
      // Preserve any existing claude_score from DB — don't overwrite
    }

    // Any requested job that has no embedding and no prior cached score gets
    // similarity=0 so it still participates in percentile grading and every
    // card receives a badge.  These placeholder entries are excluded from the
    // upsert so the cache is never polluted with fake zeros.
    const placeholderIds = new Set<string>();
    for (const id of jobIds) {
      if (!allRawSimilarities.has(id)) {
        allRawSimilarities.set(id, 0);
        allClaudeScores.set(id, null);
        placeholderIds.add(id);
      }
    }

    // ── Step 4: Claude hybrid scoring for top newly-computed candidates ──
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const resumeText = ((profile.resume_text as string | null) ?? '').slice(0, 1500);

    if (anthropicKey && resumeText) {
      // Only score newly computed jobs that have no cached claude_score
      const uncached = newlyComputed.filter(job => {
        const existing = allClaudeScores.get(job.id);
        return existing === undefined || existing === null;
      });

      // Take top 10 by cosine similarity
      const candidates = uncached
        .slice()
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

      if (candidates.length > 0) {
        const results = await Promise.allSettled(
          candidates.map(job =>
            getClaudeScore(resumeText, job, anthropicKey).then(score => ({ id: job.id, score }))
          )
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.score !== null) {
            allClaudeScores.set(result.value.id, result.value.score);
          }
        }
      }
    }

    // ── Step 5: Compute blended final scores for percentile grading ──
    const allEntries = [...allRawSimilarities.entries()].map(([id, rawSim]) => {
      const claudeScore = allClaudeScores.get(id);
      const finalScore =
        claudeScore !== null && claudeScore !== undefined
          ? claudeScore / 100 * 0.6 + rawSim * 0.4
          : rawSim;
      return { id, score: finalScore };
    });

    const gradeMap = assignGrades(allEntries);

    // ── Step 6: Upsert ALL rows — grades may have shifted for existing jobs ──
    const now = new Date().toISOString();
    const upsertRows = [...allRawSimilarities.entries()]
      .filter(([id]) => !placeholderIds.has(id))
      .map(([id, rawSim]) => ({
        user_id: user.id,
        job_id: id,
        similarity: rawSim,
        grade: gradeMap.get(id) ?? 'F',
        computed_at: now,
        claude_score: allClaudeScores.get(id) ?? null,
      }));

    if (upsertRows.length > 0) {
      await admin
        .from('job_scores')
        .upsert(upsertRows, { onConflict: 'user_id,job_id' });
    }

    // ── Step 7: Return scores for the requested job IDs ──
    const scores: Record<string, { grade: string; similarity: number }> = {};
    for (const id of jobIds) {
      const rawSim = allRawSimilarities.get(id);
      const grade = gradeMap.get(id);
      if (rawSim !== undefined && grade !== undefined) {
        scores[id] = { grade, similarity: rawSim };
      }
    }

    return NextResponse.json({ scores });
  } catch (err) {
    console.error('[match-scores] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
