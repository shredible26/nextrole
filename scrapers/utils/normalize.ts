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
