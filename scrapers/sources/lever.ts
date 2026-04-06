// Source: https://api.lever.co/v0/postings/{company}?mode=json
// Fully public API — no auth, no key. Returns JSON postings for each company.
// Strategy: fire all company fetches concurrently; silently skip 404/500s.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const COMPANIES = [
  // Social / Consumer
  'netflix', 'reddit', 'pinterest', 'snap',
  'tiktok', 'bytedance', 'discord',

  // Music / Media / Entertainment
  'spotify', 'soundcloud', 'deezer',
  'twitch', 'streamlabs', 'restream',
  'vimeo', 'wistia', 'vidyard',

  // Gaming
  'epicgames', 'roblox', 'unity', 'niantic', 'scopely',
  'kabam', 'jam-city', 'glu', 'zynga', 'plarium',

  // Ride / Delivery / Food
  'lyft', 'doordash', 'grubhub', 'gopuff', 'instacart',
  'rappi', 'getir', 'deliveroo', 'gorillas',

  // Fintech / Payments
  'shopify', 'affirm', 'klarna', 'zip', 'sezzle',
  'wise', 'remitly', 'sendbird', 'paysend',
  'capchase', 'pipe', 'clearco', 'lighter-capital',
  'rippling', 'gusto', 'zenefits', 'bamboohr',
  'wyre', 'moonpay', 'bitpay',
  'fireblocks', 'anchorage', 'bitgo',

  // Auto / EV / Mobility
  'rivian', 'lucid', 'canoo', 'fisker', 'arrival',
  'motional', 'mobileye', 'comma', 'ghost',
  'lime', 'bird', 'spin', 'superpedestrian',

  // SaaS / Productivity Tools
  'notion', 'coda', 'roamresearch',
  'loom', 'mmhmm',
  'airtable', 'smartsheet', 'quickbase',
  'zapier', 'make', 'n8n', 'pipedream', 'workato',
  'tines', 'torq', 'swimlane',
  'algolia', 'typesense', 'meilisearch',

  // Security
  'lacework', 'orca-security', 'wiz', 'axonius',
  'abnormal', 'proofpoint', 'mimecast', 'sublime',
  'hashicorp', '1password', 'bitwarden', 'keeper',
  'vulncheck', 'nuclei', 'detectify',

  // Data / Analytics
  'fivetran', 'airbyte', 'meltano',
  'dbtlabs', 'paradime', 'lightdash', 'preset',
  'hex', 'deepnote', 'observable', 'evidence',
  'hightouch', 'census', 'polytomic', 'grouparoo',

  // Healthcare / Mental Health
  'oscar-health', 'devoted-health', 'cityblock',
  'headspace', 'brightline', 'woebot', 'lyra',
  'ro-health', 'hims-hers', 'nurx', 'done',
  'wheel', 'carbon-health', 'dr-chrono',

  // Climate / Sustainability
  'watershed', 'plan-a', 'normative', 'sweep', 'emitwise',
  'arcadia-power', 'octopus-energy', 'ovo-energy',
  'pachama', 'terrasos', 'terrawatch',

  // EdTech
  'duolingo', 'quizlet', 'chegg', 'brainly',
  'coursehero', 'studocu', 'khanmigo',
  'synthesis', 'outschool', 'primer',

  // Logistics / Supply Chain
  'flexport', 'stord', 'shipbob', 'shiphero',
  'project44', 'fourkites', 'elementum',
  'transfix', 'loadsmart', 'convoy',

  // HR / Recruiting
  'greenhouse-software', 'lever-recruiting', 'ashby-hq',
  'gem', 'fetcher', 'beamery', 'paradox',
  'checkr', 'hireright', 'sterling',

  // Legal / Compliance
  'clio', 'mycase', 'filevine', 'litify',
  'ironclad', 'contractpodai', 'evisort',

  // Real Estate
  'opendoor', 'offerpad', 'homeward', 'orchard',
  'compass', 'side', 'real-brokerage',
  'costar', 'crexi', 'vts',

  // Insurance
  'lemonade', 'root', 'hippo', 'branch',
  'next-insurance', 'coalition', 'at-bay',

  // Other Notable
  'canva', 'grammarly', 'jasper', 'copy-ai',
  'descript', 'otter', 'fireflies', 'fathom',
  'superhuman', 'shortwave', 'mimestream',
  'linear', 'height', 'plane', 'cycle',
  'raycast', 'alfred', 'espanso',
];

const TECH_KEYWORDS = [
  'engineer', 'developer', 'scientist', 'analyst', 'ml', 'ai', 'data',
  'software', 'backend', 'frontend', 'fullstack', 'full stack', 'product manager',
];

function isTechRole(title: string): boolean {
  const lower = title.toLowerCase();
  return TECH_KEYWORDS.some(k => lower.includes(k));
}

async function fetchCompany(company: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${company}?mode=json`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return []; // company not on Lever — skip silently

    const jobs: any[] = await res.json();
    if (!Array.isArray(jobs)) return [];

    const normalized: NormalizedJob[] = [];
    for (const job of jobs) {
      if (!isTechRole(job.text ?? '')) continue;
      const description = job.descriptionPlain ?? job.description ?? undefined;
      const level = inferExperienceLevel(job.text ?? '', description);
      if (level === null) continue;

      const location: string = job.categories?.location ?? job.categories?.allLocations?.[0] ?? '';
      // Lever doesn't return company name in the posting — derive from slug
      const companyName = company.charAt(0).toUpperCase() + company.slice(1);
      normalized.push({
        source: 'lever',
        source_id: job.id ?? '',
        title: job.text ?? '',
        company: companyName,
        location,
        remote: inferRemote(location),
        url: job.hostedUrl ?? '',
        description,
        experience_level: level,
        roles: inferRoles(job.text ?? ''),
        // createdAt is Unix milliseconds
        posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        dedup_hash: generateHash(companyName, job.text ?? '', location),
      });
    }
    return normalized;
  } catch {
    return []; // timeout or network error — skip silently
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrapeLever(): Promise<NormalizedJob[]> {
  const BATCH_SIZE = 10;
  const DELAY_MS = 200;
  const all: NormalizedJob[] = [];

  for (let i = 0; i < COMPANIES.length; i += BATCH_SIZE) {
    const batch = COMPANIES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fetchCompany));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      }
    }

    if (i + BATCH_SIZE < COMPANIES.length) {
      await sleep(DELAY_MS);
    }
  }

  return all;
}
