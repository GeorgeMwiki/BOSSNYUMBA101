'use client';

/**
 * AuthGate — route-level access control for the estate-manager app.
 *
 * Wraps the authenticated surface. Logged-out operators are redirected to
 * `/login` (instead of rendering protected pages that would fire 401s and
 * crash on missing data), and an already-authenticated operator who lands
 * on `/login` is bounced to the home dashboard.
 *
 * The `/login` route itself is public and renders its children directly so
 * the sign-in form is reachable. While the Supabase session is still
 * hydrating we show a minimal loading state to avoid a flash of either the
 * login form or a protected page.
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from './AuthProvider';

const LOGIN_PATH = '/login';

/** Routes that must render without an authenticated session. */
function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

export function AuthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const t = useTranslations('authLogin');
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();
  const onPublic = isPublicPath(pathname);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated && !onPublic) {
      const next =
        pathname && pathname !== '/'
          ? `?next=${encodeURIComponent(pathname)}`
          : '';
      router.replace(`${LOGIN_PATH}${next}`);
      return;
    }
    if (isAuthenticated && onPublic) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, onPublic, pathname, router]);

  // Public routes (login) always render — the page's own redirect handles
  // the authenticated case.
  if (onPublic) {
    return <>{children}</>;
  }

  // Protected routes: hold rendering until the session resolves, and while
  // a redirect to /login is in flight, so no protected page ever paints
  // without a session.
  if (loading || !isAuthenticated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="text-sm text-neutral-500">{t('checkingSession')}</span>
      </div>
    );
  }

  return <>{children}</>;
}
