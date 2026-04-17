'use client';

import { usePathname } from 'next/navigation';
import Navbar, { type NavbarUser } from '@/components/Navbar';

export default function ConditionalNavbar({
  initialUser,
  initialIsPro,
}: {
  initialUser: NavbarUser | null;
  initialIsPro: boolean;
}) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <Navbar initialUser={initialUser} initialIsPro={initialIsPro} />;
}
