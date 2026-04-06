// Source: Workday ATS — used by thousands of large companies.
// Each company exposes a consistent JSON endpoint at:
//   POST https://{company}.{wdVersion}.myworkdayjobs.com/wday/cxs/{company}/{career-site}/jobs
// No API key required. Returns JSON directly.
// Different companies use different subdomain versions (wd1–wd12, wd100).

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

// Workday-specific senior/sales title signals not caught by inferExperienceLevel
const WORKDAY_TITLE_EXCLUSIONS = [
  'lead ',
  ' lead',
  'principal',
  'named account',
  'account executive',
  'account manager',
  'vice president',
  'vp ',
  ' vp,',
  'director',
  'head of',
  'chief',
  'president',
  'partner',
  'managing director',
  'solution architect',
  'solutions architect',
  'distinguished',
  'fellow',
];

// Non-US location signals — skip these to keep the feed US-focused
const NON_US_LOCATION_SIGNALS = [
  'india', 'bangalore', 'hyderabad', 'mumbai', 'chennai', 'pune',
  'berlin', 'london', 'toronto', 'montreal', 'sydney', 'singapore',
  'dublin', 'amsterdam', 'paris', 'tokyo', 'beijing', 'shanghai',
  ' uk', ' uk,', 'united kingdom', 'canada', 'australia',
  'germany', 'france', 'netherlands', 'ireland', 'mexico',
  'brazil', 'argentina', 'colombia', 'chile',
];

/**
 * Returns true if the job title contains a Workday-specific senior/sales signal.
 * Special case: 'consultant' is only excluded when NOT preceded by 'associate' or 'junior'.
 */
function isWorkdaySeniorTitle(title: string): boolean {
  const lower = ' ' + title.toLowerCase() + ' ';

  // Check the general exclusion list
  if (WORKDAY_TITLE_EXCLUSIONS.some(k => lower.includes(k))) return true;

  // Consultant check — skip unless prefixed with associate/junior
  if (lower.includes('consultant')) {
    const hasJuniorPrefix =
      lower.includes('associate consultant') ||
      lower.includes('junior consultant');
    if (!hasJuniorPrefix) return true;
  }

  return false;
}

/**
 * Returns true if the location signals a non-US office.
 * Keeps jobs that are US-based, remote, or have no clear location signal.
 */
function isNonUsLocation(location: string): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  if (lower.includes('remote') || lower.includes('united states') || lower.includes('usa')) {
    return false;
  }
  return NON_US_LOCATION_SIGNALS.some(signal => lower.includes(signal));
}

const SEARCH_TERMS = [
  'software engineer',
  'data scientist',
  'machine learning',
  'data analyst',
  'software developer',
  'data engineer',
  'entry level',
  'new grad',
  'associate engineer',
  'junior engineer',
  'early career',
  'technology analyst',
  'software engineer i',
  'systems engineer',
  'devops engineer',
  'cloud engineer',
  'product manager',
  'business analyst',
  'quantitative analyst',
];

// Workday subdomain versions to try in order
const WD_VERSIONS = ['wd1', 'wd2', 'wd3', 'wd4', 'wd5', 'wd6', 'wd7', 'wd8', 'wd10', 'wd12', 'wd100'];

