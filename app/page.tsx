'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, TrendingUp, Target, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { User } from '@supabase/supabase-js';
import type { CSSProperties } from 'react';

const NAV_LINKS = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/tracker', label: 'Tracker' },
  { href: '/pricing', label: 'Pricing' },
];

const SOURCES = [
  'Simplify', 'Greenhouse', 'Workday', '+ 22 more',
];

const HOW_IT_WORKS: Array<{
  step: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = [
  {
    step: '01',
    icon: <TrendingUp className="h-5 w-5 text-blue-400" />,
    title: 'Updated daily',
    desc: 'Scrapers run every morning pulling fresh listings from 25+ sources including GitHub repos, company ATS platforms, and job boards.',
  },
  {
    step: '02',
    icon: <Target className="h-5 w-5 text-blue-400" />,
    title: 'Apply in one click',
    desc: 'Click Apply on any card. The application is auto-logged in your tracker — no manual entry required.',
  },
  {
    step: '03',
    icon: <CheckCircle2 className="h-5 w-5 text-blue-400" />,
    title: 'Track your pipeline',
    desc: 'Table or kanban view. Move applications through Applied → Interview → Offer with one click.',
  },
];

const SHAPES: Array<{
  gradient: string;
  pos: CSSProperties;
  w: number;
  h: number;
  rotate: number;
  delay: number;
}> = [
  {
    gradient: 'from-blue-500/[0.15] to-transparent',
    pos: { left: 0, top: '20%' },
    w: 600, h: 140, rotate: 12, delay: 0.3,
  },
  {
    gradient: 'from-purple-500/[0.15] to-transparent',
    pos: { right: 0, top: '75%' },
    w: 500, h: 120, rotate: -15, delay: 0.5,
  },
  {
    gradient: 'from-indigo-500/[0.15] to-transparent',
    pos: { left: '10%', bottom: '10%' },
    w: 300, h: 80, rotate: -8, delay: 0.4,
  },
  {
    gradient: 'from-cyan-500/[0.15] to-transparent',
    pos: { right: '20%', top: '15%' },
    w: 200, h: 60, rotate: 20, delay: 0.6,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      delay: 0.3 + i * 0.15,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  }),
};

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', u.id)
          .single();
        setIsPro(data?.tier === 'pro');
      }
      setAuthLoading(false);
    }
    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsPro(false);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = 55000;
    const steps = 60;
    const increment = Math.ceil(target / steps);
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(current);
      }
    }, Math.floor(2000 / steps));
    return () => clearInterval(interval);
  }, []);

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/jobs` },
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="flex flex-col bg-[#030303]">
      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 w-full border-b border-[#2a2a35] bg-[#1a1a24] h-14">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          {/* Logo - left */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#f0f0fa]"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
            <span className="text-base font-bold tracking-tight text-[#f0f0fa]">NextRole</span>
          </Link>

          {/* Center - always takes up flex-1 space to prevent shift */}
          <div className="flex-1 flex justify-center">
            {!authLoading && user && (
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`transition-colors ${
                      pathname === href || pathname.startsWith(href)
                        ? 'text-white font-semibold'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Auth - always right */}
          <div className="flex items-center gap-3 shrink-0">
            {!authLoading && (
              <>
                {user ? (
                  <>
                    {isPro && (
                      <Badge className="hidden sm:inline-flex bg-emerald-500 hover:bg-emerald-500 text-white text-xs px-2 py-0.5">
                        Pro
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label="User menu"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatarUrl} alt={fullName ?? 'User'} />
                          <AvatarFallback className="bg-[#2a2a35] text-xs text-[#f0f0fa]">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 border-[#2a2a35] bg-[#1a1a24]">
                        <div className="truncate px-2 py-1.5 text-sm text-[#8888aa]">{user.email}</div>
                        <DropdownMenuSeparator className="bg-[#2a2a35]" />
                        <DropdownMenuItem
                          onClick={() => router.push('/profile')}
                          className="text-[#f0f0fa] focus:bg-[#2a2a35] focus:text-[#f0f0fa]"
                        >
                          Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#2a2a35]" />
                        <DropdownMenuItem
                          onClick={() => router.push('/settings')}
                          className="text-[#f0f0fa] focus:bg-[#2a2a35] focus:text-[#f0f0fa]"
                        >
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#2a2a35]" />
                        <DropdownMenuItem
                          onClick={handleLogout}
                          className="text-red-400 focus:bg-[#2a2a35] focus:text-red-400"
                        >
                          Sign out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleLogin}
                      className="text-[#aaaacc] hover:text-white text-sm transition-colors"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={handleLogin}
                      className="bg-white text-[#0d0d12] font-semibold text-sm px-4 py-1.5 rounded-full hover:bg-white/90 transition-colors"
                    >
                      Get Started →
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative min-h-screen bg-[#030303] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] via-transparent to-purple-500/[0.05] blur-3xl" />

        {/* Floating shapes */}
        {SHAPES.map((shape, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={shape.pos}
            initial={{ opacity: 0, y: -150, rotate: shape.rotate - 15 }}
            animate={{ opacity: 1, y: 0, rotate: shape.rotate }}
            transition={{
              duration: 2.4,
              delay: shape.delay,
              ease: [0.23, 0.86, 0.39, 0.96] as [number, number, number, number],
            }}
          >
            <motion.div
              className={`rounded-full bg-gradient-to-r ${shape.gradient} backdrop-blur-[2px] border-2 border-white/[0.15]`}
              style={{ width: shape.w, height: shape.h }}
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        ))}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 flex flex-col items-center gap-8 py-20">

          {/* Block 0 — Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]"
          >
            <Zap className="h-4 w-4 fill-blue-500 text-blue-500" />
            <span className="text-sm text-white/60">Daily Updates • 25+ Sources • v1.0.0</span>
          </motion.div>

          {/* Block 1 — Headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="text-center tracking-tight"
          >
            <span className="block text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
              Every internship & new grad
            </span>
            <span className="block text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-purple-300">
              tech job. One feed.
            </span>
          </motion.h1>

          {/* Block 2 — Subtitle */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="text-base md:text-xl text-white/50 leading-relaxed font-light max-w-3xl mx-auto text-center"
          >
            55,000+ internship, new grad, and entry-level jobs from 25+ sources — updated daily.
            Find the right role and automatically track every application in one place.
          </motion.p>

          {/* Block 3 — CTA */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <Link
              href="/jobs"
              className="group inline-flex items-center gap-2 px-10 py-4 bg-white text-[#030303] rounded-full font-bold text-lg hover:bg-white/90 transition-all duration-300"
            >
              Browse Jobs
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Block 4 — Stats */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="grid grid-cols-3 gap-12 mb-20 w-full max-w-lg text-center"
          >
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">
                {count.toLocaleString()}+
              </p>
              <p className="mt-1 text-sm text-white/50">Active jobs</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">25+</p>
              <p className="mt-1 text-sm text-white/50">Sources</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">Daily</p>
              <p className="mt-1 text-sm text-white/50">Updates</p>
            </div>
          </motion.div>

          {/* Block 5 — How it works */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={5}
            className="w-full"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map(({ step, icon, title, desc }) => (
                <div
                  key={step}
                  className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl font-bold text-white/20">{step}</span>
                    {icon}
                  </div>
                  <h3 className="font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Block 6 — Sources */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={6}
            className="w-full text-center"
          >
            <h3 className="text-xl font-semibold text-white/70 mb-6">
              Aggregated from 25+ sources
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {SOURCES.map((source, index) => (
                <motion.div
                  key={source}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-xs text-white/80 hover:bg-white/10 transition-colors cursor-default"
                >
                  {source}
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 py-6 text-center text-xs text-white/30 bg-[#030303]">
        © {new Date().getFullYear()} NextRole · Built for students and recent grads
      </footer>
    </div>
  );
}
