import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NextRole — New Grad Tech Jobs',
  description:
    'Every new grad SWE, DS, ML, and AI job. One feed. Auto-tracked applications.',
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex flex-col flex-1">{children}</main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
