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

const INTERNSHIP_KEYWORDS = ['intern', 'internship', 'co-op', 'coop'];

const NEW_GRAD_KEYWORDS = [
  'new grad', 'new graduate', 'early career', '2025', '2026',
  'university grad', 'campus hire', 'junior',
  'associate engineer', 'associate developer', 'associate analyst', 'associate scientist',
  'software engineer 1', 'engineer 1', 'swe 1', 'sde 1', 'software developer 1',
];

const ENTRY_LEVEL_KEYWORDS = [
  'entry level', 'entry-level', '0-2 years', '0-3 years',
  '1-2 years', '1-3 years', 'no experience required',
  'recent graduate', 'recent grad',
];

/**
 * Test whether a word/phrase appears as a standalone token (word boundary) in a string.
 * Handles multi-word phrases by anchoring to word boundaries on each side.
 */
function hasWord(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(text);
}

/**
 * Returns true when the title clearly belongs to a senior/leadership role
 * that should be excluded from the entry-level feed.
 *
 * Rules:
 *  - "senior" or "sr." anywhere as standalone words
 *  - "staff engineer", "staff software" as phrases
 *  - "principal engineer", "principal software", "principal data" as phrases
 *  - "director", "vp of", "vice president", "head of" as standalone/phrases
 *  - "engineering manager" as a phrase
 *  - "product manager" ONLY when NOT accompanied by "associate" or "junior"
 *  - "distinguished", "fellow" as standalone words
 *
 * NOT excluded: "lead" alone, "manager" alone, "architect" alone.
 */
function isSeniorTitle(title: string): boolean {
  const t = title.toLowerCase();

  if (hasWord(t, 'senior')) return true;
  if (hasWord(t, 'sr\\.') || /\bsr\b/.test(t)) return true;

  if (t.includes('staff engineer') || t.includes('staff software')) return true;
  if (
    t.includes('principal engineer') ||
    t.includes('principal software') ||
    t.includes('principal data')
  ) return true;

  if (hasWord(t, 'director')) return true;
  if (t.includes('vp of') || hasWord(t, 'vp')) return true;
  if (t.includes('vice president')) return true;
  if (t.includes('head of')) return true;

  if (t.includes('engineering manager')) return true;

  if (t.includes('product manager')) {
    const hasJuniorSignal = t.includes('associate') || t.includes('junior');
    if (!hasJuniorSignal) return true;
  }

  if (hasWord(t, 'distinguished')) return true;
  if (hasWord(t, 'fellow')) return true;

  return false;
}

/**
 * Infer the experience level from a job title (and optional description).
 * Returns null when the role is clearly senior — callers should skip those jobs.
 *
 * Default behaviour (Step 2): when no explicit seniority signal is found,
 * returns 'entry_level' instead of null so that Greenhouse/Lever postings
 * without explicit level markers are still included.
 */
export function inferExperienceLevel(
  title: string,
  content?: string,
): ExperienceLevel | null {
  const t = title.toLowerCase();
  const c = (content ?? '').toLowerCase();

  // Step 1 — Internship takes top priority (before senior check).
  if (INTERNSHIP_KEYWORDS.some(k => t.includes(k))) return 'internship';

  // Step 1 — Senior exclusion.
  if (isSeniorTitle(t)) return null;

  // Step 2 — New grad signals in title.
  if (NEW_GRAD_KEYWORDS.some(k => t.includes(k))) return 'new_grad';

  // Step 2 — Entry-level signals in title or description.
  if (ENTRY_LEVEL_KEYWORDS.some(k => t.includes(k) || c.includes(k))) {
    return 'entry_level';
  }

  // Step 2 — Default: keep the job as entry_level.
  // Greenhouse/Lever boards are curated and typically don't carry explicit
  // seniority signals on legitimate junior postings.
  return 'entry_level';
}
