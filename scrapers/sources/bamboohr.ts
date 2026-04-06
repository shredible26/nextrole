// Source: https://{company}.bamboohr.com/jobs/embed2.php?version=1.0.0
// Free XML API — no auth required.
// Uses lightweight regex-based XML parsing (no xml2js or external packages).

import { generateHash } from '../utils/dedup';
import { inferRoles, inferExperienceLevel, NormalizedJob } from '../utils/normalize';

const COMPANIES: Record<string, string> = {
  // Tech
  'asana': 'Asana',
  'zendesk': 'Zendesk',
  'surveymonkey': 'SurveyMonkey',
  'momentive': 'Momentive',
  'glassdoor': 'Glassdoor',
  'eventbrite': 'Eventbrite',
  'yelp': 'Yelp',
  'grubhub': 'Grubhub',
  'shutterstock': 'Shutterstock',
  'squarespace': 'Squarespace',
  'wix': 'Wix',
  'godaddy': 'GoDaddy',
  'namecheap': 'Namecheap',
  'bluehost': 'Bluehost',
  'cloudways': 'Cloudways',
  'wpengine': 'WP Engine',
  'pantheon': 'Pantheon',
  'kinsta': 'Kinsta',
  'flywheel': 'Flywheel',
  // SaaS
  'freshworks': 'Freshworks',
  'zoho': 'Zoho',
  'pipedrive': 'Pipedrive',
  'copper': 'Copper',
  'insightly': 'Insightly',
  'nutshell': 'Nutshell',
  'close': 'Close',
  'activecampaign': 'ActiveCampaign',
  'drip': 'Drip',
  'convertkit': 'ConvertKit',
  'mailerlite': 'MailerLite',
  'moosend': 'Moosend',
  'omnisend': 'Omnisend',
  // E-commerce
  'bigcommerce': 'BigCommerce',
  'volusion': 'Volusion',
  'prestashop': 'PrestaShop',
  'magento': 'Magento',
  'netsuite': 'NetSuite',
  'lightspeed': 'Lightspeed',
  'square': 'Square',
  'toast': 'Toast',
  'touchbistro': 'TouchBistro',
  // Healthcare
  'athenahealth': 'athenahealth',
  'practicefusion': 'Practice Fusion',
  'drchrono': 'DrChrono',
  'kareo': 'Kareo',
  'netsmart': 'Netsmart',
  'pointclickcare': 'PointClickCare',
  'wellsky': 'WellSky',
  'healthstream': 'HealthStream',
  'definitivehc': 'Definitive Healthcare',
  // Finance
  'paylocity': 'Paylocity',
  'paychex': 'Paychex',
  'adp': 'ADP',
  'isolved': 'isolved',
  'bamboohr': 'BambooHR',
  'zenefits': 'Zenefits',
  'namely': 'Namely',
  'rippling': 'Rippling',
  // Education
  'instructure': 'Instructure',
  'blackboard': 'Blackboard',
  'd2l': 'D2L',
  'schoology': 'Schoology',
  'powerschool': 'PowerSchool',
  'renaissance': 'Renaissance',
  'edulastic': 'Edulastic',
  // Other
  'envoy': 'Envoy',
  'robin': 'Robin',
  'officespace': 'OfficeSpace',
  'condecosoftware': 'Condeco',
  'teem': 'Teem',
  'iofficecorp': 'iOffice',
  'spaceiq': 'SpaceIQ',
  'archibus': 'Archibus',
};

/**
 * Extracts the text content of an XML tag, handling CDATA sections.
 * Uses a simple regex approach — safe for BambooHR's predictable XML structure.
 */
function extractXmlField(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's')
  );
  return match?.[1]?.trim() ?? '';
}

/**
 * Parse all <job> blocks from a BambooHR XML response.
 */
function parseJobs(xml: string): Array<{
  id: string;
  title: string;
  location: string;
  department: string;
  url: string;
  datePosted: string;
}> {
  const jobs: ReturnType<typeof parseJobs> = [];
  const jobPattern = /<job>([\s\S]*?)<\/job>/g;
  let match;
  while ((match = jobPattern.exec(xml)) !== null) {
    const block = match[1];
    jobs.push({
      id:         extractXmlField(block, 'id'),
      title:      extractXmlField(block, 'title'),
      location:   extractXmlField(block, 'location'),
      department: extractXmlField(block, 'department'),
      url:        extractXmlField(block, 'url'),
      datePosted: extractXmlField(block, 'datePosted'),
    });
  }
  return jobs;
}

async function fetchCompany(subdomain: string, companyName: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(
      `https://${subdomain}.bamboohr.com/jobs/embed2.php?version=1.0.0`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) return [];

    const contentType = res.headers.get('content-type') ?? '';
    // BambooHR returns XML; skip HTML error pages silently
    if (!contentType.includes('xml') && !contentType.includes('text')) return [];

    const xml = await res.text();
    if (!xml.includes('<job>')) return [];

    const rawJobs = parseJobs(xml);
    const normalized: NormalizedJob[] = [];

    for (const job of rawJobs) {
      if (!job.title) continue;

      const level = inferExperienceLevel(job.title);
      if (level === null) continue;

      const location = job.location;
      const remote = location.toLowerCase().includes('remote');

      normalized.push({
        source: 'bamboohr',
        source_id: job.id,
        title: job.title,
        company: companyName,
        location: location || undefined,
        remote,
        url: job.url,
        experience_level: level,
        roles: inferRoles(job.title),
        posted_at: job.datePosted ? new Date(job.datePosted).toISOString() : undefined,
        dedup_hash: generateHash(companyName, job.title, location),
      });
    }

    if (normalized.length > 0) {
      console.log(`    [bamboohr] ${companyName}: ${normalized.length} jobs`);
    }
    return normalized;
  } catch {
    return [];
  }
}

export async function scrapeBambooHR(): Promise<NormalizedJob[]> {
  const entries = Object.entries(COMPANIES);
  const all: NormalizedJob[] = [];

  const results = await Promise.allSettled(
    entries.map(([subdomain, name]) => fetchCompany(subdomain, name))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    }
  }

  return all;
}
