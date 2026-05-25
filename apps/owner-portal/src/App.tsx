import { Routes, Route, Navigate } from 'react-router-dom';
import { Skeleton } from '@bossnyumba/design-system';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SpotlightMount } from './components/SpotlightMount';
import { MwikilaWidgetMount } from './components/MwikilaWidgetMount';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InvitePage } from './pages/InvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { PropertyCreatePage } from './pages/PropertyCreatePage';
import { UnitCreatePage } from './pages/UnitCreatePage';
import { LeaseDraftPage } from './pages/LeaseDraftPage';
import { FinancialPage } from './pages/FinancialPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { DamageDeductionsPage } from './pages/DamageDeductionsPage';
import { GamificationPage } from './pages/GamificationPage';
import { ReportsPage } from './pages/ReportsPage';
import { MessagesPage } from './pages/MessagesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ESignaturePage } from './pages/documents/ESignature';
import { DisbursementsPage } from './pages/financial/Disbursements';
import { NotFoundPage } from './pages/NotFoundPage';
import OwnerAdvisor from './pages/OwnerAdvisor';
import Jarvis from './pages/Jarvis';
import PortfolioGradePage from './pages/PortfolioGrade';
import PortfolioPage from './app/portfolio/page';
import PortfolioPerformancePage from './app/portfolio/performance/page';
import PortfolioGrowthPage from './app/portfolio/growth/page';
import AnalyticsPage from './app/analytics/page';
import AnalyticsOccupancyPage from './app/analytics/occupancy/page';
import AnalyticsRevenuePage from './app/analytics/revenue/page';
import AnalyticsExpensesPage from './app/analytics/expenses/page';
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
import BudgetsPage from './app/budgets/page';
import PropertyBudgetPage from './app/budgets/[propertyId]/page';
import BudgetForecastsPage from './app/budgets/forecasts/page';
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
import DesktopReview from './pages/DesktopReview';
import ExceptionsPage from './pages/Exceptions';
import HeadOfEstates from './pages/HeadOfEstates';
import IotSensors from './pages/IotSensors';
import MaintenanceTaxonomy from './pages/MaintenanceTaxonomy';
import ManagerChat from './pages/ManagerChat';
import { OperationsPage } from './pages/OperationsPage';
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
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
