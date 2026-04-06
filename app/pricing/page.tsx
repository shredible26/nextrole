import { Suspense } from 'react';
import PricingClient from '@/components/PricingClient';

export const metadata = {
  title: 'Pricing — NextRole',
  description: 'Simple, transparent pricing. Start free, upgrade when you need more.',
};

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <PricingClient />
    </Suspense>
  );
}
