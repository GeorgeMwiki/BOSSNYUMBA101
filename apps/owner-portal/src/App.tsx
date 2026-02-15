import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { FinancialPage } from './pages/FinancialPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { MessagesPage } from './pages/MessagesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ESignaturePage } from './pages/documents/ESignature';
import { DisbursementsPage } from './pages/financial/Disbursements';
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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/properties" element={<PropertiesPage />} />
                  <Route path="/properties/:id" element={<PropertyDetailPage />} />
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
                  <Route path="/financial" element={<FinancialPage />} />
                  <Route path="/financial/disbursements" element={<DisbursementsPage />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/documents/e-signature" element={<ESignaturePage />} />
                  <Route path="/approvals" element={<ApprovalsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
