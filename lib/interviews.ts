import type { ApplicationStatus } from '@/lib/types';

export function getMinimumInterviewCountForStatus(status: ApplicationStatus | null | undefined) {
  if (status === 'phone_screen' || status === 'interview') {
    return 1;
  }

  return 0;
}

export function normalizeInterviewCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function getNextInterviewCount({
  currentStatus,
  nextStatus,
  currentCount,
}: {
  currentStatus: ApplicationStatus | null | undefined;
  nextStatus: ApplicationStatus;
  currentCount: number | null | undefined;
}) {
  const normalizedCount = normalizeInterviewCount(currentCount);
  const minimumInterviewCount = getMinimumInterviewCountForStatus(nextStatus);

  if (
    nextStatus === 'phone_screen'
    && currentStatus !== 'phone_screen'
    && currentStatus !== 'interview'
  ) {
    return Math.max(normalizedCount, 1);
  }

  if (nextStatus === 'interview') {
    if (currentStatus === 'phone_screen') {
      return Math.max(normalizedCount + 1, 2);
    }

    if (currentStatus !== 'interview') {
      return Math.max(normalizedCount, minimumInterviewCount);
    }
  }

  return Math.max(normalizedCount, minimumInterviewCount);
}
