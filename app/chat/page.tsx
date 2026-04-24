import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import ChatClient from '@/components/ChatClient';

export const metadata = {
  title: 'AI Chat — NextRole',
  description: 'Ask your AI job search assistant anything about jobs, your resume, or career advice.',
};

const CHAT_VIEWPORT_HEIGHT = 'calc(100dvh - 3.5rem)';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export default async function ChatPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/jobs');
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('tier, resume_text')
    .eq('id', user.id)
    .maybeSingle();

  const isPro = profile?.tier === 'pro';
  const hasResume = Boolean(profile?.resume_text);

  if (!isPro) {
    return (
      <div
        className="flex flex-col items-center justify-center overflow-hidden bg-[#0d0d12] px-4"
        data-page="chat"
        style={{ height: CHAT_VIEWPORT_HEIGHT }}
      >
        <div className="w-full max-w-md rounded-2xl border border-[#2a2a35] bg-[#1a1a24] p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/25">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#f0f0fa]">NextRole AI Chat is a Pro feature</h1>
          <p className="mt-2 text-sm text-[#888899]">
            Upgrade to Pro to chat with your AI job search assistant, get personalized job recommendations, and analyze your resume.
          </p>
          <Link
            href="/subscription"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Upgrade to Pro →
          </Link>
          <div className="mt-4">
            <Link href="/jobs" className="text-sm text-[#555566] hover:text-[#8888aa] transition-colors">
              Back to Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden bg-[#0d0d12]"
      data-page="chat"
      style={{ height: CHAT_VIEWPORT_HEIGHT }}
    >
      <ChatClient hasResume={hasResume} />
    </div>
  );
}
