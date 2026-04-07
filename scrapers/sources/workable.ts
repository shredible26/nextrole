import { setTimeout as delay } from 'node:timers/promises';

import { generateHash } from '../utils/dedup';
import { isNonUsLocation } from '../utils/location';
import {
  hasTechTitleSignal,
  inferExperienceLevel,
  inferRemote,
  inferRoles,
  NormalizedJob,
} from '../utils/normalize';

const SOURCE = 'workable';
const REQUEST_TIMEOUT_MS = 8_000;
const WIDGET_BATCH_SIZE = 20;
const WIDGET_BATCH_DELAY_MS = 200;

const WORKABLE_COMPANIES = [
  'notion', 'linear', 'vercel', 'supabase', 'planetscale',
  'railway', 'render', 'fly', 'clerk', 'workos',
  'stytch', 'posthog', 'june', 'mixpanel', 'amplitude',
  'segment', 'rudderstack', 'airbyte', 'fivetran',
  'dbt', 'hightouch', 'census', 'hex', 'mode',
  'metabase', 'lightdash', 'preset', 'evidence',
  'streamlit', 'gradio', 'huggingface', 'replicate',
  'modal', 'banana', 'together', 'anyscale',
  'weights-biases', 'neptune', 'comet', 'mlflow',
  'bentoml', 'ray', 'feast', 'tecton',
  'pinecone', 'weaviate', 'qdrant', 'chroma',
  'langchain', 'llamaindex', 'dust', 'fixie',
  'sentry', 'honeycomb-io', 'grafana', 'elastic',
  'pagerduty', 'incident-io', 'rootly', 'firehydrant',
  'snyk', 'sonarqube', 'lacework', 'orca',
  'tailscale', 'netbird', 'twingate',
  'hashicorp', 'pulumi', 'terraform',
  'stripe', 'adyen', 'marqeta', 'lithic',
  'mercury', 'brex', 'ramp', 'airbase',
  'rippling', 'deel', 'remote', 'oyster',
  'gusto', 'justworks', 'lattice', 'leapsome',
  'intercom', 'zendesk', 'freshdesk', 'kustomer',
  'gong', 'chorus', 'salesloft', 'outreach',
  'hubspot', 'klaviyo', 'sendgrid', 'customer-io',
  'figma', 'framer', 'webflow', 'squarespace',
  'contentful', 'sanity', 'prismic', 'storyblok',
  'temporal', 'prefect', 'airflow', 'dagster',
  'anduril', 'palantir', 'scale', 'labelbox',
  'crowdstrike', 'sentinelone', 'cloudflare',
  'okta', 'jumpcloud', '1password', 'hashicorp',
  'docker', 'dataiku', 'databricks', 'snowflake',
  'airtable', 'clickup', 'asana', 'notion',
  'superhuman', 'loom', 'miro', 'mural',
  'pitch', 'tome', 'gamma', 'dovetail',
  'maze', 'usertesting', 'hotjar', 'fullstory',
  'logrocket', 'datadog', 'newrelic', 'dynatrace',
  'incident-io', 'statuspage', 'atlassian',
  'github', 'gitlab', 'sourcegraph', 'tabnine',
  'codeium', 'snyk', 'veracode', 'checkmarx',
  'zapier', 'make', 'tray', 'workato',
  'retool', 'appsmith', 'tooljet', 'budibase',
  'neon', 'turso', 'xata', 'fauna', 'convex',
  'upstash', 'liveblocks', 'partykit',
  'prisma', 'typeorm', 'drizzle',
  'vite', 'esbuild', 'swc', 'oxc', 'biome',
  'vitest', 'jest', 'playwright', 'cypress',
  'storybook', 'chromatic',
  'axiom', 'logflare', 'highlight',
  'opentelemetry', 'prometheus',
] as const;

const WORKABLE_SEARCH_TERMS = [
  'software engineer entry level',
  'data scientist entry level',
  'machine learning engineer entry level',
  'junior software engineer',
  'data analyst entry level',
  'product manager entry level',
  'devops engineer entry level',
] as const;

const US_COUNTRY_VALUES = new Set([
  'us',
  'usa',
  'united states',
  'united states of america',
]);

