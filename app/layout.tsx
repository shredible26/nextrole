import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NextRole — Internship & New Grad Tech Jobs',
  description:
    '55,000+ internship, new grad, and entry-level tech jobs from 25+ sources. SWE, Data Science, ML, AI, Analyst, and PM roles. Updated daily. Built for CS and DS students graduating 2025–2026.',
  verification: {
    google: '0M_4OBAoQA3Yqn7RbywjU4HyT-49ubU3MkCEcR_qtrI',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground overscroll-none">
        <Navbar />
        <main className="flex flex-col flex-1">{children}</main>
        <Toaster richColors position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
