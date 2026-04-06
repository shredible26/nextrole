import ApplicationTracker from '@/components/ApplicationTracker';

export const metadata = {
  title: 'Tracker — NextRole',
  description: 'Track every job application in one place.',
};

export default function TrackerPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex flex-col flex-1">
      <ApplicationTracker />
    </div>
  );
}
