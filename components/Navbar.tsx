'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/tracker', label: 'Tracker' },
];

// Chat link only shown when authenticated
const CHAT_HREF = '/chat';

export type NavbarUser = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

function toNavbarUser(user: {
  email?: string | null;
  user_metadata?: { full_name?: string | null; avatar_url?: string | null };
} | null): NavbarUser | null {
  if (!user) return null;

  return {
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

export default function Navbar({
  initialUser,
  initialIsPro,
}: {
  initialUser: NavbarUser | null;
  initialIsPro: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<NavbarUser | null>(initialUser);
  const [isPro, setIsPro] = useState(initialIsPro);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncProfileTier(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .maybeSingle();

      if (!cancelled) {
        setIsPro(data?.tier === 'pro');
      }
    }

    void supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (cancelled) return;

      setUser(toNavbarUser(currentUser));

      if (!currentUser) {
        setIsPro(false);
        return;
      }

      void syncProfileTier(currentUser.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(toNavbarUser(session?.user ?? null));

      if (!session?.user) {
        setIsPro(false);
        return;
      }

      void syncProfileTier(session.user.id);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Close drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileMenuOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [mobileMenuOpen]);

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/jobs` },
    });
  }

  async function handleLogout() {
    setMobileMenuOpen(false);
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const avatarUrl = user?.avatarUrl ?? undefined;
  const fullName = user?.fullName ?? undefined;
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const mobileLinkClass = (href: string) =>
    `flex min-h-[56px] items-center justify-between border-b border-[#1e1e28] px-5 text-lg text-white transition-colors active:bg-[#1a1a24] ${
      pathname.startsWith(href) ? 'font-semibold text-white' : 'font-medium text-[#e0e0f0]'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2a2a35] bg-[#1a1a24]">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        {/* Logo — left */}
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
          <span className="text-base font-bold tracking-tight text-[#f0f0fa]">
            NextRole
          </span>
        </Link>

        {/* Nav links — centered (desktop only) */}
        <div className="hidden flex-1 justify-center md:flex">
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`transition-colors ${
                  pathname.startsWith(href)
                    ? 'text-[#f0f0fa]'
                    : 'text-[#8888aa] hover:text-[#f0f0fa]'
                }`}
              >
                {label}
              </Link>
            ))}
            {user && (
              <Link
                href={CHAT_HREF}
                className={`flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith(CHAT_HREF)
                    ? 'text-[#f0f0fa]'
                    : 'text-[#8888aa] hover:text-[#f0f0fa]'
                }`}
              >
                Chat
                {!isPro && (
                  <Badge className="bg-indigo-500 text-white text-[10px] px-1.5 py-0 h-4 hover:bg-indigo-500">
                    Pro
                  </Badge>
                )}
              </Link>
            )}
          </nav>
        </div>

        {/* Spacer on mobile (pushes auth + hamburger to right) */}
        <div className="flex-1 md:hidden" />

        {/* Auth — right */}
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3 md:min-w-[200px]">
          <>
            {user && isPro && (
              <Badge className="inline-flex bg-emerald-500 hover:bg-emerald-500 text-white text-xs px-2 py-0.5">
                Pro
              </Badge>
            )}
            {user && !isPro && (
              <button
                onClick={() => router.push('/pricing')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-indigo-500/40 text-indigo-300 bg-transparent hover:bg-gradient-to-r hover:from-indigo-500 hover:to-violet-500 hover:text-white hover:border-transparent transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25"
              >
                Upgrade
              </button>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="User menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} alt={fullName ?? 'User'} />
                    <AvatarFallback className="bg-[#2a2a35] text-xs text-[#f0f0fa]">{initials}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border-[#2a2a35] bg-[#1a1a24]">
                  <div className="truncate px-2 py-1.5 text-sm text-[#8888aa]">
                    {user.email}
                  </div>
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
            ) : (
              <button
                onClick={handleLogin}
                className="hidden sm:inline-flex rounded-full bg-[#f0f0fa] px-4 py-1.5 text-sm font-semibold text-[#0d0d12] transition-colors hover:bg-white"
              >
                Sign in
              </button>
            )}

            {/* Hamburger (mobile only) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-md text-[#f0f0fa] hover:bg-[#2a2a35] transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </>
        </div>
      </div>

      {/* Mobile drawer (below md only) */}
      <div
        id="mobile-nav-drawer"
        className={`md:hidden fixed left-0 right-0 top-14 z-40 overflow-hidden bg-[#0d0d12] transition-[max-height] duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-screen border-t border-[#1e1e28]' : 'max-h-0'
        }`}
        style={{ height: mobileMenuOpen ? 'calc(100vh - 56px)' : 0 }}
        aria-hidden={!mobileMenuOpen}
      >
        <nav className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            <Link href="/jobs" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/jobs')}>
              Jobs
            </Link>
            <Link href="/tracker" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/tracker')}>
              Tracker
            </Link>
            {user && (
              <Link
                href={CHAT_HREF}
                onClick={() => setMobileMenuOpen(false)}
                className={mobileLinkClass(CHAT_HREF)}
              >
                <span className="flex items-center gap-2">
                  Chat
                  {!isPro && (
                    <Badge className="bg-indigo-500 text-white text-[10px] px-1.5 py-0 h-4 hover:bg-indigo-500">
                      Pro
                    </Badge>
                  )}
                </span>
              </Link>
            )}
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileLinkClass('/pricing')}
            >
              Pricing
            </Link>
            {user && (
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileLinkClass('/profile')}
              >
                Profile
              </Link>
            )}
          </div>

          <div className="border-t border-[#1e1e28] bg-[#0d0d12] p-5">
            {user ? (
              <div className="flex flex-col gap-3">
                <p className="truncate text-sm text-[#8888aa]">{user.email}</p>
                <button
                  onClick={handleLogout}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#2a2a35] bg-transparent text-base font-medium text-red-400 transition-colors hover:bg-[#1a1a24]"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogin();
                }}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#f0f0fa] px-4 text-base font-semibold text-[#0d0d12] transition-colors hover:bg-white"
              >
                Sign in
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
