import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/lib/types';
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
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
type ParsedRole = Extract<
  Role,
  'swe' | 'ds' | 'ml' | 'ai' | 'devops' | 'security' | 'pm' | 'analyst' | 'finance'
>;
type ParsedLevel = 'new_grad' | 'entry_level' | 'experienced';

type ParsedProfile = {
  skills: string[];
  roles: ParsedRole[];
  level: ParsedLevel;
  graduation_year: number | null;
};

type JobForScoring = {
  id: string;
  title: string;
  description: string | null;
  roles: string[];
  experience_level: string;
};

const GRADE_RANK: Record<Grade, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
};

const PROFILE_ROLE_TYPES = [
  'swe',
  'ds',
  'ml',
  'ai',
  'devops',
  'security',
  'pm',
  'analyst',
  'finance',
] as const;

const PROFILE_ROLE_SET = new Set<ParsedRole>(PROFILE_ROLE_TYPES);

const TECH_ROLE_TYPES = new Set<ParsedRole>([
  'swe',
  'ds',
  'ml',
  'ai',
  'devops',
  'security',
  'analyst',
]);

const DEFAULT_PARSED_PROFILE: ParsedProfile = {
  skills: [],
  roles: ['swe', 'ds'],
  level: 'new_grad',
  graduation_year: null,
};

const ENTRY_LEVEL_TITLE_PATTERNS = [
  /\bassociate\b/i,
  /\bjunior\b/i,
  /\bjr\b/i,
  /\bi\b(?=[,\s]|$)/i,
  /\bentry\b/i,
  /early career/i,
  /new grad/i,
  /\bgraduate\b/i,
];

const SENIOR_TITLE_PATTERNS = [
  /\bsenior\b/i,
  /\bsr\b/i,
  /\bstaff\b/i,
  /\bprincipal\b/i,
  /\blead\b/i,
  /\bmanager\b/i,
  /\bdirector\b/i,
  /\bvp\b/i,
  /head of/i,
];

const SPECIALIZED_TITLE_PATTERNS = [
  /\bembedded\b/i,
  /\bfirmware\b/i,
  /\bfpga\b/i,
  /\basic\b/i,
  /\brf\b/i,
  /\bmechanical\b/i,
  /\bcivil\b/i,
  /\bchemical\b/i,
  /electrical engineer/i,
];

const RESUME_PARSE_SYSTEM_PROMPT = `Extract a candidate profile from this resume. Respond ONLY with JSON:
{
  'skills': string[],        // list of technical skills mentioned
  'roles': string[],         // target role types: swe, ds, ml, ai, devops, security, pm, analyst, finance
  'level': string,           // 'new_grad', 'entry_level', or 'experienced'
  'graduation_year': number | null  // expected graduation year if mentioned
}`;

function getPercentileGrade(percentile: number): Grade {
  if (percentile < 0.10) return 'A';
  if (percentile < 0.25) return 'B';
  if (percentile < 0.50) return 'C';
  if (percentile < 0.75) return 'D';
  return 'F';
}

function getSimilarityFloorGrade(score: number): Grade {
  if (score >= 0.45) return 'C';
  if (score >= 0.30) return 'D';
  return 'F';
}

function maxGrade(a: Grade, b: Grade): Grade {
  return GRADE_RANK[a] >= GRADE_RANK[b] ? a : b;
}

function assignGrades(entries: Array<{ id: string; score: number }>): Map<string, Grade> {
  const gradeMap = new Map<string, Grade>();
  const n = entries.length;
  if (n === 0) return gradeMap;

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  sorted.forEach(({ id, score }, i) => {
    if (score < 0.15) {
      gradeMap.set(id, 'F');
      return;
    }

    const percentileGrade = getPercentileGrade(i / n);
    const floorGrade = getSimilarityFloorGrade(score);
    const grade = maxGrade(percentileGrade, floorGrade);
    gradeMap.set(id, grade);
  });

  return gradeMap;
}

interface ClaudeApiResponse {
  content?: Array<{ type: string; text?: string }>;
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function uniqueNormalizedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeRole(role: string): ParsedRole | null {
  const normalized = role.trim().toLowerCase();

  if (PROFILE_ROLE_SET.has(normalized as ParsedRole)) {
    return normalized as ParsedRole;
  }

  switch (normalized) {
    case 'software engineer':
    case 'software engineering':
    case 'software developer':
    case 'developer':
    case 'engineering':
      return 'swe';
    case 'data science':
    case 'data scientist':
      return 'ds';
    case 'machine learning':
      return 'ml';
    case 'artificial intelligence':
      return 'ai';
    case 'product manager':
    case 'product management':
      return 'pm';
    case 'data analyst':
    case 'business analyst':
      return 'analyst';
    default:
      return null;
  }
}

function coerceParsedProfile(raw: unknown): ParsedProfile | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const skills = Array.isArray(record.skills)
    ? uniqueNormalizedStrings(
        record.skills.filter((skill): skill is string => typeof skill === 'string')
      )
    : [];

