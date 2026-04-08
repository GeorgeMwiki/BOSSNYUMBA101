'use client';

/**
 * ProtectedRoute — client-side guard for tenant/resident pages.
 *
 * Redirects to `/auth/login` if the user is not authenticated after the
 * AuthContext finishes its mount-time hydration. While loading it renders
 * a lightweight spinner so pages don't flash unauthenticated content.
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Override the redirect target (defaults to `/auth/login`). */
  redirectTo?: string;
  /** Optional fallback rendered while auth state is hydrating. */
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  redirectTo = '/auth/login',
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      fallback ?? (
        <div
          role="status"
          aria-live="polite"
          className="min-h-screen flex items-center justify-center"
        >
          <div className="w-10 h-10 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
          <span className="sr-only">Loading…</span>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
