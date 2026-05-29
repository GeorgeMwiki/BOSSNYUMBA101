import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Skeleton } from '@bossnyumba/design-system';
import { loaderWithRetry } from '@bossnyumba/performance-toolkit/lazy-load';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpotlightMount } from './components/SpotlightMount';
import { MwikilaWidgetMount } from './components/MwikilaWidgetMount';
import { Layout } from './components/Layout';

// ── EAGER (kept in initial bundle) ──────────────────────────────────
// Auth gates + login / register / invite must paint instantly because
// they are the entry points users see before the rest of the SPA is
// even relevant.
import { LoginPage } from './pages/LoginPage';
import { InvitePage } from './pages/InvitePage';
import { NotFoundPage } from './pages/NotFoundPage';

// ── LAZY (deferred chunks) ──────────────────────────────────────────
// Each route below splits into its own chunk. We use
// `loaderWithRetry` from @bossnyumba/performance-toolkit so a stale
// browser session after a deploy auto-recovers with one retry + one
// full-page reload at most (handles classic `ChunkLoadError`).
//
// Wizard splits (property setup, unit setup, lease draft) and the
// heavy register form are the highest-value splits because they live
// in the first-run path and are >200 LOC each.
//
// Chart-heavy pages (Financial, Operations, Reports, Dashboard,
// Messages, Disbursements, ESignature) are deferred so the initial
// dashboard never eagerly ships recharts (~80KB gzipped) for routes
// the user has not navigated to.

// Wizards — first-run property setup flow.
const RegisterPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
  ),
);
const PropertyCreatePage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/PropertyCreatePage').then((m) => ({
      default: m.PropertyCreatePage,
    })),
  ),
);
const UnitCreatePage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/UnitCreatePage').then((m) => ({ default: m.UnitCreatePage })),
  ),
);
const LeaseDraftPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/LeaseDraftPage').then((m) => ({ default: m.LeaseDraftPage })),
  ),
);

// Heavy / chart-rich pages — defer recharts + heavy data shells.
const DashboardPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
  ),
);
const FinancialPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/FinancialPage').then((m) => ({ default: m.FinancialPage })),
  ),
);
const MessagesPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
  ),
);
const OperationsPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/OperationsPage').then((m) => ({ default: m.OperationsPage })),
  ),
);
const MaintenancePage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/MaintenancePage').then((m) => ({ default: m.MaintenancePage })),
  ),
);
const ReportsPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
  ),
);
const ESignaturePage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/documents/ESignature').then((m) => ({
      default: m.ESignaturePage,
    })),
  ),
);
const DisbursementsPage = React.lazy(
  loaderWithRetry(() =>
    import('./pages/financial/Disbursements').then((m) => ({
      default: m.DisbursementsPage,
    })),
  ),
);

// Remaining route pages — eager-imported here for now because they're
// all small enough that the split overhead would dwarf the savings.
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { DamageDeductionsPage } from './pages/DamageDeductionsPage';
import { GamificationPage } from './pages/GamificationPage';
import { SettingsPage } from './pages/SettingsPage';
import OwnerAdvisor from './pages/OwnerAdvisor';
import Jarvis from './pages/Jarvis';
import PortfolioGradePage from './pages/PortfolioGrade';
import PortfolioPage from './app/portfolio/page';

