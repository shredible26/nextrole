import { Suspense } from 'react';
import JobFeed from '@/components/JobFeed';
import UpgradedBanner from '@/components/UpgradedBanner';
import { SITE_STATS } from '@/lib/site-stats';

export const metadata = {
  title: 'Jobs — NextRole',
  description: `Browse new grad and entry-level tech jobs from ${SITE_STATS.sourcesDescription}.`,
};

export default function JobsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#0d0d12] md:min-h-0 md:overflow-hidden" data-page="jobs">
      <Suspense fallback={null}>
        <UpgradedBanner />
      </Suspense>
      <JobFeed />
    </div>
  );
}
