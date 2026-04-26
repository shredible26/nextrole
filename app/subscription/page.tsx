import { Suspense } from 'react';
import SubscriptionClient from '@/components/SubscriptionClient';

export const metadata = {
  title: 'Subscription — NextRole',
  description: 'Choose a plan, upgrade to Pro, and manage your subscription.',
};

export default function SubscriptionPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#0d0d12]" data-page="subscription">
      <Suspense fallback={<div className="flex flex-1 bg-[#0d0d12]" data-page="subscription" aria-hidden="true" />}>
        <SubscriptionClient />
      </Suspense>
    </div>
  );
}