type WorkableLocation = {
  city?: string;
  region?: string | null;
  subregion?: string | null;
  country?: string | null;
  countryName?: string | null;
};

type WorkableCompany = {
  title?: string;
};

type WorkableJob = {
  shortcode?: string;
  id?: string;
  title?: string;
  department?: string;
  url?: string;
  location?: WorkableLocation;
  locations?: string[];
  remote?: boolean;
  workplace?: string;
  created_at?: string;
  created?: string;
  updated?: string;
  description?: string;
  requirementsSection?: string;
  benefitsSection?: string;
  socialSharingDescription?: string;
  company?: WorkableCompany;
};

type WorkableWidgetResponse = {
  name?: string;
  jobs?: WorkableJob[];
};

type WorkableSearchResponse = {
  jobs?: WorkableJob[];
};

type FetchJsonResult<T> = {
  status: number;
  data: T | null;
};

const stripHtml = (value: string): string =>
  value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function isLikelyTechTitle(title: string): boolean {
  return hasTechTitleSignal(title) || inferRoles(title).length > 0;
}

function normalizeCountry(country?: string | null): string | undefined {
  if (!country) return undefined;

  const trimmed = country.trim();
  const lower = trimmed.toLowerCase();
  if (US_COUNTRY_VALUES.has(lower)) return 'United States';
  return trimmed;
}

function isUsCountry(country?: string | null): boolean {
  if (!country) return false;
  return US_COUNTRY_VALUES.has(country.trim().toLowerCase());
}

function isWorkableRemote(job: WorkableJob): boolean {
  if (job.remote === true) return true;
  if (job.workplace?.toLowerCase() === 'remote') return true;
  return (job.locations ?? []).some(location => /remote|telecommute/i.test(location));
}

function buildWorkableLocation(job: WorkableJob): string | undefined {
  const values = new Set<string>();
  const location = job.location;

  if (location?.city) values.add(location.city.trim());
  if (location?.region) values.add(location.region.trim());
  if (location?.subregion) values.add(location.subregion.trim());

  for (const locationLabel of job.locations ?? []) {
    const trimmed = locationLabel.trim();
    if (!trimmed || /^telecommute$/i.test(trimmed)) continue;
    values.add(trimmed);
  }

  const country =
    normalizeCountry(location?.countryName) ??
    normalizeCountry(location?.country);
  if (country) values.add(country);

  const base = Array.from(values)
    .filter(Boolean)
    .join(', ');

  if (isWorkableRemote(job)) {
    return base ? `${base} (Remote)` : 'Remote';
  }

  return base || undefined;
}

function isUsOrRemoteWorkableJob(job: WorkableJob, location?: string): boolean {
  if (isWorkableRemote(job)) return true;

  if (isUsCountry(job.location?.country) || isUsCountry(job.location?.countryName)) {
    return true;
  }

  return location ? !isNonUsLocation(location) : false;
}

function buildWorkableDescription(job: WorkableJob): string | undefined {
  const parts = [
    job.description,
    job.requirementsSection,
    job.benefitsSection,
    job.socialSharingDescription,
  ]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return undefined;

  return stripHtml(parts.join(' ')) || undefined;
}

