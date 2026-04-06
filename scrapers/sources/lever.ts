// Source: https://api.lever.co/v0/postings/{company}?mode=json
// Fully public API — no auth, no key. Returns JSON postings for each company.
// Strategy: fire all company fetches concurrently; silently skip 404/500s.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const COMPANIES: Record<string, string> = {
  // Big Tech / Social
  'netflix': 'Netflix',
  'reddit': 'Reddit',
  'pinterest': 'Pinterest',
  'snap': 'Snap',
  'discord': 'Discord',
  'twitch': 'Twitch',

  // Ride / Delivery
  'lyft': 'Lyft',
  'doordash': 'DoorDash',
  'instacart': 'Instacart',
  'grubhub': 'Grubhub',

  // Fintech
  'affirm': 'Affirm',
  'wise': 'Wise',
  'remitly': 'Remitly',
  'brex': 'Brex',
  'mercury': 'Mercury',
  'ramp': 'Ramp',
  'gusto': 'Gusto',
  'rippling': 'Rippling',
  'zenefits': 'Zenefits',
  'carta': 'Carta',
  'capchase': 'Capchase',
  'moonpay': 'MoonPay',
  'fireblocks': 'Fireblocks',
  'anchorage': 'Anchorage Digital',
  'bitgo': 'BitGo',

  // Gaming / Entertainment
  'roblox': 'Roblox',
  'unity': 'Unity',
  'niantic': 'Niantic',
  'scopely': 'Scopely',
  'kabam': 'Kabam',
  'zynga': 'Zynga',
  'epicgames': 'Epic Games',

  // EV / Auto
  'rivian': 'Rivian',
  'lucid': 'Lucid Motors',
  'motional': 'Motional',

  // SaaS / Productivity
  'notion': 'Notion',
  'airtable': 'Airtable',
  'zapier': 'Zapier',
  'loom': 'Loom',
  'miro': 'Miro',
  'algolia': 'Algolia',
  'pipedrive': 'Pipedrive',
  'freshworks': 'Freshworks',
  'intercom': 'Intercom',
  'zendesk': 'Zendesk',
  'hubspot': 'HubSpot',
  'salesloft': 'Salesloft',
  'outreach': 'Outreach',
  'gong': 'Gong',
  'clari': 'Clari',
  'front': 'Front',
  'drift': 'Drift',

  // Security
  'lacework': 'Lacework',
  'wiz': 'Wiz',
  'axonius': 'Axonius',
  'abnormalsecurity': 'Abnormal Security',
  'hashicorp': 'HashiCorp',
  'snyk': 'Snyk',
  'detectify': 'Detectify',

  // Data / Analytics
  'fivetran': 'Fivetran',
  'airbyte': 'Airbyte',
  'dbtlabs': 'dbt Labs',
  'hightouch': 'Hightouch',
  'hex': 'Hex',
  'lightdash': 'Lightdash',

  // Healthcare
  'headspace': 'Headspace',
  'lyra': 'Lyra Health',
  'brightline': 'Brightline',
  'cityblock': 'Cityblock Health',
  'carbon-health': 'Carbon Health',

  // Climate
  'watershed': 'Watershed',
  'arcadia': 'Arcadia',
  'pachama': 'Pachama',

  // EdTech
  'duolingo': 'Duolingo',
  'quizlet': 'Quizlet',
  'chegg': 'Chegg',
  'brainly': 'Brainly',
  'outschool': 'Outschool',

  // Logistics
  'flexport': 'Flexport',
  'shipbob': 'ShipBob',
  'stord': 'Stord',
  'transfix': 'Transfix',
  'loadsmart': 'Loadsmart',

  // HR / Recruiting
  'gem': 'Gem',
  'checkr': 'Checkr',
  'paradox': 'Paradox',
  'beamery': 'Beamery',

  // Legal
  'clio': 'Clio',
  'ironclad': 'Ironclad',
  'filevine': 'Filevine',

  // Real Estate
  'opendoor': 'Opendoor',
  'compass': 'Compass',
  'crexi': 'CREXi',

  // Insurance
  'lemonade': 'Lemonade',
  'root': 'Root Insurance',
  'next-insurance': 'Next Insurance',
  'coalition': 'Coalition',

  // Other notable
  'canva': 'Canva',
  'grammarly': 'Grammarly',
  'descript': 'Descript',
  'superhuman': 'Superhuman',
  'linear': 'Linear',
  'raycast': 'Raycast',
  'framer': 'Framer',
  'webflow': 'Webflow',
  'bubble': 'Bubble',
  'retool': 'Retool',
  'airplane': 'Airplane',
  'posthog': 'PostHog',
  'launchdarkly': 'LaunchDarkly',
  'statsig': 'Statsig',
  'vanta': 'Vanta',
  'drata': 'Drata',
  'secureframe': 'Secureframe',
  'faire': 'Faire',
  'ankorstore': 'Ankorstore',
  'sendbird': 'Sendbird',
  'twilio-segment': 'Segment',
  'amplitude': 'Amplitude',
  'mixpanel': 'Mixpanel',
  'pendo': 'Pendo',
  'fullstory': 'FullStory',
  'heap': 'Heap',
  'appcues': 'Appcues',
};

const TECH_KEYWORDS = [
  'engineer', 'developer', 'scientist', 'analyst', 'ml', 'ai', 'data',
  'software', 'backend', 'frontend', 'fullstack', 'full stack', 'product manager',
];

function isTechRole(title: string): boolean {
  const lower = title.toLowerCase();
  return TECH_KEYWORDS.some(k => lower.includes(k));
}

async function fetchCompany(slug: string, companyName: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
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

  const entries = Object.entries(COMPANIES);
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(([slug, name]) => fetchCompany(slug, name)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      }
    }

    if (i + BATCH_SIZE < entries.length) {
      await sleep(DELAY_MS);
    }
  }

  return all;
}
