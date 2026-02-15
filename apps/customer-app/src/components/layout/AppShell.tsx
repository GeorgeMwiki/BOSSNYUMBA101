'use client';

import { usePathname } from 'next/navigation';
import { BottomNavigation } from './BottomNavigation';

const HIDE_NAV_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/otp',
  '/onboarding',
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const hideNav = HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route));
  const showBottomNav = !hideNav;

  return (
    <>
      {children}
      {showBottomNav && <BottomNavigation />}
    </>
  );
}