// Chart-rich pages — defer recharts (~80KB gzipped) per-route.
const PortfolioPerformancePage = React.lazy(
  loaderWithRetry(() => import('./app/portfolio/performance/page')),
);
const PortfolioGrowthPage = React.lazy(
  loaderWithRetry(() => import('./app/portfolio/growth/page')),
);
const AnalyticsPage = React.lazy(
  loaderWithRetry(() => import('./app/analytics/page')),
);
const AnalyticsOccupancyPage = React.lazy(
  loaderWithRetry(() => import('./app/analytics/occupancy/page')),
);
const AnalyticsRevenuePage = React.lazy(
  loaderWithRetry(() => import('./app/analytics/revenue/page')),
);
const AnalyticsExpensesPage = React.lazy(
  loaderWithRetry(() => import('./app/analytics/expenses/page')),
);
import VendorsPage from './app/vendors/page';
import VendorDetailPage from './app/vendors/[id]/page';
import VendorContractsPage from './app/vendors/contracts/page';
import CompliancePage from './app/compliance/page';
import ComplianceLicensesPage from './app/compliance/licenses/page';
import ComplianceInsurancePage from './app/compliance/insurance/page';
import ComplianceInspectionsPage from './app/compliance/inspections/page';
import TenantsPage from './app/tenants/page';
import TenantDetailPage from './app/tenants/[id]/page';
import TenantCommunicationsPage from './app/tenants/communications/page';
// Budget pages also chart-rich.
const BudgetsPage = React.lazy(loaderWithRetry(() => import('./app/budgets/page')));
const PropertyBudgetPage = React.lazy(
  loaderWithRetry(() => import('./app/budgets/[propertyId]/page')),
);
const BudgetForecastsPage = React.lazy(
  loaderWithRetry(() => import('./app/budgets/forecasts/page')),
);
// Phase E.7 — MDR plan + Skills marketplace
import PlanPage from './app/plan/page';
import SkillsPage from './app/skills/page';
// Pages migrated from the deprecated apps/admin-portal/. The owner is the
// admin in the 4-portal model — these surfaces now live here.
import { AuditLogPage } from './pages/AuditLogPage';
import { BillingPage } from './pages/BillingPage';
import ClassroomPage from './pages/Classroom';
import ComplianceSettings from './pages/ComplianceSettings';
import { ConfigurationPage } from './pages/ConfigurationPage';
import DelegationMatrix from './pages/DelegationMatrix';
import MwikilaInbox from './pages/MwikilaInbox';
import MwikilaDelegation from './pages/MwikilaDelegation';
import DesktopReview from './pages/DesktopReview';
import ExceptionsPage from './pages/Exceptions';
import HeadOfEstates from './pages/HeadOfEstates';
import IotSensors from './pages/IotSensors';
import MaintenanceTaxonomy from './pages/MaintenanceTaxonomy';
import ManagerChat from './pages/ManagerChat';
import OrgInsights from './pages/OrgInsights';
import PropertyGrades from './pages/PropertyGrades';
import { RolesPage } from './pages/RolesPage';
import { SupportPage } from './pages/SupportPage';
import { SupportToolingPage } from './pages/SupportToolingPage';
import TenantCredit from './pages/TenantCredit';
import { TenantManagementPage } from './pages/TenantManagementPage';
import Training from './pages/Training';
import { UserRolesPage } from './pages/UserRolesPage';
import { UsersPage } from './pages/UsersPage';
import Workflows from './pages/Workflows';
import ComplianceDataRequestsPage from './pages/ComplianceDataRequestsPage';
import ComplianceDocumentsPage from './pages/ComplianceDocumentsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import IntegrationsApiKeysPage from './pages/IntegrationsApiKeysPage';
import IntegrationsWebhooksPage from './pages/IntegrationsWebhooksPage';
import CommunicationsPage from './pages/CommunicationsPage';
import CommunicationsBroadcastsPage from './pages/CommunicationsBroadcastsPage';
import CommunicationsTemplatesPage from './pages/CommunicationsTemplatesPage';
import CommunicationsCampaignsPage from './pages/CommunicationsCampaignsPage';
import AnalyticsUsagePage from './pages/AnalyticsUsagePage';
import AnalyticsGrowthPage from './pages/AnalyticsGrowthPage';
import AnalyticsExportsPage from './pages/AnalyticsExportsPage';
// Wave-3 INT-4 — MD-vision pages (feature-flagged; default OFF in prod).
import ExecutiveBriefPage from './pages/executive-brief/ExecutiveBriefPage';
import ParcelsMarketplacePage from './pages/parcels-marketplace/ParcelsMarketplacePage';
import WorkforcePage from './pages/workforce/WorkforcePage';
import MissionsPage from './pages/missions/MissionsPage';
import ModulesPage from './pages/modules/ModulesPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" className="min-h-screen flex items-center justify-center p-8">
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

/**
 * Route-level Suspense fallback. Reuses the same skeleton block as
 * the auth gate to avoid layout shift across route transitions.
 */
