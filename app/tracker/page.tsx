import ApplicationTracker from '@/components/ApplicationTracker';

export const metadata = {
  title: 'Tracker — NextRole',
  description: 'Track every job application in one place.',
};

export default function TrackerPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#0d0d12] w-full md:min-h-0 md:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 md:min-h-0 md:overflow-y-auto">
        <ApplicationTracker />
      </div>
    </div>
  );
}
