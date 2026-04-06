// Source: Workday ATS — used by thousands of large companies.
// Each company exposes a consistent JSON endpoint at:
//   POST https://{company}.wd5.myworkdayjobs.com/wday/cxs/{company}/{career-site}/jobs
// No API key required. Returns JSON directly.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const SEARCH_TERMS = [
  'software engineer',
  'data scientist',
  'machine learning',
  'data analyst',
  'software developer',
  'data engineer',
];

const WORKDAY_COMPANIES: [string, string][] = [
  // Big Tech
  ['amazon', 'Amazon_Jobs'],
  ['microsoft', 'microsoftcareers'],
  ['google', 'Google'],
  ['apple', 'Apple'],
  ['meta', 'Meta'],
  ['nvidia', 'NVIDIAExternalCareerSite'],
  ['intel', 'Intel'],
  ['qualcomm', 'qualcomm'],
  ['amd', 'AMD'],
  ['broadcom', 'broadcom'],

  // Enterprise Software
  ['salesforce', 'salesforce'],
  ['workday', 'workdaycareers'],
  ['servicenow', 'servicenow'],
  ['oracle', 'oracle'],
  ['sap', 'SAP'],
  ['adobe', 'adobe'],
  ['vmware', 'VMware'],
  ['citrix', 'citrix'],
  ['splunk', 'splunk'],
  ['palo-alto-networks', 'paloaltocareers'],

  // Finance / Banking
  ['jpmorgan', 'jpmorganchase'],
  ['goldmansachs', 'goldmansachs'],
  ['morganstanley', 'morganstanley'],
  ['bofa', 'bankofamerica'],
  ['wellsfargo', 'wellsfargo'],
  ['citi', 'citi'],
  ['blackrock', 'blackrock'],
  ['fidelity', 'fidelity'],
  ['schwab', 'schwab'],
  ['paypal', 'paypal'],
  ['visa', 'visa'],
  ['mastercard', 'mastercard'],

  // Healthcare / Pharma
  ['jnj', 'jnj'],
  ['pfizer', 'pfizer'],
  ['abbvie', 'abbvie'],
  ['merck', 'merck'],
  ['unitedhealth', 'uhg'],
  ['cigna', 'cigna'],
  ['cvs', 'cvs'],
  ['humana', 'humana'],

  // Consulting / Professional Services
  ['deloitte', 'deloittecareers'],
  ['pwc', 'pwc'],
  ['ey', 'ey'],
  ['kpmg', 'kpmg'],
  ['accenture', 'accenturecareers'],
  ['mckinsey', 'mckinsey'],
  ['bcg', 'bcg'],

  // Aerospace / Defense
  ['boeing', 'boeing'],
  ['lockheedmartin', 'lockheedmartin'],
  ['northropgrumman', 'northropgrumman'],
  ['raytheon', 'rtx'],
  ['generalelectric', 'ge'],
  ['ge', 'gecareers'],
  ['baesystems', 'baesystems'],
  ['l3harris', 'l3harris'],

  // Auto / Manufacturing
  ['gm', 'General_Motors'],
  ['ford', 'ford'],
  ['stellantis', 'stellantis'],
  ['tesla', 'tesla'],
  ['toyota', 'toyota'],
  ['honda', 'honda'],
  ['caterpillar', 'caterpillar'],
  ['johndeere', 'deere'],

  // Retail / Consumer
  ['walmart', 'walmart'],
  ['target', 'target'],
  ['homedepot', 'homedepot'],
  ['lowes', 'lowes'],
  ['costco', 'costco'],
  ['kroger', 'kroger'],
  ['nike', 'nike'],
  ['adidas', 'adidas'],

  // Media / Telecom
  ['comcast', 'comcast'],
  ['verizon', 'verizon'],
  ['att', 'att'],
  ['tmobile', 'tmobile'],
  ['disney', 'disney'],
  ['nbc', 'nbc'],
  ['fox', 'fox'],
  ['warnerbrosdiscovery', 'warnerbrosdiscovery'],

  // Other Tech
  ['uber', 'uber'],
  ['lyft', 'lyft'],
  ['airbnb', 'airbnb'],
  ['doordash', 'doordash'],
  ['instacart', 'instacart'],
  ['dropbox', 'dropbox'],
  ['box', 'box'],
  ['zendesk', 'zendesk'],
  ['hubspot', 'hubspot'],
  ['twilio', 'twilio'],
  ['cloudflare', 'cloudflare'],
  ['mongodb', 'mongodb'],
  ['elastic', 'elastic'],
  ['databricks', 'databricks'],
  ['snowflake', 'snowflake'],
  ['palantir', 'palantir'],
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Workday returns human-readable strings like "Posted 30+ Days Ago" or "Posted Today".
 * Convert to approximate ISO dates; return undefined when unparseable.
 */
function parseWorkdayDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  const now = Date.now();
  if (s.includes('today') || s.includes('just posted')) {
    return new Date(now).toISOString();
  }
  const daysAgo = s.match(/(\d+)\+?\s*day/);
  if (daysAgo) {
    return new Date(now - parseInt(daysAgo[1]) * 86_400_000).toISOString();
  }
  // Try parsing as ISO date directly (some Workday instances return ISO strings)
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface WorkdayJob {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
  jobPostingId?: string;
}

interface WorkdayResponse {
  jobPostings?: WorkdayJob[];
  total?: number;
}

async function fetchWorkdayJobs(
  company: string,
  careerSite: string,
  searchText: string,
): Promise<WorkdayJob[]> {
  const url = `https://${company}.wd5.myworkdayjobs.com/wday/cxs/${company}/${careerSite}/jobs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 20, offset: 0, searchText }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return [];

  const data: WorkdayResponse = await res.json();
  return data.jobPostings ?? [];
}

async function scrapeCompany(
  company: string,
  careerSite: string,
): Promise<NormalizedJob[]> {
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];

  for (const term of SEARCH_TERMS) {
    let postings: WorkdayJob[] = [];
    try {
      postings = await fetchWorkdayJobs(company, careerSite, term);
    } catch {
      // Non-200 or non-JSON — skip silently
      continue;
    }

    for (const posting of postings) {
      const title = posting.title ?? '';
      const location = posting.locationsText ?? '';
      const externalPath = posting.externalPath ?? '';

      const level = inferExperienceLevel(title);
      if (level === null) continue;

      const url = externalPath
        ? `https://${company}.wd5.myworkdayjobs.com${externalPath}`
        : `https://${company}.wd5.myworkdayjobs.com/en-US/${careerSite}/jobs`;

      const hash = generateHash(company, title, location);
      if (seen.has(hash)) continue;
      seen.add(hash);

      jobs.push({
        source: 'workday',
        source_id: posting.jobPostingId ?? externalPath,
        title,
        company: company.charAt(0).toUpperCase() + company.slice(1),
        location,
        remote: inferRemote(location),
        url,
        description: posting.bulletFields?.join(' ') ?? undefined,
        experience_level: level,
        roles: inferRoles(title),
        posted_at: parseWorkdayDate(posting.postedOn),
        dedup_hash: hash,
      });
    }

    await delay(100);
  }

  if (jobs.length > 0) {
    console.log(`  [workday] ${company}: ${jobs.length} jobs`);
  }

  return jobs;
}

export async function scrapeWorkday(): Promise<NormalizedJob[]> {
  const tasks = WORKDAY_COMPANIES.map(([company, careerSite], i) =>
    delay(i * 100).then(() => scrapeCompany(company, careerSite)),
  );

  const results = await Promise.allSettled(tasks);

  const all: NormalizedJob[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    }
  }

  return all;
}