const WORKDAY_COMPANIES: [string, string][] = [
  // Already verified working
  ['nvidia', 'NVIDIAExternalCareerSite'],
  ['visa', 'visa'],
  ['intel', 'external'],
  ['salesforce', 'External_Career_Site'],
  ['capitalone', 'Capital_One'],
  ['cigna', 'cignacareers'],
  ['crowdstrike', 'crowdstrikecareers'],
  ['pfizer', 'pfizercareers'],
  ['leidos', 'external'],

  // Big Tech
  ['amazon', 'Amazon_Jobs'],
  ['amazon', 'AmazonJobs'],
  ['microsoft', 'microsoftcareers'],
  ['apple', 'apple'],
  ['meta', 'Meta'],
  ['ibm', 'ibm'],
  ['oracle', 'oracle'],
  ['sap', 'SAP'],
  ['adobe', 'adobe'],
  ['vmware', 'VMware'],
  ['qualcomm', 'qualcomm'],
  ['amd', 'AMD'],
  ['broadcom', 'External_Career_Site'],
  ['micron', 'External_Career_Site'],
  ['ti', 'TICareers'],
  ['analog', 'analogdevices'],
  ['marvell', 'marvell'],

  // Enterprise Software
  ['workday', 'workdaycareers'],
  ['servicenow', 'servicenow'],
  ['splunk', 'splunk'],
  ['paloaltonetworks', 'External_Career_Site'],
  ['fortinet', 'fortinet'],
  ['f5', 'f5'],
  ['juniper', 'juniper'],
  ['arista', 'arista'],
  ['netapp', 'netapp'],
  ['purestorage', 'purestorage'],
  ['nutanix', 'nutanix'],
  ['commvault', 'commvault'],
  ['verint', 'verint'],
  ['opentext', 'opentext'],
  ['tibco', 'tibco'],
  ['informatica', 'informatica'],
  ['teradata', 'teradata'],
  ['solarwinds', 'solarwinds'],
  ['dynatrace', 'dynatrace'],
  ['elastic', 'elastic'],
  ['mongodb', 'mongodb'],
  ['cloudera', 'cloudera'],

  // Finance / Banking
  ['jpmorganchase', 'jpmorganchase'],
  ['goldmansachs', 'goldmansachs'],
  ['morganstanley', 'morganstanley'],
  ['bankofamerica', 'bankofamerica'],
  ['wellsfargo', 'wellsfargo'],
  ['citi', 'citi'],
  ['blackrock', 'blackrock'],
  ['fidelity', 'fidelitycareers'],
  ['schwab', 'schwab'],
  ['paypal', 'paypal'],
  ['mastercard', 'mastercard'],
  ['americanexpress', 'americanexpress'],
  ['discover', 'discover'],
  ['synchrony', 'synchrony'],
  ['ally', 'ally'],
  ['usbank', 'usbank'],
  ['pnc', 'pnc'],
  ['regions', 'regions'],
  ['truist', 'truist'],
  ['keybank', 'key'],
  ['citizens', 'citizensbank'],
  ['huntington', 'huntington'],
  ['comerica', 'comerica'],
  ['stifel', 'stifel'],
  ['tdbank', 'tdbank'],
  ['bmo', 'bmo'],
  ['nuveen', 'nuveen'],
  ['tiaa', 'tiaa'],
  ['vanguard', 'vanguard'],
  ['pimco', 'pimco'],
  ['invesco', 'invesco'],
  ['franklintempletonin', 'fti'],

  // Insurance
  ['aetna', 'aetna'],
  ['anthem', 'anthem'],
  ['unum', 'unum'],
  ['metlife', 'metlife'],
  ['prudential', 'prudential'],
  ['sunlife', 'sunlife'],
  ['manulife', 'manulife'],
  ['lincoln', 'lincolnfinancial'],
  ['principal', 'principal'],
  ['nationwide', 'nationwide'],
  ['progressive', 'progressive'],
  ['travelers', 'travelers'],
  ['cna', 'cna'],
  ['markel', 'markel'],

  // Healthcare / Pharma
  ['jnj', 'jnj'],
  ['abbvie', 'abbvie'],
  ['merck', 'merck'],
  ['lilly', 'lilly'],
  ['bms', 'bms'],
  ['astrazeneca', 'astrazeneca'],
  ['gsk', 'gsk'],
  ['novartis', 'novartis'],
  ['roche', 'roche'],
  ['sanofi', 'sanofi'],
  ['baxter', 'baxter'],
  ['becton', 'bd'],
  ['medtronic', 'medtronic'],
  ['stryker', 'stryker'],
  ['zimmer', 'zimmerbiomet'],
  ['edwards', 'edwards'],
  ['hologic', 'hologic'],
  ['danaher', 'danaher'],
  ['thermofisher', 'thermofisher'],
  ['illumina', 'illumina'],
  ['unitedhealth', 'uhg'],
  ['elevancehealth', 'elevancehealth'],
  ['humana', 'humana'],
  ['cvs', 'cvs'],
  ['mckesson', 'mckesson'],
  ['cardinal', 'cardinalhealth'],
  ['amerisource', 'amerisourcebergen'],
  ['cerner', 'cerner'],
  ['allscripts', 'allscripts'],
  ['athenahealth', 'athenahealth'],
  ['optum', 'uhg'],

  // Consulting / Professional Services
  ['deloitte', 'dttcareers'],
  ['pwc', 'pwc'],
  ['ey', 'ey'],
  ['kpmg', 'kpmg'],
  ['accenture', 'accenturecareers'],
  ['booz', 'bah'],
  ['saic', 'saic'],
  ['caci', 'caci'],
  ['gartner', 'gartner'],
  ['iqvia', 'iqvia'],
  ['cognizant', 'cognizant'],
  ['infosys', 'infosys'],
  ['wipro', 'wipro'],
  ['hcltech', 'hcltech'],
  ['capgemini', 'capgemini'],
  ['dxc', 'dxc'],
  ['unisys', 'unisys'],

  // Aerospace / Defense
  ['boeing', 'boeing'],
  ['lockheedmartin', 'lockheedmartin'],
  ['northropgrumman', 'northropgrumman'],
  ['rtx', 'rtx'],
  ['ge', 'gecareers'],
  ['gehealthcare', 'gehealthcare'],
  ['geaerospace', 'geaerospace'],
  ['l3harris', 'l3harris'],
  ['baesystems', 'baesystems'],
  ['textron', 'textron'],
  ['collins', 'collinsaerospace'],
  ['honeywell', 'honeywell'],
  ['parker', 'parker'],
  ['emerson', 'emerson'],
  ['eaton', 'eaton'],
  ['curtisswright', 'curtisswright'],

  // Auto / EV / Manufacturing
  ['gm', 'General_Motors'],
  ['ford', 'ford'],
  ['stellantis', 'stellantis'],
  ['toyota', 'toyota'],
  ['honda', 'honda'],
  ['bmw', 'bmw'],
  ['volvo', 'volvo'],
  ['caterpillar', 'caterpillar'],
  ['deere', 'deere'],
  ['cummins', 'cummins'],
  ['aptiv', 'aptiv'],
  ['borgwarner', 'borgwarner'],
  ['3m', '3M'],
  ['ppg', 'ppg'],
  ['sherwinwilliams', 'sherwinwilliams'],
  ['rockwellautomation', 'rockwellautomation'],
  ['siemens', 'siemens'],
  ['abb', 'abb'],
  ['schneider', 'schneiderelectric'],
  ['roper', 'roper'],
  ['ametek', 'ametek'],
  ['xylem', 'xylem'],
  ['idex', 'idex'],
  ['graco', 'graco'],
  ['nordson', 'nordson'],
  ['dover', 'dover'],
  ['illinois', 'itw'],
  ['pentair', 'pentair'],
  ['flowserve', 'flowserve'],

  // Retail / Consumer
  ['walmart', 'walmart'],
  ['target', 'target'],
  ['homedepot', 'homedepot'],
  ['lowes', 'lowes'],
  ['costco', 'costco'],
  ['kroger', 'kroger'],
  ['albertsons', 'albertsons'],
  ['nike', 'nike'],
  ['pvh', 'pvh'],
  ['hanesbrands', 'hanesbrands'],
  ['gap', 'gap'],
  ['kohls', 'kohls'],
  ['nordstrom', 'nordstrom'],
  ['tjx', 'tjx'],
  ['bestbuy', 'bestbuy'],
  ['autozone', 'autozone'],
  ['carmax', 'carmax'],

  // Media / Telecom
  ['comcast', 'comcast'],
  ['verizon', 'verizon'],
  ['att', 'att'],
  ['tmobile', 'tmobile'],
  ['charter', 'charter'],
  ['lumen', 'lumen'],
  ['disney', 'disney'],
  ['nbcuniversal', 'nbcuniversal'],
  ['paramount', 'paramount'],
  ['fox', 'fox'],
  ['discovery', 'discovery'],
  ['amcnetworks', 'amcnetworks'],
  ['iheartmedia', 'iheartmedia'],

  // Tech / Software
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
  ['databricks', 'databricks'],
  ['snowflake', 'snowflake'],
  ['palantir', 'palantir'],
  ['nuance', 'nuance'],
  ['veeva', 'veeva'],
  ['guidewire', 'guidewire'],
  ['paylocity', 'paylocity'],
  ['adp', 'adp'],
  ['paychex', 'paychex'],
  ['ceridian', 'ceridian'],
  ['medallia', 'medallia'],
  ['qualtrics', 'qualtrics'],
  ['sprinklr', 'sprinklr'],
  ['meltwater', 'meltwater'],

  // Energy / Utilities
  ['exxonmobil', 'exxonmobil'],
  ['chevron', 'chevron'],
  ['conocophillips', 'conocophillips'],
  ['shell', 'shell'],
  ['bp', 'bp'],
  ['halliburton', 'halliburton'],
  ['schlumberger', 'slb'],
  ['baker', 'bakerhughes'],
  ['duke-energy', 'duke'],
  ['dominion', 'dominionenergy'],
  ['southern', 'southerncompany'],
  ['nexteraenergy', 'nexteraenergy'],
  ['exelon', 'exelon'],
  ['firstenergy', 'firstenergy'],
  ['dte', 'dte'],
  ['cms', 'cmsenergy'],
  ['ameren', 'ameren'],
  ['entergy', 'entergy'],
  ['alliant', 'alliantenergy'],
  ['avangrid', 'avangrid'],
  ['sempra', 'sempra'],
  ['centerpoint', 'centerpointenergy'],
  ['atmos', 'atmosenergy'],
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

/**
 * Build slug variations to try for a given company + career site.
 */
function slugVariations(company: string, careerSite: string): string[] {
  const unique = new Set<string>();
  const add = (s: string) => unique.add(s);

  add(careerSite);
  add(`${careerSite}_External`);
  add('External_Career_Site');
  add('externalcareers');
  add('careers');
  add('Careers');
  add('external');
  add('External');
  add(`${company}careers`);

  return Array.from(unique);
}

/**
 * Try all (wdVersion, slug) combinations until one returns HTTP 200 with valid JSON
 * containing a jobPostings array. Returns the jobs plus the working (wdVersion, slug).
 * Times out each attempt after 5 seconds.
 */
async function tryWorkdayCompany(
  company: string,
  careerSite: string,
  searchText: string,
): Promise<{ jobs: WorkdayJob[]; wdVersion: string; slug: string } | null> {
  const slugs = slugVariations(company, careerSite);

  for (const wdVersion of WD_VERSIONS) {
    for (const slug of slugs) {
      const url = `https://${company}.${wdVersion}.myworkdayjobs.com/wday/cxs/${company}/${slug}/jobs`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);

        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 20, offset: 0, searchText }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) continue;

        const data: WorkdayResponse = await res.json();
        if (!Array.isArray(data.jobPostings)) continue;

        return { jobs: data.jobPostings, wdVersion, slug };
      } catch {
        // Timeout, network error, JSON parse error — try next combination
        continue;
      }
    }
  }

  return null;
}

