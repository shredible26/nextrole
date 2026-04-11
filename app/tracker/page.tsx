import ApplicationTracker from '@/components/ApplicationTracker';

export const metadata = {
  title: 'Tracker — NextRole',
  description: 'Track every job application in one place.',
};

export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-[#0d0d12] w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex flex-col flex-1">
        <ApplicationTracker />
      </div>
    </div>
  );
}
