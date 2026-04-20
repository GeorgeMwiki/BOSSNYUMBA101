import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Skeleton } from '@bossnyumba/design-system';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpotlightMount } from './components/SpotlightMount';
import { MwikilaWidgetMount } from './components/MwikilaWidgetMount';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { OperationsPage } from './pages/OperationsPage';
import { SupportPage } from './pages/SupportPage';
import { ReportsPage } from './pages/ReportsPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { NotFoundPage } from './pages/NotFoundPage';
import ManagerChat from './pages/ManagerChat';
import PlatformOverviewPage from './app/platform/overview/page';
import PlatformSubscriptionsPage from './app/platform/subscriptions/page';
import PlatformBillingPage from './app/platform/billing/page';
import FeatureFlagsPage from './app/platform/feature-flags/page';
import CommunicationsPage from './app/communications/page';
import CommunicationsTemplatesPage from './app/communications/templates/page';
import CommunicationsCampaignsPage from './app/communications/campaigns/page';
import CommunicationsBroadcastsPage from './app/communications/broadcasts/page';
import CompliancePage from './app/compliance/page';
import ComplianceDocumentsPage from './app/compliance/documents/page';
import ComplianceDataRequestsPage from './app/compliance/data-requests/page';
import AnalyticsPage from './app/analytics/page';
import AnalyticsUsagePage from './app/analytics/usage/page';
import AnalyticsGrowthPage from './app/analytics/growth/page';
import AnalyticsExportsPage from './app/analytics/exports/page';
import IntegrationsPage from './app/integrations/page';
import IntegrationsWebhooksPage from './app/integrations/webhooks/page';
import IntegrationsApiKeysPage from './app/integrations/api-keys/page';

// New feature pages
import OnboardingWizard from './pages/tenants/OnboardingWizard';
import PermissionMatrix from './pages/roles/PermissionMatrix';
import ApprovalMatrix from './pages/roles/ApprovalMatrix';
import ControlTower from './pages/operations/ControlTower';
import CustomerTimeline from './pages/support/CustomerTimeline';
import Escalation from './pages/support/Escalation';
import AICockpit from './pages/ai/AICockpit';
import DesktopReview from './pages/DesktopReview';
import TrainingPage from './pages/Training';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
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
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="roles/permissions" element={<PermissionMatrix />} />
        <Route path="roles/approvals" element={<ApprovalMatrix />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="operations/control-tower" element={<ControlTower />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="support/timeline" element={<CustomerTimeline />} />
        <Route path="support/escalation" element={<Escalation />} />
        <Route path="ai" element={<AICockpit />} />
        <Route path="manager-chat" element={<ManagerChat />} />
        <Route path="desktop-review" element={<DesktopReview />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="system" element={<SystemHealthPage />} />
        <Route path="platform">
          <Route index element={<PlatformOverviewPage />} />
          <Route path="overview" element={<PlatformOverviewPage />} />
          <Route path="subscriptions" element={<PlatformSubscriptionsPage />} />
          <Route path="billing" element={<PlatformBillingPage />} />
          <Route path="feature-flags" element={<FeatureFlagsPage />} />
        </Route>
        <Route path="communications">
          <Route index element={<CommunicationsPage />} />
          <Route path="templates" element={<CommunicationsTemplatesPage />} />
          <Route path="campaigns" element={<CommunicationsCampaignsPage />} />
          <Route path="broadcasts" element={<CommunicationsBroadcastsPage />} />
        </Route>
        <Route path="compliance">
          <Route index element={<CompliancePage />} />
          <Route path="documents" element={<ComplianceDocumentsPage />} />
          <Route path="data-requests" element={<ComplianceDataRequestsPage />} />
        </Route>
        <Route path="analytics">
          <Route index element={<AnalyticsPage />} />
          <Route path="usage" element={<AnalyticsUsagePage />} />
          <Route path="growth" element={<AnalyticsGrowthPage />} />
          <Route path="exports" element={<AnalyticsExportsPage />} />
        </Route>
        <Route path="integrations">
          <Route index element={<IntegrationsPage />} />
          <Route path="webhooks" element={<IntegrationsWebhooksPage />} />
          <Route path="api-keys" element={<IntegrationsApiKeysPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MwikilaWidgetMount>
        <AppRoutes />
        <SpotlightMount />
      </MwikilaWidgetMount>
    </AuthProvider>
  );
}
