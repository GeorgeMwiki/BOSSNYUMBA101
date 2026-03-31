import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import PlatformOverviewPage from './app/platform/overview/page';
import PlatformSubscriptionsPage from './app/platform/subscriptions/page';
import PlatformBillingPage from './app/platform/billing/page';
import FeatureFlagsPage from './app/platform/feature-flags/page';
import AnalyticsPage from './app/analytics/page';
import AnalyticsUsagePage from './app/analytics/usage/page';
import AnalyticsGrowthPage from './app/analytics/growth/page';
import AnalyticsExportsPage from './app/analytics/exports/page';
import OnboardingWizard from './pages/tenants/OnboardingWizard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/onboard" element={<OnboardingWizard />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="system" element={<SystemHealthPage />} />
        <Route path="platform">
          <Route index element={<PlatformOverviewPage />} />
          <Route path="overview" element={<PlatformOverviewPage />} />
          <Route path="subscriptions" element={<PlatformSubscriptionsPage />} />
          <Route path="billing" element={<PlatformBillingPage />} />
          <Route path="feature-flags" element={<FeatureFlagsPage />} />
        </Route>
        <Route path="analytics">
          <Route index element={<AnalyticsPage />} />
          <Route path="usage" element={<AnalyticsUsagePage />} />
          <Route path="growth" element={<AnalyticsGrowthPage />} />
          <Route path="exports" element={<AnalyticsExportsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
