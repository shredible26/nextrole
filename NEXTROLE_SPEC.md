# NexTRole — Product Specification

> AI-powered new grad job aggregator with automatic application tracking.
> Stack: Next.js 14 (App Router) + Supabase + Stripe + Playwright scrapers via GitHub Actions

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema](#4-database-schema)
5. [Scraper Architecture](#5-scraper-architecture)
6. [API Routes](#6-api-routes)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [Free vs Pro Quota Logic](#8-free-vs-pro-quota-logic)
9. [Auto Application Tracking](#9-auto-application-tracking)
10. [Stripe Integration](#10-stripe-integration)
11. [GitHub Actions Cron](#11-github-actions-cron)
12. [Environment Variables](#12-environment-variables)
13. [Build Order / Milestones](#13-build-order--milestones)
14. [First Cursor Build Prompt](#14-first-cursor-build-prompt)

---

## 1. Product Overview

**NexTRole** aggregates new grad and entry-level tech job postings from multiple sources into one clean, filterable feed. Users get automatic application tracking whenever they click Apply. Free users see 20 jobs/day; Pro users ($15/mo or $99/yr) get unlimited access, email alerts, AI match scoring, and CSV export.

### Target User
- Current CS/DS/ML undergrads looking for new grad roles
- Recent grads (0–2 YOE) looking for entry-level SWE / DS / ML / AI / Analyst roles

### Core Value Props
1. One feed, multiple sources — no more checking 6+ sites daily
2. Zero-friction application tracking — auto-logged on every Apply click
3. AI match scoring against uploaded resume (Pro)
4. Clean, fast, no-noise UI built specifically for new grads

---

## 2. Scraper Sources Master List

All sources tracked here with status, method, legal risk, and which week they ship.

| # | Source | Week | Method | Legal Risk | Notes |
|---|--------|------|--------|------------|-------|
| 1 | SimplifyJobs / New-Grad-Positions | 1 | GitHub raw JSON | None | Main source. Best new grad coverage. |
| 2 | SimplifyJobs / Summer2026-Internships | 1 | GitHub raw JSON | None | Same repo format, just internships. |
| 3 | Adzuna API | 1 | Official free API | None | Register at developer.adzuna.com |
| 4 | RemoteOK API | 1 | Public API, no key | None | Remote-only jobs. |
| 5 | Arbeitnow API | 1 | Public API, no key | None | Good EU + remote coverage. |
| 6 | The Muse API | 1 | Public API, optional key | None | Entry-level focused. |
| 7 | Jobright.ai | 2 | Playwright scraper | Medium | AI-curated new grad jobs. High value. |
| 8 | Otta (Workable) | 2 | Playwright scraper | Medium | Good startup coverage. |
| 9 | Levels.fyi | 2 | Playwright scraper | Medium | Comp data + job listings. |
| 10 | LinkedIn | 3 | Playwright + proxy | High | Largest source. Needs Brightdata proxy. |
| 11 | Indeed / Glassdoor | 3 | Playwright + proxy | High | High volume. Aggressive bot detection. |
| 12 | Handshake | 3 | Playwright + proxy | High | Student-focused. May need .edu email. |
| 13 | Wellfound (AngelList) | 3 | Playwright scraper | Medium | Startup jobs. Has public API-ish endpoints. |
| 14 | Dice | 3 | Playwright scraper | Medium | Tech-specific. Has RSS feeds worth trying. |

**Week 1 = no proxy, no auth, no legal risk. Get real data flowing first.**
**Week 2 = Playwright but no proxy required.**
**Week 3 = full proxy rotation, highest-value but highest-maintenance sources.**

---

## 3. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) | SSR for SEO on job pages, great DX |
| Styling | Tailwind CSS + shadcn/ui | Fast, clean, consistent |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) | Familiar from Pumped |
| Payments | Stripe | Industry standard, easy webhooks |
| Scrapers | Playwright + Crawlee (Node.js) | Handles JS-heavy sites |
| Scraper scheduling | GitHub Actions (cron) | Free, no extra infra needed |
| Proxy (Week 3) | Brightdata (start with free trial) | Required for LinkedIn/Indeed |
| Deployment | Vercel | Free tier, native Next.js support |
| Package manager | pnpm | Fast |

---

## 4. Repository Structure

```
nextrole/
├── .github/
│   └── workflows/
│       └── scrape.yml                    # Daily cron job
├── app/                                  # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                          # Landing page
│   ├── jobs/
│   │   ├── page.tsx                      # Main job feed
│   │   └── [id]/
│   │       └── page.tsx                  # Individual job page (SEO)
│   ├── tracker/
│   │   └── page.tsx                      # Application tracker
│   ├── pricing/
│   │   └── page.tsx                      # Pricing page
│   ├── settings/
│   │   └── page.tsx                      # Resume upload, preferences
│   └── api/
│       ├── jobs/
│       │   └── route.ts                  # Job feed API (quota enforced)
│       ├── apply/
│       │   └── route.ts                  # Log application click
│       ├── applications/
│       │   └── [id]/
│       │       └── route.ts              # Update application status
│       ├── stripe/
│       │   ├── checkout/route.ts
│       │   └── webhook/route.ts
│       └── upload-resume/
│           └── route.ts
├── components/
│   ├── ui/                               # shadcn primitives
│   ├── JobCard.tsx
│   ├── JobFeed.tsx
│   ├── FilterSidebar.tsx
│   ├── ApplicationTracker.tsx
│   ├── QuotaBanner.tsx
│   └── UpgradeModal.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client
│   │   └── server.ts                     # Server Supabase client (RSC)
│   ├── stripe.ts
│   └── utils.ts
├── scrapers/
│   ├── index.ts                          # Orchestrator — runs all active scrapers
│   ├── base.ts                           # Shared Playwright setup + proxy config
│   ├── utils/
│   │   ├── dedup.ts                      # MD5 hash for deduplication
│   │   ├── normalize.ts                  # Shared types + role/remote inference
│   │   └── upload.ts                     # Supabase upsert + stale job cleanup
│   └── sources/
│       │
│       │   ── WEEK 1: No-risk sources (GitHub JSON + free APIs) ──
│       ├── pittcsc.ts                    # SimplifyJobs New-Grad-Positions (GitHub JSON)
│       ├── simplify-internships.ts       # SimplifyJobs Summer2026-Internships (GitHub JSON)
│       ├── adzuna.ts                     # Adzuna official API
│       ├── remoteok.ts                   # RemoteOK public API
│       ├── arbeitnow.ts                  # Arbeitnow public API
│       ├── themuse.ts                    # The Muse public API
│       │
│       │   ── WEEK 2: Playwright scrapers (no proxy needed) ──
│       ├── jobright.ts                   # Jobright.ai — PLACEHOLDER
│       ├── otta.ts                       # Otta (Workable) — PLACEHOLDER
│       ├── levels.ts                     # Levels.fyi — PLACEHOLDER
│       │
│       │   ── WEEK 3: Playwright + proxy (high value, high maintenance) ──
│       ├── linkedin.ts                   # LinkedIn — PLACEHOLDER
│       ├── indeed.ts                     # Indeed — PLACEHOLDER
│       ├── handshake.ts                  # Handshake — PLACEHOLDER
│       ├── wellfound.ts                  # Wellfound (AngelList) — PLACEHOLDER
│       └── dice.ts                       # Dice — PLACEHOLDER
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.local.example
├── NEXTROLE_SPEC.md                      # This file
├── package.json
└── tsconfig.json
```

---

## 5. Database Schema

```sql
-- supabase/migrations/001_initial_schema.sql

-- ─────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────
CREATE TABLE jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,
  source_id        TEXT,
  title            TEXT NOT NULL,
  company          TEXT NOT NULL,
  location         TEXT,
  remote           BOOLEAN DEFAULT false,
  url              TEXT NOT NULL,
  description      TEXT,
  salary_min       INT,
  salary_max       INT,
  experience_level TEXT CHECK (experience_level IN ('new_grad', 'entry_level', 'internship')),
  roles            TEXT[],   -- ['SWE', 'DS', 'ML', 'AI', 'Analyst', 'PM']
  posted_at        TIMESTAMPTZ,
  scraped_at       TIMESTAMPTZ DEFAULT now(),
  is_active        BOOLEAN DEFAULT true,
  dedup_hash       TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_jobs_posted_at      ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_experience     ON jobs(experience_level);
CREATE INDEX idx_jobs_roles          ON jobs USING GIN(roles);
CREATE INDEX idx_jobs_remote         ON jobs(remote);
CREATE INDEX idx_jobs_is_active      ON jobs(is_active);
CREATE INDEX idx_jobs_source         ON jobs(source);

-- ─────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email                  TEXT,
  full_name              TEXT,
  avatar_url             TEXT,
  tier                   TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  resume_url             TEXT,
  jobs_viewed_today      INT NOT NULL DEFAULT 0,
  last_reset_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- APPLICATION TRACKING
-- ─────────────────────────────────────────
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'applied'
                  CHECK (status IN (
                    'applied', 'phone_screen', 'oa',
                    'interview', 'offer', 'rejected', 'withdrawn'
                  )),
  applied_at    TIMESTAMPTZ DEFAULT now(),
  notes         TEXT,
  auto_tracked  BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user   ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;

-- Jobs: public read
CREATE POLICY "Jobs are publicly readable"
  ON jobs FOR SELECT USING (true);

-- Profiles: users see and edit only their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Applications: users manage only their own
CREATE POLICY "Users can manage own applications"
  ON applications FOR ALL USING (auth.uid() = user_id);
```

---

## 6. Scraper Architecture

### Shared Types & Normalize (`scrapers/utils/normalize.ts`)

```typescript
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
```

### Dedup (`scrapers/utils/dedup.ts`)

```typescript
import crypto from 'crypto';

export function generateHash(company: string, title: string, location: string): string {
  const str = [company, title, location]
    .map(s => (s ?? '').toLowerCase().trim())
    .join('|');
  return crypto.createHash('md5').update(str).digest('hex');
}
```

### Supabase Upload (`scrapers/utils/upload.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import { NormalizedJob } from './normalize';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key — bypasses RLS
);

export async function uploadJobs(jobs: NormalizedJob[]): Promise<void> {
  if (jobs.length === 0) return;

  const { error } = await supabase
    .from('jobs')
    .upsert(jobs, { onConflict: 'dedup_hash', ignoreDuplicates: true });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log(`  ✓ Uploaded ${jobs.length} jobs`);
}

export async function deactivateStaleJobs(
  sourceName: string,
  activeHashes: string[]
): Promise<void> {
  if (activeHashes.length === 0) return;

  // Mark any jobs from this source NOT in the current scrape as inactive
  const { error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('source', sourceName)
    .not('dedup_hash', 'in', `(${activeHashes.map(h => `'${h}'`).join(',')})`);

  if (error) console.warn(`  ⚠ Stale job cleanup failed for ${sourceName}:`, error.message);
}
```

### Base Playwright Setup (`scrapers/base.ts`)

```typescript
import { chromium, Browser } from 'playwright';

export async function createBrowser(useProxy = false): Promise<Browser> {
  return await chromium.launch({
    headless: true,
    proxy: useProxy ? {
      server: process.env.PROXY_SERVER!,
      username: process.env.PROXY_USER!,
      password: process.env.PROXY_PASS!,
    } : undefined,
  });
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const RATE_LIMIT_MS = 2000;
```

---

### WEEK 1 SCRAPERS

#### 1. PittCSC / SimplifyJobs New Grad (`scrapers/sources/pittcsc.ts`)

```typescript
// Source: https://github.com/SimplifyJobs/New-Grad-Positions
// Method: Raw GitHub JSON — no scraping, no legal risk, no rate limits.
// Data format: JSON array of job objects.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const RAW_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json';

export async function scrapePittCSC(): Promise<NormalizedJob[]> {
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`PittCSC fetch failed: ${res.status}`);
  const listings = await res.json();

  return listings
    .filter((job: any) => job.is_visible !== false)
    .map((job: any) => {
      const location = job.locations?.[0] ?? '';
      return {
        source: 'pittcsc',
        source_id: job.id,
        title: job.title,
        company: job.company_name,
        location,
        remote: inferRemote(location),
        url: job.url,
        description: job.notes,
        experience_level: 'new_grad' as const,
        roles: inferRoles(job.title),
        posted_at: job.date_posted,
        dedup_hash: generateHash(job.company_name, job.title, location),
      };
    });
}
```

#### 2. SimplifyJobs Internships (`scrapers/sources/simplify-internships.ts`)

```typescript
// Source: https://github.com/SimplifyJobs/Summer2026-Internships
// Same JSON format as pittcsc.ts — just different repo and experience_level.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const RAW_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json';

export async function scrapeSimplifyInternships(): Promise<NormalizedJob[]> {
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`Simplify internships fetch failed: ${res.status}`);
  const listings = await res.json();

  return listings
    .filter((job: any) => job.is_visible !== false)
    .map((job: any) => {
      const location = job.locations?.[0] ?? '';
      return {
        source: 'simplify_internships',
        source_id: job.id,
        title: job.title,
        company: job.company_name,
        location,
        remote: inferRemote(location),
        url: job.url,
        description: job.notes,
        experience_level: 'internship' as const,
        roles: inferRoles(job.title),
        posted_at: job.date_posted,
        dedup_hash: generateHash(job.company_name, job.title, location),
      };
    });
}
```

#### 3. Adzuna API (`scrapers/sources/adzuna.ts`)

```typescript
// Source: https://developer.adzuna.com/
// Free API tier — register for app_id + app_key (takes 2 minutes).
// Returns real job listings, legally, with salary data.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const BASE = 'https://api.adzuna.com/v1/api/jobs/us/search';

const SEARCH_TERMS = [
  'software engineer new grad',
  'software engineer entry level',
  'data scientist new grad',
  'machine learning engineer entry level',
  'data analyst entry level',
];

export async function scrapeAdzuna(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (const term of SEARCH_TERMS) {
    try {
      const url = new URL(`${BASE}/1`);
      url.searchParams.set('app_id', process.env.ADZUNA_APP_ID!);
      url.searchParams.set('app_key', process.env.ADZUNA_APP_KEY!);
      url.searchParams.set('what', term);
      url.searchParams.set('results_per_page', '50');
      url.searchParams.set('max_days_old', '7');
      url.searchParams.set('content-type', 'application/json');

      const res = await fetch(url.toString());
      const data = await res.json();

      for (const job of data.results ?? []) {
        const location = job.location?.display_name ?? '';
        results.push({
          source: 'adzuna',
          source_id: job.id,
          title: job.title,
          company: job.company?.display_name ?? 'Unknown',
          location,
          remote: inferRemote(location),
          url: job.redirect_url,
          description: job.description,
          salary_min: job.salary_min ? Math.round(job.salary_min) : undefined,
          salary_max: job.salary_max ? Math.round(job.salary_max) : undefined,
          experience_level: 'entry_level',
          roles: inferRoles(job.title),
          posted_at: job.created,
          dedup_hash: generateHash(job.company?.display_name ?? '', job.title, location),
        });
      }

      await new Promise(r => setTimeout(r, 500)); // be polite between requests
    } catch (err) {
      console.warn(`  ⚠ Adzuna term "${term}" failed:`, err);
    }
  }

  return results;
}
```

#### 4. RemoteOK (`scrapers/sources/remoteok.ts`)

```typescript
// Source: https://remoteok.com/api
// Fully public API — no key, no auth. Remote jobs only.
// Docs: https://remoteok.com/api

import { generateHash } from '../utils/dedup';
import { inferRoles, NormalizedJob } from '../utils/normalize';

const TECH_KEYWORDS = [
  'engineer', 'developer', 'scientist', 'analyst',
  'ml', 'ai', 'data', 'backend', 'frontend', 'fullstack',
];

export async function scrapeRemoteOK(): Promise<NormalizedJob[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'NexTRole Job Aggregator (nextrole.io)' },
  });
  const data = await res.json();

  return data
    .filter((job: any) => job.slug) // first element is metadata, skip it
    .filter((job: any) => {
      const title = (job.position ?? '').toLowerCase();
      return TECH_KEYWORDS.some(k => title.includes(k));
    })
    .map((job: any): NormalizedJob => ({
      source: 'remoteok',
      source_id: String(job.id),
      title: job.position,
      company: job.company,
      location: 'Remote',
      remote: true,
      url: job.url,
      description: job.description,
      salary_min: job.salary_min ? Number(job.salary_min) : undefined,
      salary_max: job.salary_max ? Number(job.salary_max) : undefined,
      experience_level: 'entry_level',
      roles: inferRoles(job.position),
      posted_at: new Date(job.epoch * 1000).toISOString(),
      dedup_hash: generateHash(job.company, job.position, 'Remote'),
    }));
}
```

#### 5. Arbeitnow (`scrapers/sources/arbeitnow.ts`)

```typescript
// Source: https://www.arbeitnow.com/api/job-board-api
// Fully public API — no key, no auth. Paginated. Good remote + EU coverage.
// Docs: https://documenter.getpostman.com/view/18545278/UVJbJdKh

import { generateHash } from '../utils/dedup';
import { inferRoles, NormalizedJob } from '../utils/normalize';

const TECH_TAGS = [
  'software-engineer', 'developer', 'data', 'machine-learning',
  'backend', 'frontend', 'fullstack', 'analyst', 'engineering',
];

export async function scrapeArbeitnow(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  let page = 1;
  const MAX_PAGES = 5;

  while (page <= MAX_PAGES) {
    const res = await fetch(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`
    );
    const data = await res.json();
    const jobs = data.data ?? [];
    if (jobs.length === 0) break;

    for (const job of jobs) {
      const tags: string[] = job.tags ?? [];
      const isTech = tags.some((t: string) =>
        TECH_TAGS.some(k => t.toLowerCase().includes(k))
      ) || TECH_TAGS.some(k => job.title?.toLowerCase().includes(k));

      if (!isTech) continue;

      results.push({
        source: 'arbeitnow',
        source_id: job.slug,
        title: job.title,
        company: job.company_name,
        location: job.location ?? '',
        remote: job.remote ?? false,
        url: job.url,
        description: job.description,
        experience_level: 'entry_level',
        roles: inferRoles(job.title),
        posted_at: new Date(job.created_at * 1000).toISOString(),
        dedup_hash: generateHash(job.company_name, job.title, job.location ?? ''),
      });
    }

    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}
```

#### 6. The Muse (`scrapers/sources/themuse.ts`)

```typescript
// Source: https://www.themuse.com/api/public/jobs
// Public API — optional key for higher rate limits. Entry-level focused.
// Filter by level=Entry Level and category=Engineering etc.

import { generateHash } from '../utils/dedup';
import { inferRoles, inferRemote, NormalizedJob } from '../utils/normalize';

const CATEGORIES = ['Engineering', 'Data Science', 'IT', 'Product'];
const BASE = 'https://www.themuse.com/api/public/jobs';

export async function scrapeTheMuse(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (const category of CATEGORIES) {
    try {
      const url = new URL(BASE);
      url.searchParams.set('category', category);
      url.searchParams.set('level', 'Entry Level');
      url.searchParams.set('page', '0');
      if (process.env.MUSE_API_KEY) {
        url.searchParams.set('api_key', process.env.MUSE_API_KEY);
      }

      const res = await fetch(url.toString());
      const data = await res.json();

      for (const job of data.results ?? []) {
        const location = job.locations?.[0]?.name ?? '';
        results.push({
          source: 'themuse',
          source_id: String(job.id),
          title: job.name,
          company: job.company?.name ?? 'Unknown',
          location,
          remote: inferRemote(location),
          url: job.refs?.landing_page ?? '',
          experience_level: 'entry_level',
          roles: inferRoles(job.name),
          posted_at: job.publication_date,
          dedup_hash: generateHash(
            job.company?.name ?? '',
            job.name,
            location
          ),
        });
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.warn(`  ⚠ TheMuse category "${category}" failed:`, err);
    }
  }

  return results;
}
```

---

### WEEK 2 SCRAPERS (Placeholders)

These files exist in the repo but are not yet active in the orchestrator.

#### `scrapers/sources/jobright.ts`
```typescript
// TODO Week 2: Jobright.ai scraper
// Method: Playwright (headless browser, no proxy needed to start)
// Target: https://jobright.ai/jobs/new-grad
// High value — curated AI-powered new grad feed.
// Notes: Site is React-rendered, need to wait for job cards to load.

export async function scrapeJobright() {
  throw new Error('Jobright scraper not yet implemented — Week 2');
}
```

#### `scrapers/sources/otta.ts`
```typescript
// TODO Week 2: Otta (now Workable) scraper
// Method: Playwright
// Target: https://app.otta.com/jobs/search
// Good startup + mid-size company coverage.
// Notes: Requires account or bypassing auth wall — investigate first.

export async function scrapeOtta() {
  throw new Error('Otta scraper not yet implemented — Week 2');
}
```

#### `scrapers/sources/levels.ts`
```typescript
// TODO Week 2: Levels.fyi scraper
// Method: Playwright
// Target: https://www.levels.fyi/jobs
// Unique value: comp data attached to listings.
// Notes: Has a jobs section with salary ranges — very attractive to users.

export async function scrapeLevels() {
  throw new Error('Levels scraper not yet implemented — Week 2');
}
```

---

### WEEK 3 SCRAPERS (Placeholders)

These require proxy rotation. Do not attempt without Brightdata or equivalent.

#### `scrapers/sources/linkedin.ts`
```typescript
// TODO Week 3: LinkedIn scraper
// Method: Playwright + Brightdata proxy rotation
// Target: https://www.linkedin.com/jobs/search/?keywords=software+engineer+new+grad&f_E=1,2
// Highest volume source. Aggressive bot detection.
// Notes: Use residential proxies. Rotate user agents. Add random delays.
//        Do NOT attempt without proxy — IP will be banned within minutes.

export async function scrapeLinkedIn() {
  throw new Error('LinkedIn scraper not yet implemented — Week 3 (requires proxy)');
}
```

#### `scrapers/sources/indeed.ts`
```typescript
// TODO Week 3: Indeed scraper
// Method: Playwright + proxy
// Target: https://www.indeed.com/jobs?q=software+engineer+new+grad&explvl=entry_level
// Notes: Very aggressive bot detection. Try Crawlee with stealth plugin first.

export async function scrapeIndeed() {
  throw new Error('Indeed scraper not yet implemented — Week 3 (requires proxy)');
}
```

#### `scrapers/sources/handshake.ts`
```typescript
// TODO Week 3: Handshake scraper
// Method: Playwright + proxy
// Target: https://joinhandshake.com/jobs
// Notes: Student-focused platform. May require .edu email for full access.
//        Investigate whether guest browsing shows enough listings.

export async function scrapeHandshake() {
  throw new Error('Handshake scraper not yet implemented — Week 3');
}
```

#### `scrapers/sources/wellfound.ts`
```typescript
// TODO Week 3: Wellfound (AngelList Talent) scraper
// Method: Playwright
// Target: https://wellfound.com/jobs
// Notes: Startup-heavy. Has semi-public JSON endpoints worth inspecting
//        in DevTools before building full Playwright scraper.

export async function scrapeWellfound() {
  throw new Error('Wellfound scraper not yet implemented — Week 3');
}
```

#### `scrapers/sources/dice.ts`
```typescript
// TODO Week 3: Dice scraper
// Method: Playwright OR RSS feed (check https://www.dice.com/rss first)
// Target: https://www.dice.com/jobs?q=software+engineer&experienceLevel=ONE_TO_THREE_YEARS
// Notes: Tech-specific job board. Less aggressive than LinkedIn/Indeed.
//        RSS feed may be a simpler path — check before building Playwright scraper.

export async function scrapeDice() {
  throw new Error('Dice scraper not yet implemented — Week 3');
}
```

---

### Orchestrator (`scrapers/index.ts`)

```typescript
import { scrapePittCSC }             from './sources/pittcsc';
import { scrapeSimplifyInternships } from './sources/simplify-internships';
import { scrapeAdzuna }              from './sources/adzuna';
import { scrapeRemoteOK }            from './sources/remoteok';
import { scrapeArbeitnow }           from './sources/arbeitnow';
import { scrapeTheMuse }             from './sources/themuse';
import { uploadJobs, deactivateStaleJobs } from './utils/upload';
import { NormalizedJob } from './utils/normalize';

// ─────────────────────────────────────────
// ACTIVE scrapers — add Week 2/3 sources here when ready
// ─────────────────────────────────────────
const SCRAPERS: { name: string; fn: () => Promise<NormalizedJob[]> }[] = [
  { name: 'pittcsc',               fn: scrapePittCSC },
  { name: 'simplify_internships',  fn: scrapeSimplifyInternships },
  { name: 'adzuna',                fn: scrapeAdzuna },
  { name: 'remoteok',              fn: scrapeRemoteOK },
  { name: 'arbeitnow',             fn: scrapeArbeitnow },
  { name: 'themuse',               fn: scrapeTheMuse },
  // Week 2 (uncomment when implemented):
  // { name: 'jobright',           fn: scrapeJobright },
  // { name: 'otta',               fn: scrapeOtta },
  // { name: 'levels',             fn: scrapeLevels },
  // Week 3 (uncomment when implemented + proxy configured):
  // { name: 'linkedin',           fn: scrapeLinkedIn },
  // { name: 'indeed',             fn: scrapeIndeed },
  // { name: 'handshake',          fn: scrapeHandshake },
  // { name: 'wellfound',          fn: scrapeWellfound },
  // { name: 'dice',               fn: scrapeDice },
];

async function run() {
  console.log(`\n🚀 NexTRole scrape run — ${new Date().toISOString()}\n`);
  let totalUploaded = 0;

  for (const scraper of SCRAPERS) {
    console.log(`📡 Scraping ${scraper.name}...`);
    try {
      const jobs = await scraper.fn();
      console.log(`  → Got ${jobs.length} jobs`);
      await uploadJobs(jobs);
      await deactivateStaleJobs(scraper.name, jobs.map(j => j.dedup_hash));
      totalUploaded += jobs.length;
    } catch (err) {
      // Don't let one failed scraper kill the whole run
      console.error(`  ✗ ${scraper.name} failed:`, (err as Error).message);
    }
  }

  console.log(`\n✅ Done. Total jobs processed: ${totalUploaded}\n`);
}

run().catch(err => {
  console.error('Fatal scraper error:', err);
  process.exit(1);
});
```

---

## 7. API Routes

### Job Feed (`app/api/jobs/route.ts`)

```typescript
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const FREE_DAILY_LIMIT = 20;

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('tier, jobs_viewed_today, last_reset_date')
    .eq('id', user.id)
    .single();

  // Reset daily counter if new day
  const today = new Date().toISOString().split('T')[0];
  if (profile!.last_reset_date !== today) {
    await supabase.from('profiles')
      .update({ jobs_viewed_today: 0, last_reset_date: today })
      .eq('id', user.id);
    profile!.jobs_viewed_today = 0;
  }

  const isPro = profile!.tier === 'pro';
  const remaining = isPro ? Infinity : FREE_DAILY_LIMIT - profile!.jobs_viewed_today;

  if (!isPro && remaining <= 0) {
    return NextResponse.json({
      error: 'Daily limit reached',
      upgrade: true,
      limit: FREE_DAILY_LIMIT,
    }, { status: 402 });
  }

  // Parse query params
  const params = req.nextUrl.searchParams;
  const roles      = params.get('roles')?.split(',').filter(Boolean) ?? [];
  const remote     = params.get('remote') === 'true';
  const level      = params.get('level');
  const source     = params.get('source');
  const page       = Number(params.get('page') ?? 1);
  const perPage    = isPro ? 50 : Math.min(50, remaining);

  // Build query
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (roles.length > 0) query = query.overlaps('roles', roles);
  if (remote)            query = query.eq('remote', true);
  if (level)             query = query.eq('experience_level', level);
  if (source)            query = query.eq('source', source);

  const { data: jobs, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment view count for free users
  if (!isPro && jobs?.length) {
    await supabase.from('profiles')
      .update({ jobs_viewed_today: profile!.jobs_viewed_today + jobs.length })
      .eq('id', user.id);
  }

  return NextResponse.json({
    jobs,
    total: count,
    page,
    perPage,
    remaining: isPro ? null : remaining - (jobs?.length ?? 0),
  });
}
```

### Apply Tracking (`app/api/apply/route.ts`)

```typescript
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id } = await req.json();

  const { error } = await supabase.from('applications').upsert({
    user_id: user.id,
    job_id,
    status: 'applied',
    auto_tracked: true,
    applied_at: new Date().toISOString(),
  }, { onConflict: 'user_id,job_id', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### Update Application Status (`app/api/applications/[id]/route.ts`)

```typescript
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, notes } = await req.json();

  const { error } = await supabase
    .from('applications')
    .update({ status, notes, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id); // RLS double-check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

---

## 8. Frontend Pages & Components

### `/jobs` — Main Feed

Layout: Left filter sidebar (240px) + right scrollable job feed.

**FilterSidebar filters:**
- Role: SWE / DS / ML / AI / Analyst / PM (multi-select chips)
- Type: New Grad / Entry Level / Internship (radio)
- Remote: toggle
- Posted: Last 24h / 3 days / 1 week / Any (radio)
- Source: pittcsc / Adzuna / RemoteOK / Arbeitnow / TheMuse (multi-select) — grows as sources added

**JobCard shows:**
- Company logo via `https://logo.clearbit.com/{domain}` (free, no key needed)
- Job title (bold)
- Company name + location + remote badge
- Role tags (SWE, DS, etc.) as colored chips
- Salary range (if available)
- Source badge (e.g., "via SimplifyJobs")
- Posted date (relative: "2 days ago")
- Apply button → fires `handleApply()` → logs to DB + opens URL

### `/tracker` — Application Tracker

Two views (toggle top-right):
- **Kanban:** Drag-and-drop columns: Applied → Phone Screen → OA → Interview → Offer | Rejected
- **Table:** Sortable table, inline status dropdown, notes column

### `/pricing` — Pricing Page

Clean two-column comparison. Free vs Pro. Single CTA: "Upgrade to Pro."

### Components

**QuotaBanner** — sticky top bar for free users:
```
"14 / 20 jobs viewed today  ·  Resets in 6h 23m  ·  Upgrade for unlimited →"
```

**UpgradeModal** — triggered when free user hits limit. Shows feature table + Stripe checkout button.

---

## 9. Auto Application Tracking

On every Apply click in `JobCard.tsx`:

```typescript
async function handleApply(job: Job) {
  // Fire-and-forget — don't block the UX
  fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: job.id }),
  });

  // Optimistic UI update — show "Applied" badge immediately
  setAppliedJobIds(prev => new Set([...prev, job.id]));

  // Open the actual job URL
  window.open(job.url, '_blank');
}
```

---

## 10. Stripe Integration

### Products to create in Stripe Dashboard
- **NexTRole Pro Monthly** — $15.00 / month, recurring
- **NexTRole Pro Annual** — $99.00 / year, recurring

### Checkout (`app/api/stripe/checkout/route.ts`)

```typescript
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { priceId } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/settings?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
  });

  return Response.json({ url: session.url });
}
```

### Webhook (`app/api/stripe/webhook/route.ts`)

Handle these events:
- `checkout.session.completed` → set `profiles.tier = 'pro'`, save `stripe_customer_id` + `stripe_subscription_id`
- `customer.subscription.deleted` → set `profiles.tier = 'free'`, clear subscription ID

---

## 11. GitHub Actions Cron

```yaml
# .github/workflows/scrape.yml
name: Daily Job Scrape

on:
  schedule:
    - cron: '0 7 * * *'    # 7 AM UTC = 3 AM EST. Runs before US job seekers wake up.
  workflow_dispatch:         # Manual trigger for testing

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run scrapers
        run: pnpm run scrape
        env:
          SUPABASE_URL:         ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ADZUNA_APP_ID:        ${{ secrets.ADZUNA_APP_ID }}
          ADZUNA_APP_KEY:       ${{ secrets.ADZUNA_APP_KEY }}
          MUSE_API_KEY:         ${{ secrets.MUSE_API_KEY }}
          PROXY_SERVER:         ${{ secrets.PROXY_SERVER }}
          PROXY_USER:           ${{ secrets.PROXY_USER }}
          PROXY_PASS:           ${{ secrets.PROXY_PASS }}
```

---

## 12. Environment Variables

```bash
# .env.local.example — copy to .env.local and fill in

# ── Supabase ──────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=            # Server-only. Never expose to client.

# ── Stripe ────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=

# ── Adzuna API ────────────────────────────────
# Register free at: https://developer.adzuna.com/
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

# ── The Muse API ──────────────────────────────
# Optional — works without key but rate limited
MUSE_API_KEY=

# ── Proxy (Week 3 scrapers only) ──────────────
# Brightdata: https://brightdata.com
PROXY_SERVER=
PROXY_USER=
PROXY_PASS=

# ── App ───────────────────────────────────────
NEXT_PUBLIC_URL=http://localhost:3000
```

---

## 13. Build Order / Milestones

### Week 1 — Data Pipeline + Core Frontend
- [ ] Init Next.js 14 project (pnpm, Tailwind, TypeScript, shadcn/ui)
- [ ] Supabase project setup + run `001_initial_schema.sql`
- [ ] Build all 6 Week 1 scrapers
- [ ] Orchestrator + dedup + upsert logic
- [ ] Test scrapers locally — confirm data appears in Supabase
- [ ] Push to GitHub, add secrets, test GitHub Actions cron manually
- [ ] Supabase auth (Google SSO)
- [ ] `/jobs` feed page + FilterSidebar + JobCard
- [ ] Job feed API route with quota enforcement

### Week 2 — Product Features + Week 2 Scrapers
- [ ] Auto apply tracking + `/tracker` page (kanban + table)
- [ ] QuotaBanner + UpgradeModal
- [ ] Stripe checkout + webhook
- [ ] `/pricing` page
- [ ] Implement Jobright, Otta, Levels scrapers

### Week 3 — Polish + High-Value Scrapers + Launch
- [ ] Landing page + individual job pages (SEO)
- [ ] Resume upload → Supabase Storage
- [ ] AI match scoring (Pro feature)
- [ ] Email alerts for new matching jobs (Resend or Loops)
- [ ] LinkedIn, Indeed, Handshake, Wellfound scrapers (with proxy)
- [ ] Beta launch: r/cscareerquestions, r/csMajors, college Discords, LinkedIn posts

---

## 14. First Cursor Build Prompt

Open Cursor, switch to **Agent mode** (`Cmd+I` → select "Agent"), then paste this entire prompt:

---

```
I'm building NexTRole — a new grad tech job aggregator. I have a full product spec at NEXTROLE_SPEC.md in the root of this folder. Please read it fully before doing anything.

Do the following steps in order. Do not skip ahead. After each major step, confirm it's done before moving to the next.

─── STEP 1: Project Init ───────────────────────────────────────

Initialize a Next.js 14 project in the CURRENT directory (not a subdirectory) with:
- App Router
- TypeScript
- Tailwind CSS
- ESLint
- src/ directory: NO (use root app/ directory)

Command: npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir

Then install shadcn/ui:
npx shadcn-ui@latest init
  - Style: Default
  - Base color: Slate
  - CSS variables: Yes

─── STEP 2: Install Dependencies ───────────────────────────────

Run:
pnpm add @supabase/supabase-js @supabase/ssr stripe
pnpm add -D playwright @playwright/test crawlee ts-node @types/node tsx

─── STEP 3: Folder Structure ────────────────────────────────────

Create all empty directories and placeholder files matching the Repository Structure in the spec. For placeholder scraper files (Week 2 and Week 3), create them with just the stub export as shown in the spec.

─── STEP 4: Supabase Client Helpers ─────────────────────────────

Create lib/supabase/client.ts:
- Browser client using createBrowserClient from @supabase/ssr
- Reads from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

Create lib/supabase/server.ts:
- Server client using createServerClient from @supabase/ssr
- Handles cookies for RSC + Server Actions
- Reads from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

─── STEP 5: Database Migration ──────────────────────────────────

Create supabase/migrations/001_initial_schema.sql with exactly the SQL from Section 5 of the spec. Do not modify it.

─── STEP 6: Scraper Utilities ───────────────────────────────────

Create these files exactly as shown in the spec:
- scrapers/utils/normalize.ts
- scrapers/utils/dedup.ts
- scrapers/utils/upload.ts
- scrapers/base.ts

─── STEP 7: Week 1 Scrapers ─────────────────────────────────────

Create all 6 Week 1 scrapers exactly as shown in the spec:
- scrapers/sources/pittcsc.ts
- scrapers/sources/simplify-internships.ts
- scrapers/sources/adzuna.ts
- scrapers/sources/remoteok.ts
- scrapers/sources/arbeitnow.ts
- scrapers/sources/themuse.ts

─── STEP 8: Week 2 + 3 Placeholder Scrapers ─────────────────────

Create stub files for all remaining scrapers as shown in the spec:
- scrapers/sources/jobright.ts
- scrapers/sources/otta.ts
- scrapers/sources/levels.ts
- scrapers/sources/linkedin.ts
- scrapers/sources/indeed.ts
- scrapers/sources/handshake.ts
- scrapers/sources/wellfound.ts
- scrapers/sources/dice.ts

Each should only export the stub function that throws "not yet implemented".

─── STEP 9: Orchestrator ────────────────────────────────────────

Create scrapers/index.ts exactly as shown in the spec. Make sure all Week 1 scrapers are imported and active. Week 2 and 3 scrapers should be commented out.

─── STEP 10: Package.json Scripts ───────────────────────────────

Add to package.json scripts:
"scrape": "tsx scrapers/index.ts"

─── STEP 11: GitHub Actions ─────────────────────────────────────

Create .github/workflows/scrape.yml exactly as shown in the spec.

─── STEP 12: Environment Variables ──────────────────────────────

Create .env.local.example with all variables from Section 12 of the spec.
Create .env.local (gitignored) with the same keys but empty values.
Make sure .gitignore includes .env.local.

─── STEP 13: Verify ─────────────────────────────────────────────

After all files are created:
1. Run: pnpm tsc --noEmit
   Fix any TypeScript errors before continuing.

2. Check that all imports in scrapers/index.ts resolve correctly.

3. Tell me exactly what I need to do to test the scrapers locally:
   - What env vars are required for a minimal first test (just pittcsc + remoteok, which need no API keys)
   - What command to run
   - What I should see in Supabase if it worked

Do NOT build any frontend pages yet. Data pipeline only.
```

---

*Document version: 2.0 — April 2026*
*Project: NexTRole*