function RouteSuspenseFallback() {
  return (
    <div aria-busy="true" aria-live="polite" className="p-8">
      <div className="w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

/**
 * HomeRedirect — owner-portal landing route.
 *
 * Most users land on /dashboard. Operators with the HEAD_OF_ESTATES role
 * land on /head-of-estates instead, which is the surface they actually
 * use day-to-day.
 */
function HomeRedirect() {
  const { role, permissions } = useAuth();
  const isHeadOfEstates =
    role === 'HEAD_OF_ESTATES' ||
    permissions.includes('HEAD_OF_ESTATES');
  const target = isHeadOfEstates ? '/head-of-estates' : '/dashboard';
  return <Navigate to={target} replace />;
}

function App() {
  return (
    <AuthProvider>
      <MwikilaWidgetMount>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/register"
          element={
            <Suspense fallback={<RouteSuspenseFallback />}>
              <RegisterPage />
            </Suspense>
          }
        />
        <Route path="/invite" element={<InvitePage />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Suspense fallback={<RouteSuspenseFallback />}>
                  <Routes>
                    <Route path="/" element={<HomeRedirect />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/properties" element={<PropertiesPage />} />
                    <Route path="/properties/new" element={<PropertyCreatePage />} />
                    <Route path="/properties/:id" element={<PropertyDetailPage />} />
                    <Route path="/units/new" element={<UnitCreatePage />} />
                    <Route path="/leases/new" element={<LeaseDraftPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/portfolio/performance" element={<PortfolioPerformancePage />} />
                    <Route path="/portfolio/growth" element={<PortfolioGrowthPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/analytics/occupancy" element={<AnalyticsOccupancyPage />} />
                    <Route path="/analytics/revenue" element={<AnalyticsRevenuePage />} />
                    <Route path="/analytics/expenses" element={<AnalyticsExpensesPage />} />
                    <Route path="/vendors" element={<VendorsPage />} />
                    <Route path="/vendors/contracts" element={<VendorContractsPage />} />
                    <Route path="/vendors/:id" element={<VendorDetailPage />} />
                    <Route path="/compliance" element={<CompliancePage />} />
                    <Route path="/compliance/licenses" element={<ComplianceLicensesPage />} />
                    <Route path="/compliance/insurance" element={<ComplianceInsurancePage />} />
                    <Route path="/compliance/inspections" element={<ComplianceInspectionsPage />} />
                    <Route path="/tenants" element={<TenantsPage />} />
                    <Route path="/tenants/communications" element={<TenantCommunicationsPage />} />
                    <Route path="/tenants/:id" element={<TenantDetailPage />} />
                    <Route path="/budgets" element={<BudgetsPage />} />
                    <Route path="/budgets/forecasts" element={<BudgetForecastsPage />} />
                    <Route path="/budgets/:propertyId" element={<PropertyBudgetPage />} />
                    <Route path="/plan" element={<PlanPage />} />
                    <Route path="/skills" element={<SkillsPage />} />
                    <Route path="/financial" element={<FinancialPage />} />
                    <Route path="/financial/disbursements" element={<DisbursementsPage />} />
                    <Route path="/maintenance" element={<MaintenancePage />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/documents/e-signature" element={<ESignaturePage />} />
                    <Route path="/approvals" element={<ApprovalsPage />} />
                    <Route path="/damage-deductions" element={<DamageDeductionsPage />} />
                    <Route path="/gamification" element={<GamificationPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/advisor" element={<OwnerAdvisor />} />
                    <Route path="/jarvis" element={<Jarvis />} />
                    <Route path="/portfolio-grade" element={<PortfolioGradePage />} />
                    {/* Routes migrated from apps/admin-portal/. */}
                    <Route path="/audit-log" element={<AuditLogPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/classroom" element={<ClassroomPage />} />
                    <Route path="/compliance/settings" element={<ComplianceSettings />} />
                    <Route path="/compliance/data-requests" element={<ComplianceDataRequestsPage />} />
                    <Route path="/compliance/documents" element={<ComplianceDocumentsPage />} />
                    <Route path="/configuration" element={<ConfigurationPage />} />
                    <Route path="/delegation" element={<DelegationMatrix />} />
                    <Route path="/mwikila/inbox" element={<MwikilaInbox />} />
                    <Route path="/mwikila/delegation" element={<MwikilaDelegation />} />
                    <Route path="/desktop-review" element={<DesktopReview />} />
                    <Route path="/exceptions" element={<ExceptionsPage />} />
                    <Route path="/head-of-estates" element={<HeadOfEstates />} />
                    <Route path="/iot-sensors" element={<IotSensors />} />
                    <Route path="/maintenance-taxonomy" element={<MaintenanceTaxonomy />} />
                    <Route path="/manager-chat" element={<ManagerChat />} />
                    <Route path="/operations" element={<OperationsPage />} />
                    <Route path="/org-insights" element={<OrgInsights />} />
                    <Route path="/property-grades" element={<PropertyGrades />} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/support-tooling" element={<SupportToolingPage />} />
                    <Route path="/tenant-credit" element={<TenantCredit />} />
                    <Route path="/tenant-management" element={<TenantManagementPage />} />
                    <Route path="/training" element={<Training />} />
                    <Route path="/user-roles" element={<UserRolesPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/workflows" element={<Workflows />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />
                    <Route path="/integrations/api-keys" element={<IntegrationsApiKeysPage />} />
                    <Route path="/integrations/webhooks" element={<IntegrationsWebhooksPage />} />
                    <Route path="/communications" element={<CommunicationsPage />} />
                    <Route path="/communications/broadcasts" element={<CommunicationsBroadcastsPage />} />
                    <Route path="/communications/templates" element={<CommunicationsTemplatesPage />} />
                    <Route path="/communications/campaigns" element={<CommunicationsCampaignsPage />} />
                    <Route path="/analytics/usage" element={<AnalyticsUsagePage />} />
                    <Route path="/analytics/growth" element={<AnalyticsGrowthPage />} />
                    <Route path="/analytics/exports" element={<AnalyticsExportsPage />} />
                    {/* Wave-3 INT-4 — MD-vision routes, feature-flagged in-component */}
                    <Route path="/executive-brief" element={<ExecutiveBriefPage />} />
                    <Route path="/parcels-marketplace" element={<ParcelsMarketplacePage />} />
                    <Route path="/workforce" element={<WorkforcePage />} />
                    <Route path="/missions" element={<MissionsPage />} />
                    <Route path="/modules" element={<ModulesPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
      <SpotlightMount />
      </MwikilaWidgetMount>
    </AuthProvider>
  );
}

export default App;