async function scrapeCompany(
  company: string,
  careerSite: string,
): Promise<NormalizedJob[]> {
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];

  // Discover which (wdVersion, slug) pair works using the first search term
  let foundVersion: string | null = null;
  let foundSlug: string | null = null;

  for (const term of SEARCH_TERMS) {
    let result: { jobs: WorkdayJob[]; wdVersion: string; slug: string } | null = null;

    if (foundVersion && foundSlug) {
      // Re-use the working combination for subsequent search terms
      const url = `https://${company}.${foundVersion}.myworkdayjobs.com/wday/cxs/${company}/${foundSlug}/jobs`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 20, offset: 0, searchText: term }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) {
          const contentType = res.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) {
            const data: WorkdayResponse = await res.json();
            if (Array.isArray(data.jobPostings)) {
              result = { jobs: data.jobPostings, wdVersion: foundVersion, slug: foundSlug };
            }
          }
        }
      } catch {
        // skip
      }
    } else {
      result = await tryWorkdayCompany(company, careerSite, term);
      if (result) {
        foundVersion = result.wdVersion;
        foundSlug = result.slug;
      }
    }

    if (!result) continue;

    const { jobs: postings, wdVersion, slug } = result;

    for (const posting of postings) {
      const title = posting.title ?? '';
      const location = posting.locationsText ?? '';
      const externalPath = posting.externalPath ?? '';

      const level = inferExperienceLevel(title);
      if (level === null) continue;

      // Workday-specific: skip senior/sales titles not caught by inferExperienceLevel
      if (isWorkdaySeniorTitle(title)) continue;

      // Skip non-US locations
      if (isNonUsLocation(location)) continue;

      const baseHost = `https://${company}.${wdVersion}.myworkdayjobs.com`;
      const url = externalPath
        ? `${baseHost}${externalPath}`
        : `${baseHost}/en-US/${slug}/jobs`;

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
    console.log(`  [workday] ${company} (${foundVersion}/${foundSlug}): ${jobs.length} jobs`);
  }

  return jobs;
}

export async function scrapeWorkday(): Promise<NormalizedJob[]> {
  const tasks = WORKDAY_COMPANIES.map(([company, careerSite], i) =>
    delay(i * 150).then(() => scrapeCompany(company, careerSite)),
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