function extractWorkableShortcode(job: WorkableJob): string | undefined {
  if (job.shortcode?.trim()) return job.shortcode.trim();
  if (!job.url) return undefined;

  const match = job.url.match(/\/(?:j|view)\/([^/?#]+)/i);
  if (match?.[1]) return match[1];

  return job.id?.trim();
}

function mergeJobs(existing: NormalizedJob, next: NormalizedJob): NormalizedJob {
  return {
    ...existing,
    title: existing.title || next.title,
    company: existing.company || next.company,
    location: existing.location || next.location,
    remote: existing.remote || next.remote,
    url: existing.url || next.url,
    description:
      (next.description?.length ?? 0) > (existing.description?.length ?? 0)
        ? next.description
        : existing.description,
    experience_level:
      existing.experience_level === 'entry_level' && next.experience_level !== 'entry_level'
        ? next.experience_level
        : existing.experience_level,
    roles: existing.roles.length >= next.roles.length ? existing.roles : next.roles,
    posted_at: existing.posted_at || next.posted_at,
    source_id: existing.source_id || next.source_id,
  };
}

async function fetchJson<T>(url: string): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { status: response.status, data: null };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return { status: response.status, data: null };
    }

    const data = (await response.json()) as T;
    return { status: response.status, data };
  } catch {
    return { status: 0, data: null };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWorkableJob(job: WorkableJob, companyName?: string): NormalizedJob | null {
  const title = job.title?.trim();
  if (!title || !isLikelyTechTitle(title)) return null;

  const url = job.url?.trim();
  if (!url) return null;

  const location = buildWorkableLocation(job);
  if (!isUsOrRemoteWorkableJob(job, location)) return null;

  const description = buildWorkableDescription(job);
  const experienceLevel = inferExperienceLevel(title, description);
  if (experienceLevel === null) return null;

  const company = job.company?.title?.trim() || companyName?.trim();
  if (!company) return null;

  const remote = isWorkableRemote(job) || inferRemote(location);
  const sourceId = extractWorkableShortcode(job);

  return {
    source: SOURCE,
    source_id: sourceId,
    title,
    company,
    location,
    remote,
    url,
    description,
    experience_level: experienceLevel,
    roles: inferRoles(title),
    posted_at: job.created_at ?? job.created ?? job.updated,
    dedup_hash: generateHash(company, title, location ?? ''),
  };
}

async function fetchWorkableCompany(slug: string): Promise<NormalizedJob[]> {
  const { status, data } = await fetchJson<WorkableWidgetResponse>(
    `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
  );

  if (status === 404 || !data || !Array.isArray(data.jobs)) {
    return [];
  }

  const companyName = data.name?.trim();

  return data.jobs
    .map(job => normalizeWorkableJob(job, companyName))
    .filter((job): job is NormalizedJob => job !== null);
}

async function searchWorkable(term: string): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    q: term,
    location: 'United States',
    limit: '100',
  });

  const { data } = await fetchJson<WorkableSearchResponse>(
    `https://jobs.workable.com/api/v1/jobs?${params.toString()}`,
  );

  if (!data || !Array.isArray(data.jobs)) {
    return [];
  }

  return data.jobs
    .map(job => normalizeWorkableJob(job, job.company?.title))
    .filter((job): job is NormalizedJob => job !== null);
}

export async function scrapeWorkable(): Promise<NormalizedJob[]> {
  const jobMap = new Map<string, NormalizedJob>();
  const companySlugs = Array.from(new Set(WORKABLE_COMPANIES));
  let widgetUniqueCount = 0;
  let searchUniqueCount = 0;

  for (let index = 0; index < companySlugs.length; index += WIDGET_BATCH_SIZE) {
    const batch = companySlugs.slice(index, index + WIDGET_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fetchWorkableCompany));

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;

      for (const job of result.value) {
        const key = job.source_id || job.dedup_hash;
        const existing = jobMap.get(key);
        if (existing) {
          jobMap.set(key, mergeJobs(existing, job));
          continue;
        }

        jobMap.set(key, job);
        widgetUniqueCount += 1;
      }
    }

    if (index + WIDGET_BATCH_SIZE < companySlugs.length) {
      await delay(WIDGET_BATCH_DELAY_MS);
    }
  }

  const searchResults = await Promise.allSettled(
    WORKABLE_SEARCH_TERMS.map(searchWorkable),
  );

  for (const result of searchResults) {
    if (result.status !== 'fulfilled') continue;

    for (const job of result.value) {
      const key = job.source_id || job.dedup_hash;
      const existing = jobMap.get(key);
      if (existing) {
        jobMap.set(key, mergeJobs(existing, job));
        continue;
      }

      jobMap.set(key, job);
      searchUniqueCount += 1;
    }
  }

  console.log(`  [workable] Widget unique jobs: ${widgetUniqueCount}`);
  console.log(`  [workable] Search unique jobs: ${searchUniqueCount}`);
  console.log(`  [workable] Total unique jobs: ${jobMap.size}`);

  return Array.from(jobMap.values());
}
