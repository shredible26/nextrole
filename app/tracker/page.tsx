import ApplicationTracker from '@/components/ApplicationTracker';

export const metadata = {
  title: 'Tracker — NextRole',
  description: 'Track every job application in one place.',
};

export default function TrackerPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0d0d12] w-full">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
        <ApplicationTracker />
      </div>
    </div>
  );
}
