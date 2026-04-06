import { Suspense } from 'react';
import JobFeed from '@/components/JobFeed';
import UpgradedBanner from '@/components/UpgradedBanner';

export const metadata = {
  title: 'Jobs — NextRole',
  description: 'Browse new grad and entry-level tech jobs from 10+ sources.',
};

export default function JobsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <UpgradedBanner />
      </Suspense>
      <JobFeed />
    </>
  );
}
