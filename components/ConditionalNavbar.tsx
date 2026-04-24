'use client';

import Navbar, { type NavbarUser } from '@/components/Navbar';

export default function ConditionalNavbar({
  initialUser,
  initialIsPro,
}: {
  initialUser: NavbarUser | null;
  initialIsPro: boolean;
}) {
  return <Navbar initialUser={initialUser} initialIsPro={initialIsPro} />;
}
