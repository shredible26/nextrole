'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  Upload,
  Search,
  Sparkles,
  MapPin,
  CheckCircle2,
  Plus,
  Check,
  X,
  MessageSquare,
  LayoutGrid,
  Send,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
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

const NAV_LINKS = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/tracker', label: 'Tracker' },
];
const CHAT_HREF = '/chat';

const HOW_IT_WORKS: Array<{
  step: string;
  icon: ReactNode;
  title: string;
  desc: string;
}> = [
  {
    step: '01',
    icon: <Upload className="h-5 w-5 text-indigo-300" />,
    title: 'Upload your resume',
    desc: 'We parse and embed it to understand your skills.',
  },
  {
    step: '02',
    icon: <Search className="h-5 w-5 text-indigo-300" />,
    title: 'Browse 76,000+ jobs',
    desc: 'Filtered by role, level, location, and recency.',
  },
  {
    step: '03',
    icon: <Sparkles className="h-5 w-5 text-indigo-300" />,
    title: 'Apply with confidence',
    desc: 'AI grades each job A–F based on your fit.',
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

function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
  };
  const classes =
    `transition-all duration-[600ms] ease-out will-change-transform ` +
    (visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5') +
    (className ? ` ${className}` : '');

  if (Tag === 'section') {
    return (
      <section ref={ref as React.RefObject<HTMLElement>} style={style} className={classes}>
        {children}
      </section>
    );
  }
  return (
    <div ref={ref} style={style} className={classes}>
      {children}
    </div>
  );
}

function MockJobCard({
  company,
  title,
  location,
  grade,
  gradeBg,
  gradeText,
  roleTag,
  roleColor,
}: {
  company: string;
  title: string;
  location: string;
  grade: string;
  gradeBg: string;
  gradeText: string;
  roleTag: string;
  roleColor: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-[#2a2a35] bg-[#1a1a24] p-4 shadow-sm">
      <div
        className="absolute -top-2 -right-2 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none shadow-sm"
        style={{ backgroundColor: gradeBg, color: gradeText }}
      >
        {grade}
      </div>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
          {company[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-snug text-white">{title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-medium text-[#d8d9e6]">
            <span className="font-bold text-indigo-300">{company}</span>
            <span>·</span>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleColor}`}>
          {roleTag}
        </span>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-[13px] font-medium text-[#e0e0f0]">
          <span className="font-medium text-[#f0f0fa]">$120k – $160k</span>
          <span>~2d</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-7 items-center rounded-md bg-indigo-600 px-2.5 text-xs font-semibold text-white">
            Apply ↗
          </span>
          <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[#444455] bg-[#2a2a35] px-2 text-xs font-medium text-[#f0f0fa]">
            <Plus className="h-3 w-3" />
            Track
          </span>
        </div>
      </div>
    </div>
  );
}

function MockChat() {
  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#14141c] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-[#2a2a35] pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="text-sm font-semibold text-white">NextRole AI</div>
        <Badge className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0 h-4 hover:bg-indigo-500/20 border-0">
          Pro
        </Badge>
      </div>
      <div className="space-y-3">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-sm text-white">
            Find SWE internships in NYC posted this week.
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#1f1f2b] px-3.5 py-2 text-sm text-white/90 border border-[#2a2a35]">
            Found 24 matches. Top picks:
            <div className="mt-2 space-y-1 text-xs text-white/70">
              <div>• Stripe — Software Engineer Intern (A)</div>
              <div>• Datadog — SWE Intern, Platform (A)</div>
              <div>• Ramp — Backend Intern (B)</div>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-sm text-white">
            What skills am I missing for the Stripe role?
          </div>
        </div>
      </div>
    </div>
  );
}

function MockTracker() {
  const rows = [
    { co: 'Stripe', role: 'SWE Intern', status: 'Interview', statusColor: 'bg-amber-500/20 text-amber-300', date: 'Apr 12' },
    { co: 'Datadog', role: 'Backend Eng', status: 'Applied', statusColor: 'bg-sky-500/20 text-sky-300', date: 'Apr 10' },
    { co: 'Ramp', role: 'New Grad SWE', status: 'Offer', statusColor: 'bg-emerald-500/20 text-emerald-300', date: 'Apr 08' },
    { co: 'Vercel', role: 'Frontend Intern', status: 'Applied', statusColor: 'bg-sky-500/20 text-sky-300', date: 'Apr 05' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#14141c] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#2a2a35] px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-indigo-300" />
          <div className="text-sm font-semibold text-white">Applications</div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[#2a2a35] p-0.5 text-[11px]">
          <span className="rounded bg-[#2a2a35] px-2 py-0.5 font-medium text-white">Table</span>
          <span className="px-2 py-0.5 text-white/50">Kanban</span>
        </div>
      </div>
      <div className="divide-y divide-[#2a2a35]">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.7fr] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
          <div>Company</div>
          <div>Role</div>
          <div>Status</div>
          <div>Date</div>
        </div>
        {rows.map(r => (
          <div key={r.co} className="grid grid-cols-[1.5fr_1.5fr_1fr_0.7fr] gap-3 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500 text-[10px] font-bold text-white">
                {r.co[0]}
              </div>
              <span className="truncate font-medium">{r.co}</span>
            </div>
            <div className="truncate text-white/80">{r.role}</div>
            <div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.statusColor}`}>
                {r.status}
              </span>
            </div>
            <div className="text-white/50">{r.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRow({ included, children }: { included: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      {included ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
      )}
      <span className={included ? 'text-sm text-white/85' : 'text-sm text-white/40 line-through decoration-white/20'}>
        {children}
      </span>
    </li>
  );
}

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#2a2a35] bg-[#14141c] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1.5 block text-xs font-medium text-white/60">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-xs font-medium text-white/60">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-medium text-white/60">
          Subject
        </label>
        <input
          id="contact-subject"
          type="text"
          required
          value={subject}
          onChange={e => setSubject(e.target.value)}
          disabled={status === 'loading'}
          className={inputClass}
          placeholder="How can we help?"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-xs font-medium text-white/60">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={status === 'loading'}
          className={`${inputClass} resize-none`}
          placeholder="Tell us what's on your mind…"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'loading' ? (
          'Sending…'
        ) : (
          <>
            Send Message
            <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {status === 'success' && (
        <p className="text-center text-sm text-emerald-400">
          Message sent! We&apos;ll get back to you soon.
        </p>
      )}
      {status === 'error' && (
        <p className="text-center text-sm text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isProLoading, setIsProLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [loginRedirectToJobs, setLoginRedirectToJobs] = useState(false);

  useEffect(() => {
    setMounted(true);
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
        setIsProLoading(false);
      } else {
        setIsProLoading(false);
      }
      setAuthLoading(false);
    }
    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsPro(false);
        setIsProLoading(false);
      }
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('unsubscribed') === 'true') {
      toast("You've been unsubscribed from job alerts.");
      const url = new URL(window.location.href);
      url.searchParams.delete('unsubscribed');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    const target = 76000;
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

  async function handleLogin(redirectToJobs = false) {
    setLoginRedirectToJobs(redirectToJobs);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectToJobs
          ? `${window.location.origin}/jobs`
          : `${window.location.origin}/`,
      },
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
    <div className="flex flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-[#030303]">
      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 w-full border-b border-[#2a2a35] bg-[#1a1a24] h-14">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 md:min-w-[200px]"
          >
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

          <div className="flex-1 flex justify-center">
            {mounted && !authLoading && user && (
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
                <Link
                  href={CHAT_HREF}
                  className={`flex items-center gap-1.5 transition-colors ${
                    pathname === CHAT_HREF || pathname.startsWith(CHAT_HREF)
                      ? 'text-white font-semibold'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Chat
                  <Badge className="bg-indigo-500 text-white text-[10px] px-1.5 py-0 h-4 hover:bg-indigo-500">
                    Pro
                  </Badge>
                </Link>
              </nav>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 md:min-w-[200px]">
            {mounted && !authLoading && (
              <>
                {user ? (
                  <>
                    {isPro && !isProLoading && (
                      <Badge className="hidden sm:inline-flex bg-emerald-500 hover:bg-emerald-500 text-white text-xs px-2 py-0.5">
                        Pro
                      </Badge>
                    )}
                    {!isPro && !isProLoading && (
                      <button
                        onClick={() => router.push('/subscription')}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-indigo-500/40 text-indigo-300 bg-transparent hover:bg-gradient-to-r hover:from-indigo-500 hover:to-violet-500 hover:text-white hover:border-transparent transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25"
                      >
                        Upgrade
                      </button>
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
                      onClick={() => handleLogin()}
                      className="text-[#aaaacc] hover:text-white text-sm transition-colors"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => handleLogin()}
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
      <section className="relative min-h-screen bg-[#030303] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] via-transparent to-purple-500/[0.05] blur-3xl" />

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

        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 flex flex-col items-center gap-5 md:gap-7 pt-12 md:pt-16 pb-12 md:pb-16">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]"
          >
            <Zap className="h-4 w-4 fill-blue-500 text-blue-500" />
            <span className="text-sm text-white/60">Daily Updates • 40+ Sources • v1.0.0</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="text-center tracking-tight"
          >
            <span className="block text-4xl md:text-6xl font-bold leading-[1.05] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
              Every internship &amp; new grad tech job,
            </span>
            <span className="block text-4xl md:text-6xl font-bold leading-[1.05] bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white/90 to-purple-300">
              from every source.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="text-[clamp(0.75rem,2.1vw,1.125rem)] text-white/50 leading-relaxed font-light mx-auto text-center md:whitespace-nowrap"
          >
            AI match scoring
            <span className="mx-2 text-white/25">·</span>
            Auto application tracking
            <span className="mx-2 text-white/25">·</span>
            Email updates
            <span className="mx-2 text-white/25">·</span>
            Search <span className="text-indigo-300/80">(Pro)</span>
            <span className="mx-2 text-white/25">·</span>
            NextRole AI <span className="text-indigo-300/80">(Pro)</span>
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            {user ? (
              <Link
                href="/jobs"
                className="group inline-flex items-center gap-2 px-10 py-4 bg-white text-[#030303] rounded-full font-bold text-lg hover:bg-white/90 transition-all duration-300"
              >
                Browse Jobs
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <button
                onClick={() => handleLogin(true)}
                className="group inline-flex items-center gap-2 px-10 py-4 bg-white text-[#030303] rounded-full font-bold text-lg hover:bg-white/90 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-90"
                aria-busy={loginRedirectToJobs}
                disabled={loginRedirectToJobs}
              >
                Browse Jobs
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="grid grid-cols-3 gap-10 md:gap-12 w-full max-w-lg text-center"
          >
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">
                {count.toLocaleString()}+
              </p>
              <p className="mt-1 text-xs md:text-sm text-white/50">Active jobs</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">40+</p>
              <p className="mt-1 text-xs md:text-sm text-white/50">Sources</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">Daily</p>
              <p className="mt-1 text-xs md:text-sm text-white/50">Updates</p>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6, ease: 'easeOut' }}
            className="mt-6 md:mt-10"
          >
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2 text-white/40"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.25em]">Scroll</span>
              <div className="flex h-9 w-5 items-start justify-center rounded-full border border-white/15 pt-1.5">
                <motion.span
                  animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="block h-1.5 w-1 rounded-full bg-white/60"
                />
              </div>
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative bg-[#030303] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
                How it works
              </h2>
              <p className="mt-4 text-base md:text-lg text-white/50">
                Three steps from resume to offer.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon, title, desc }, i) => (
              <Reveal key={step} delay={i * 120}>
                <div className="group relative h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm transition-all hover:border-indigo-500/30 hover:bg-white/[0.04]">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20">
                      {icon}
                    </div>
                    <span className="text-4xl font-bold text-white/[0.08] tabular-nums">{step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative bg-[#030303] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-28">

          {/* Feature 1 — AI Match Scoring */}
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
            <Reveal>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                  <Sparkles className="h-3 w-3" />
                  AI Match Scoring
                </span>
                <h3 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Know before you apply
                </h3>
                <p className="mt-4 text-base md:text-lg leading-relaxed text-white/55">
                  Upload your resume once. Every job gets an A–F grade based on how well your skills, experience,
                  and background match. Stop guessing, start prioritizing.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="space-y-3">
                <MockJobCard
                  company="Stripe"
                  title="Software Engineer Intern, Summer 2026"
                  location="New York, NY"
                  grade="A"
                  gradeBg="#22c55e"
                  gradeText="#ffffff"
                  roleTag="SWE"
                  roleColor="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                />
                <MockJobCard
                  company="Datadog"
                  title="Backend Engineer, New Grad"
                  location="Remote"
                  grade="B"
                  gradeBg="#14b8a6"
                  gradeText="#ffffff"
                  roleTag="SWE"
                  roleColor="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                />
                <MockJobCard
                  company="Palantir"
                  title="Forward Deployed Engineer"
                  location="Denver, CO"
                  grade="C"
                  gradeBg="#eab308"
                  gradeText="#000000"
                  roleTag="SWE"
                  roleColor="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                />
              </div>
            </Reveal>
          </div>

          {/* Feature 2 — NextRole AI Chat */}
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
            <Reveal delay={120} className="md:order-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                  <MessageSquare className="h-3 w-3" />
                  NextRole AI Chat
                </span>
                <h3 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Your personal career assistant
                </h3>
                <p className="mt-4 text-base md:text-lg leading-relaxed text-white/55">
                  Ask anything. Find SWE jobs in NYC, get resume feedback for a specific role, or find out what
                  skills you&apos;re missing. Powered by Claude, with access to our full job database.
                </p>
              </div>
            </Reveal>
            <Reveal className="md:order-1">
              <MockChat />
            </Reveal>
          </div>

          {/* Feature 3 — Application Tracker */}
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
            <Reveal>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Application Tracker
                </span>
                <h3 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Track every application in one place
                </h3>
                <p className="mt-4 text-base md:text-lg leading-relaxed text-white/55">
                  Auto-tracks when you apply through NextRole. Switch between table and kanban views. Add notes,
                  update status, never lose track of where you stand.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <MockTracker />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── SUBSCRIPTION ── */}
      <section className="relative bg-[#030303] py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
                Simple plans
              </h2>
              <p className="mt-4 text-base md:text-lg text-white/50">
                Start free. Upgrade when you&apos;re ready to unlock the full database.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Free */}
            <Reveal>
              <div className="relative flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Free</div>
                  <h3 className="mt-2 text-2xl font-bold text-white">Get Started — Free</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">$0</span>
                    <span className="text-sm text-white/50">/forever</span>
                  </div>
                </div>
                <ul className="mt-8 flex-1 space-y-0 divide-y divide-white/[0.04]">
                  <PlanRow included>20 jobs/day per filter</PlanRow>
                  <PlanRow included>All sidebar filters (role, level, remote, location, date)</PlanRow>
                  <PlanRow included>Application tracker</PlanRow>
                  <PlanRow included>Resume upload</PlanRow>
                  <PlanRow included>AI grade badges for all your jobs (requires resume upload)</PlanRow>
                  <PlanRow included>Best Match sort</PlanRow>
                  <PlanRow included={false}>Search bar</PlanRow>
                  <PlanRow included={false}>Unlimited jobs</PlanRow>
                  <PlanRow included={false}>AI Chat (NextRole AI)</PlanRow>
                </ul>
                {!user && (
                  <button
                    onClick={() => handleLogin(true)}
                    className="mt-8 w-full rounded-full border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                  >
                    Get Started
                  </button>
                )}
              </div>
            </Reveal>

            {/* Pro */}
            <Reveal delay={120}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.08] to-violet-500/[0.04] p-8 backdrop-blur-sm shadow-2xl shadow-indigo-500/10">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Pro</span>
                    <Badge className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0 h-4 hover:bg-indigo-500/20 border border-indigo-500/30">
                      Most popular
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold text-white">Go Pro</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">$4.99</span>
                    <span className="text-sm text-white/50">/month</span>
                  </div>
                </div>
                <ul className="relative mt-8 flex-1 space-y-0 divide-y divide-white/[0.04]">
                  <PlanRow included>Everything in Free</PlanRow>
                  <PlanRow included>Unlimited jobs</PlanRow>
                  <PlanRow included>Search bar</PlanRow>
                  <PlanRow included>AI grade badges for all jobs</PlanRow>
                  <PlanRow included>Best Match sort</PlanRow>
                  <PlanRow included>AI Chat with access to entire job database (NextRole AI)</PlanRow>
                  <PlanRow included>Priority support</PlanRow>
                </ul>
                <Link
                  href="/subscription"
                  className="group relative mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110"
                >
                  Upgrade to Pro
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="relative bg-[#030303] py-24">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
                Get in touch
              </h2>
              <p className="mt-4 text-base md:text-lg text-white/50">
                Questions, feedback, or issues? We&apos;d love to hear from you.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm sm:p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 py-6 text-center text-xs text-white/30 bg-[#030303]">
        © {new Date().getFullYear()} NextRole · Built for students and recent grads
      </footer>
    </div>
  );
}