  const roles = Array.isArray(record.roles)
    ? Array.from(
        new Set(
          record.roles
            .filter((role): role is string => typeof role === 'string')
            .map(normalizeRole)
            .filter((role): role is ParsedRole => role !== null)
        )
      )
    : DEFAULT_PARSED_PROFILE.roles;

  const level =
    record.level === 'new_grad' ||
    record.level === 'entry_level' ||
    record.level === 'experienced'
      ? record.level
      : DEFAULT_PARSED_PROFILE.level;

  const graduationYear =
    typeof record.graduation_year === 'number' && Number.isFinite(record.graduation_year)
      ? Math.trunc(record.graduation_year)
      : null;

  return {
    skills,
    roles,
    level,
    graduation_year: graduationYear,
  };
}

async function parseResumeProfile(
  resumeText: string,
  apiKey: string | undefined
): Promise<ParsedProfile> {
  if (!apiKey || !resumeText.trim()) {
    return DEFAULT_PARSED_PROFILE;
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        system: RESUME_PARSE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: resumeText,
          },
        ],
      }),
    });

    if (!res.ok) return DEFAULT_PARSED_PROFILE;

    const data = await res.json() as ClaudeApiResponse;
    const text =
      data.content?.find((block) => block.type === 'text')?.text ??
      data.content?.[0]?.text ??
      '';
    const parsed = JSON.parse(stripMarkdownCodeFence(text)) as unknown;

    return coerceParsedProfile(parsed) ?? DEFAULT_PARSED_PROFILE;
  } catch {
    return DEFAULT_PARSED_PROFILE;
  }
}

function titleMatchesAny(title: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(title));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSkillMatch(description: string, skill: string): boolean {
  const normalizedSkill = skill.trim().toLowerCase();
  if (!normalizedSkill) return false;

  const skillPattern = normalizedSkill
    .split(/\s+/)
    .map((part) => escapeRegex(part))
    .join('\\s+');

  return new RegExp(`(^|[^a-z0-9])${skillPattern}(?=[^a-z0-9]|$)`, 'i').test(description);
}

function countSkillMatches(description: string, skills: string[]): number {
  const matchedSkills = new Set<string>();

  for (const skill of skills) {
    if (hasSkillMatch(description, skill)) {
      matchedSkills.add(skill);
    }
  }

  return matchedSkills.size;
}

function clampCompatibilityScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function computeCompatibilityScore(
  job: JobForScoring | undefined,
  parsedProfile: ParsedProfile
): number {
  let score = 50;

  if (!job) {
    return score;
  }

  switch (job.experience_level) {
    case 'new_grad':
      score += 20;
      break;
    case 'entry_level':
      score += 15;
      break;
    case 'internship':
      score += 10;
      break;
    default:
      break;
  }

  const jobRoles = new Set(
    job.roles
      .filter((role): role is string => typeof role === 'string')
      .map(normalizeRole)
      .filter((role): role is ParsedRole => role !== null)
  );

  const overlapCount = new Set(parsedProfile.roles.filter((role) => jobRoles.has(role))).size;

  if (overlapCount >= 2) {
    score += 20;
  } else if (overlapCount === 1) {
    score += 10;
  } else if (
    jobRoles.has('swe') &&
    parsedProfile.roles.some((role) => TECH_ROLE_TYPES.has(role))
  ) {
    score += 5;
  }

  const title = job.title.toLowerCase();
  if (titleMatchesAny(title, ENTRY_LEVEL_TITLE_PATTERNS)) score += 10;
  if (titleMatchesAny(title, SENIOR_TITLE_PATTERNS)) score -= 30;
  if (titleMatchesAny(title, SPECIALIZED_TITLE_PATTERNS)) score -= 25;

  const description = job.description?.trim();
  if (!description) {
    score += 5;
    if (job.experience_level === 'new_grad' || job.experience_level === 'entry_level') {
      score += 10;
    }
    return clampCompatibilityScore(score);
  }

  const skillMatches = countSkillMatches(
    description.slice(0, 800).toLowerCase(),
    parsedProfile.skills
  );

  if (skillMatches >= 3) {
    score += 15;
  } else if (skillMatches >= 1) {
    score += 8;
  }

  return clampCompatibilityScore(score);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch profile — need resume_text for parsing and resume_embedding for cosine similarity
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

    let resumeEmbedding: number[];
    try {
      const raw = profile.resume_embedding as string | number[];
      resumeEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
    } catch {
      return NextResponse.json({ scores: {}, noResume: true });
    }

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

    const parsedProfile = await parseResumeProfile(
      ((profile.resume_text as string | null) ?? '').slice(0, 1200),
      process.env.ANTHROPIC_API_KEY
    );

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

    if (needsCompute.size === 0) {
      const scores: Record<string, { grade: string; similarity: number }> = {};
      for (const [id, value] of validCached) {
        scores[id] = value;
      }
      return NextResponse.json({ scores });
    }

    // ── Step 2: Compute raw similarities for stale / missing jobs ──
    const { data: jobs } = await admin
      .from('jobs')
      .select('id, title, description, roles, experience_level, embedding')
      .in('id', [...needsCompute]);

    const jobsForScoring = new Map<string, JobForScoring>();
    const recomputedSimilarities = new Map<string, number>();

    for (const job of jobs ?? []) {
      const id = job.id as string;

      jobsForScoring.set(id, {
        id,
        title: (job.title as string | null) ?? '',
        description: job.description as string | null,
        roles: Array.isArray(job.roles) ? (job.roles as string[]) : [],
        experience_level: (job.experience_level as string | null) ?? '',
      });

      if (!job.embedding) continue;

      let jobEmbedding: number[];
      try {
        const raw = job.embedding as string | number[];
        jobEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
      } catch {
        continue;
      }

      recomputedSimilarities.set(id, cosineSimilarity(resumeEmbedding, jobEmbedding));
    }

    // ── Step 3: Load all fresh cached similarities so percentile grading remains global ──
    const { data: allExisting } = await admin
      .from('job_scores')
      .select('job_id, similarity, computed_at')
      .eq('user_id', user.id);

    const allRawSimilarities = new Map<string, number>();

    for (const row of allExisting ?? []) {
      if (new Date(row.computed_at as string) <= profileUpdatedAt) continue;
      allRawSimilarities.set(row.job_id as string, row.similarity as number);
    }

    for (const [id, similarity] of recomputedSimilarities) {
      allRawSimilarities.set(id, similarity);
    }

    // Requested jobs without an embedding still get a zero raw similarity, but
    // deterministic compatibility scoring can still lift them above an F.
    const placeholderIds = new Set<string>();
    for (const id of jobIds) {
      if (!allRawSimilarities.has(id)) {
        allRawSimilarities.set(id, 0);
        placeholderIds.add(id);
      }
    }

    // ── Step 4: Load job metadata for every score participating in percentile grading ──
    const missingJobIds = [...allRawSimilarities.keys()].filter((id) => !jobsForScoring.has(id));
    if (missingJobIds.length > 0) {
      const { data: existingJobs } = await admin
        .from('jobs')
        .select('id, title, description, roles, experience_level')
        .in('id', missingJobIds);

      for (const job of existingJobs ?? []) {
        const id = job.id as string;
        jobsForScoring.set(id, {
          id,
          title: (job.title as string | null) ?? '',
          description: job.description as string | null,
          roles: Array.isArray(job.roles) ? (job.roles as string[]) : [],
          experience_level: (job.experience_level as string | null) ?? '',
        });
      }
    }

    // ── Step 5: Blend deterministic compatibility with cosine similarity ──
    const allEntries = [...allRawSimilarities.entries()].map(([id, rawSimilarity]) => {
      const compatibilityScore = computeCompatibilityScore(jobsForScoring.get(id), parsedProfile);
      const finalScore = compatibilityScore / 100 * 0.55 + rawSimilarity * 0.45;
      return { id, score: finalScore };
    });

    const gradeMap = assignGrades(allEntries);

    // ── Step 6: Upsert all real rows — grades may shift when new jobs are scored ──
    const now = new Date().toISOString();
    const upsertRows = [...allRawSimilarities.entries()]
      .filter(([id]) => !placeholderIds.has(id))
      .map(([id, rawSimilarity]) => ({
        user_id: user.id,
        job_id: id,
        similarity: rawSimilarity,
        grade: gradeMap.get(id) ?? 'F',
        computed_at: now,
      }));

    if (upsertRows.length > 0) {
      await admin
        .from('job_scores')
        .upsert(upsertRows, { onConflict: 'user_id,job_id' });
    }

    // ── Step 7: Return scores for the requested job IDs ──
    const scores: Record<string, { grade: string; similarity: number }> = {};
    for (const id of jobIds) {
      const similarity = allRawSimilarities.get(id);
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
