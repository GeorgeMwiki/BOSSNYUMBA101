/**
 * ProtectedRoute — react-router guard for owner-portal.
 *
 * Redirects to `/login` if the user is not authenticated after the
 * AuthContext finishes hydrating. While hydrating it shows a spinner so
 * protected pages don't flash unauthenticated content.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Override the redirect target (defaults to `/login`). */
  redirectTo?: string;
  /** Optional fallback rendered while auth state is hydrating. */
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  redirectTo = '/login',
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <>
        {fallback ?? (
          <div
            role="status"
            aria-live="polite"
            className="min-h-screen flex items-center justify-center"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <span className="sr-only">Loading…</span>
          </div>
        )}
      </>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
