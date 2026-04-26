import type { Metadata } from 'next';
import './globals.css';
import ConditionalNavbar from '@/components/ConditionalNavbar';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { SITE_STATS } from '@/lib/site-stats';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'NextRole — Internship & New Grad Tech Jobs',
  description:
    `${SITE_STATS.activeJobsLabel} internship, new grad, and entry-level tech jobs from ${SITE_STATS.sourcesDescription}. SWE, Data Science, ML, AI, Analyst, and PM roles. ${SITE_STATS.updatesDescription}. Built for CS and DS students graduating 2025–2026.`,
  verification: {
    google: '0M_4OBAoQA3Yqn7RbywjU4HyT-49ubU3MkCEcR_qtrI',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialIsPro = false;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle();

    initialIsPro = profile?.tier === 'pro';
  }

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground md:h-dvh md:overflow-hidden md:overscroll-none">
        <ConditionalNavbar
          initialUser={
            user
              ? {
                  email: user.email ?? null,
                  fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
                  avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
                }
              : null
          }
          initialIsPro={initialIsPro}
        />
        <main className="flex flex-1 flex-col md:h-full md:min-h-0 md:overflow-hidden">{children}</main>
        <Toaster richColors position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
