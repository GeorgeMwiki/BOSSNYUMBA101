'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BottomNavigation } from './BottomNavigation';

const HIDE_NAV_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/otp',
  '/onboarding',
  '/for-owners',
  '/for-tenants',
  '/for-managers',
  '/for-station-masters',
  '/pricing',
  '/how-it-works',
  '/compare',
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const hideNav = HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route));
  const showBottomNav = !hideNav;
  const tA11y = useTranslations('a11y');

  return (
    <>
      <a href="#main-content" className="skip-link">
        {tA11y('skipToMain')}
      </a>
      <main id="main-content" tabIndex={-1}>{children}</main>
      {showBottomNav && <BottomNavigation />}
    </>
  );
}
