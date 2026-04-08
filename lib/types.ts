export type ExperienceLevel = 'new_grad' | 'entry_level' | 'internship';
export type Role = 'swe' | 'ds' | 'ml' | 'ai' | 'analyst' | 'pm';
export type ApplicationStatus =
  | 'applied'
  | 'phone_screen'
  | 'oa'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type Job = {
  id: string;
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
  scraped_at: string;
  is_active: boolean;
  dedup_hash: string;
};

export type Application = {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
  notes?: string;
  auto_tracked: boolean;
  updated_at: string;
  job?: Job;
};

export type JobFilters = {
  roles: Role[];
  search: string;
  level: ExperienceLevel | '';
  remote: boolean;
  location: 'usa' | 'other' | '';
  postedWithin: '' | '1' | '3' | '7';
  sources: string[];
  page: number;
};

export const ROLE_COLORS: Record<Role, string> = {
  swe: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ds: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ml: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  ai: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  analyst: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  pm: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

export const ROLE_LABELS: Record<Role, string> = {
  swe: 'SWE',
  ds: 'DS',
  ml: 'ML',
  ai: 'AI',
  analyst: 'Analyst',
  pm: 'PM',
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  oa: 'OA',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
