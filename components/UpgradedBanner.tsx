'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export default function UpgradedBanner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success("You're now on NextRole Pro! Enjoy unlimited job access. 🎉", {
        duration: 5000,
      });
    }
  }, [searchParams]);

  return null;
}
