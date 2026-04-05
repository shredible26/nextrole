export type ExperienceLevel = 'new_grad' | 'entry_level' | 'internship';
export type Role = 'SWE' | 'DS' | 'ML' | 'AI' | 'Analyst' | 'PM';

export type NormalizedJob = {
  source: string;
  source_id?: string;
  title: string;
  company: string;
  location?: string;
  remote: boolean;
  url: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  experience_level: ExperienceLevel;
  roles: Role[];
  posted_at?: string;
  dedup_hash: string;
};

const ROLE_KEYWORDS: Record<Role, string[]> = {
  SWE:     ['software engineer', 'software developer', 'swe', 'full stack',
             'fullstack', 'backend', 'frontend', 'web developer'],
  DS:      ['data scientist', 'data science'],
  ML:      ['machine learning', 'ml engineer', 'mlops'],
  AI:      ['ai engineer', 'artificial intelligence', 'deep learning', 'llm'],
  Analyst: ['data analyst', 'business analyst', 'analyst', 'business intelligence'],
  PM:      ['product manager', 'product management', ' pm '],
};

export function inferRoles(title: string): Role[] {
  const lower = title.toLowerCase();
  return (Object.entries(ROLE_KEYWORDS) as [Role, string[]][])
    .filter(([_, keywords]) => keywords.some(k => lower.includes(k)))
    .map(([role]) => role);
}

export function inferRemote(location?: string): boolean {
  if (!location) return false;
  return ['remote', 'anywhere', 'distributed', 'work from home', 'wfh']
    .some(k => location.toLowerCase().includes(k));
}

// Keywords that indicate a role is too senior — exclude entirely.
const SENIOR_KEYWORDS = [
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'director',
  'vp ', 'vice president', 'head of', 'manager', 'lead ', ' lead',
  'architect', 'distinguished', 'fellow',
];

// Exception: tech lead / team lead can pass if they also carry new_grad signals.
const LEAD_EXCEPTIONS = ['tech lead', 'team lead'];

const INTERNSHIP_KEYWORDS = ['intern', 'internship', 'co-op', 'coop', 'co op'];

const NEW_GRAD_KEYWORDS = [
  'new grad', 'new graduate', 'early career', 'entry',
  '2025', '2026', 'university grad', 'campus', 'junior', 'graduate',
];

const ENTRY_LEVEL_KEYWORDS = [
  'entry level', 'entry-level', '0-2 years', '0-3 years',
  '1-2 years', '1-3 years', 'no experience required',
];

/**
 * Infer the experience level from a job title (and optional description).
 * Returns null when the role is clearly mid/senior-level — callers should skip those jobs.
 */
export function inferExperienceLevel(
  title: string,
  content?: string,
): ExperienceLevel | null {
  const t = title.toLowerCase();
  const c = (content ?? '').toLowerCase();

  // Internship signals take top priority.
  if (INTERNSHIP_KEYWORDS.some(k => t.includes(k))) return 'internship';

  // Senior exclusion check.
  const isSenior = SENIOR_KEYWORDS.some(k => t.includes(k));
  if (isSenior) {
    // tech lead / team lead exception: only pass through with new_grad signals.
    const isLeadException = LEAD_EXCEPTIONS.some(e => t.includes(e));
    if (!isLeadException) return null;

    const isAssociate =
      t.includes('associate') &&
      ['engineer', 'developer', 'analyst'].some(r => t.includes(r));
    if (!isAssociate && !NEW_GRAD_KEYWORDS.some(k => t.includes(k))) return null;
    return 'new_grad';
  }

  // New grad signals in title.
  const isAssociate =
    t.includes('associate') &&
    ['engineer', 'developer', 'analyst'].some(r => t.includes(r));
  if (isAssociate || NEW_GRAD_KEYWORDS.some(k => t.includes(k))) {
    return 'new_grad';
  }

  // Entry-level signals in title or description.
  if (ENTRY_LEVEL_KEYWORDS.some(k => t.includes(k) || c.includes(k))) {
    return 'entry_level';
  }

  // No signal found — likely mid/senior, exclude.
  return null;
}
