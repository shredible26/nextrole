export const GITHUB_REPO_SOURCES = [
  'pittcsc',
  'simplify_internships',
  'vanshb03_newgrad',
  'vanshb03_internships',
  'ambicuity',
  'speedyapply_swe_newgrad',
  'speedyapply_ai_newgrad',
  'jobright_swe',
  'jobright_data',
  'jobright_business',
  'jobright_design',
  'jobright_marketing',
  'jobright_accounting',
  'jobright_pm',
  'zapplyjobs',
  'hackernews',
] as const;

export const JOB_BOARD_SOURCES = [
  'greenhouse',
  'lever',
  'workday',
  'workable',
  'smartrecruiters',
  'adzuna',
  'remoteok',
  'arbeitnow',
  'themuse',
  'jobspy_indeed',
  'builtin',
  'simplyhired',
  'dice',
  'workatastartup',
  'usajobs',
  'careerjet',
  'ashby',
  'recruitee',
] as const;

export const GITHUB_REPO_SOURCE_SET = new Set<string>(GITHUB_REPO_SOURCES);
export const JOB_BOARD_SOURCE_SET = new Set<string>(JOB_BOARD_SOURCES);
