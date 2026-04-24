import { Suspense } from 'react';
import SubscriptionClient from '@/components/SubscriptionClient';

export const metadata = {
  title: 'Subscription — NextRole',
  description: 'Choose a plan, upgrade to Pro, and manage your subscription.',
};

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SubscriptionClient />
    </Suspense>
  );
}
