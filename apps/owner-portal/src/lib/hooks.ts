/**
 * Owner portal React Query hooks.
 *
 * Consolidates server-state access so pages stop duplicating
 * `useState + useEffect + api.get` patterns. Mirrors the pattern
 * established in admin-portal/src/lib/hooks.ts — keep shapes aligned
 * so a shared package can replace both files later.
 *
 * Tenant scoping (round-3 C-3): every queryKey is prefixed via
 * `tenantKey(tenantId, ...)` so that two tenants' caches can never
 * collide. The owner-portal does not currently support live tenant
 * switching mid-session, but the scope is still required because
 * logout + re-login as a different tenant otherwise served stale
 * data from the React Query cache until each query refetched.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from '../contexts/AuthContext';
import { tenantKey } from './tenant-scoped-key';

function unwrap<T>(
  result: { success: boolean; data?: T; error?: { message: string } | string },
  feature: string
): T {
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  const message =
    typeof result.error === 'string'
      ? result.error
      : result.error?.message || `${feature} unavailable`;
  throw new Error(message);
}

/**
 * Read the active tenant id for scoping query keys. Returns `null`
 * when no tenant is loaded yet so the key prefix becomes
 * `'no-tenant'` (see `tenant-scoped-key.ts`).
 */
function useTenantScope(): string | null {
  const { tenant } = useAuth();
  return tenant?.id ?? null;
}

// ─── Properties ────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  type: string;
  status: string;
  address: {
    line1: string;
    city: string;
    region?: string;
    country: string;
  };
  totalUnits: number;
  occupiedUnits: number;
  monthlyRevenue?: number;
}

export function useProperties() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'properties'),
    queryFn: async () => unwrap(await api.get<Property[]>('/properties'), 'Properties'),
  });
}

export function useProperty(id: string) {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'properties', id),
    queryFn: async () => unwrap(await api.get<Property>(`/properties/${id}`), 'Property'),
    enabled: !!id,
  });
}

// ─── Tenants ───────────────────────────────────────────────

export interface OwnerTenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  leaseEndDate: string;
  rentAmount: number;
  status: string;
}

export function useTenants() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'tenants'),
    queryFn: async () => unwrap(await api.get<OwnerTenant[]>('/tenants'), 'Tenants'),
  });
}

export interface TenantDetail extends OwnerTenant {
  leaseStartDate: string;
  balance?: number;
  payments?: Array<{ id: string; amount: number; date: string; status: string }>;
}

export function useTenant(id: string) {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'tenants', id),
    queryFn: async () => unwrap(await api.get<TenantDetail>(`/tenants/${id}`), 'Tenant'),
    enabled: !!id,
  });
}

export interface TenantConversation {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
}

export function useTenantCommunications() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'tenants', 'communications'),
    queryFn: async () =>
      unwrap(await api.get<TenantConversation[]>('/tenants/communications'), 'Tenant communications'),
  });
}

// ─── Vendors ───────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  status: string;
  propertiesCount?: number;
}

export function useVendors() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'vendors'),
    queryFn: async () => unwrap(await api.get<Vendor[]>('/vendors'), 'Vendors'),
  });
}

export interface VendorDetail {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
  properties: Array<{ id: string; name: string }>;
  recentWorkOrders?: Array<{ id: string; description: string; status: string; createdAt: string }>;
}

export function useVendor(id: string) {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'vendors', id),
    queryFn: async () => unwrap(await api.get<VendorDetail>(`/vendors/${id}`), 'Vendor'),
    enabled: !!id,
  });
}

export interface VendorContract {
  id: string;
  vendorId: string;
  vendorName: string;
  propertyId: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  value: number;
  status: string;
  type: string;
}

export function useVendorContracts() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'vendors', 'contracts'),
    queryFn: async () =>
      unwrap(await api.get<VendorContract[]>('/vendors/contracts'), 'Vendor contracts'),
  });
}

// ─── Approvals ─────────────────────────────────────────────

export interface Approval {
  id: string;
  type: string;
  status: string;
  entityType: string;
  entityId: string;
  requestedAction: string;
  justification?: string;
  decision?: string;
  createdAt: string;
  decidedAt?: string;
  requester?: { id: string; name: string };
  approver?: { id: string; name: string };
}

export function useApprovals() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'approvals'),
    queryFn: async () => unwrap(await api.get<Approval[]>('/approvals'), 'Approvals'),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  const tenantId = useTenantScope();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/approve`, { decision: decision ?? 'Approved' }),
        'Approve request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'approvals') }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  const tenantId = useTenantScope();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/reject`, { decision: decision ?? 'Rejected' }),
        'Reject request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'approvals') }),
  });
}

// ─── Portfolio ─────────────────────────────────────────────

export interface PortfolioSummary {
  totalProperties: number;
  totalUnits: number;
  totalValue: number;
  monthlyRevenue: number;
  occupancyRate: number;
  yoyGrowth: number;
}

export function usePortfolioSummary() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'portfolio', 'summary'),
    queryFn: async () =>
      unwrap(await api.get<PortfolioSummary>('/portfolio/summary'), 'Portfolio summary'),
  });
}

export interface PropertyPerformance {
  id: string;
  name: string;
  revenue: number;
  occupancy: number;
  noi: number;
  capRate?: number;
}

export function usePortfolioPerformance() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'portfolio', 'performance'),
    queryFn: async () =>
      unwrap(await api.get<PropertyPerformance[]>('/portfolio/performance'), 'Portfolio performance'),
  });
}

export interface PortfolioGrowth {
  month: string;
  revenue: number;
  value: number;
  occupancy: number;
}

export function usePortfolioGrowth() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'portfolio', 'growth'),
    queryFn: async () =>
      unwrap(await api.get<PortfolioGrowth[]>('/portfolio/growth'), 'Portfolio growth'),
  });
}

// ─── Analytics ─────────────────────────────────────────────

export interface AnalyticsSummary {
  occupancy: number;
  revenue: number;
  expenses: number;
  noi: number;
}

export function useAnalyticsSummary() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'analytics', 'summary'),
    queryFn: async () =>
      unwrap(await api.get<AnalyticsSummary>('/analytics/summary'), 'Analytics summary'),
  });
}

export function useOccupancyAnalytics() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'analytics', 'occupancy'),
    queryFn: async () =>
      unwrap(
        await api.get<Array<{ month: string; rate: number }>>('/analytics/occupancy'),
        'Occupancy analytics'
      ),
  });
}

export function useRevenueAnalytics() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'analytics', 'revenue'),
    queryFn: async () =>
      unwrap(
        await api.get<Array<{ month: string; rent: number; other: number }>>('/analytics/revenue'),
        'Revenue analytics'
      ),
  });
}

export function useExpensesAnalytics() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'analytics', 'expenses'),
    queryFn: async () =>
      unwrap(
        await api.get<
          Array<{ month: string; maintenance: number; utilities: number; admin: number }>
        >('/analytics/expenses'),
        'Expenses analytics'
      ),
  });
}

// ─── Budgets ───────────────────────────────────────────────

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  variance: number;
  byCategory: Array<{ category: string; budgeted: number; spent: number }>;
}

export function useBudgetSummary() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'budgets', 'summary'),
    queryFn: async () =>
      unwrap(await api.get<BudgetSummary>('/budgets/summary'), 'Budget summary'),
  });
}

export interface PropertyBudget {
  propertyId: string;
  propertyName: string;
  totalBudget: number;
  totalSpent: number;
  categories: Array<{
    category: string;
    budgeted: number;
    spent: number;
    variance: number;
  }>;
}

export function usePropertyBudget(propertyId: string) {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'budgets', propertyId),
    queryFn: async () =>
      unwrap(await api.get<PropertyBudget>(`/budgets/${propertyId}`), 'Property budget'),
    enabled: !!propertyId,
  });
}

export interface BudgetForecast {
  month: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNoi: number;
}

export function useBudgetForecasts() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'budgets', 'forecasts'),
    queryFn: async () =>
      unwrap(await api.get<BudgetForecast[]>('/budgets/forecasts'), 'Budget forecasts'),
  });
}

// ─── Compliance ────────────────────────────────────────────

export interface ComplianceSummary {
  compliant: number;
  expiringSoon: number;
  overdue: number;
  totalItems: number;
}

export function useComplianceSummary() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'compliance', 'summary'),
    queryFn: async () =>
      unwrap(await api.get<ComplianceSummary>('/compliance/summary'), 'Compliance summary'),
  });
}

export interface License {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  number: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: string;
}

export function useLicenses() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'compliance', 'licenses'),
    queryFn: async () =>
      unwrap(await api.get<License[]>('/compliance/licenses'), 'Licenses'),
  });
}

export interface Inspection {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  scheduledDate: string;
  completedDate?: string;
  status: string;
  result?: string;
}

export function useInspections() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'compliance', 'inspections'),
    queryFn: async () =>
      unwrap(await api.get<Inspection[]>('/compliance/inspections'), 'Inspections'),
  });
}

export interface InsurancePolicy {
  id: string;
  propertyId: string;
  propertyName: string;
  provider: string;
  type: string;
  policyNumber: string;
  coverage: number;
  premium: number;
  startDate: string;
  endDate: string;
  status: string;
}

export function useInsurancePolicies() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'compliance', 'insurance'),
    queryFn: async () =>
      unwrap(await api.get<InsurancePolicy[]>('/compliance/insurance'), 'Insurance policies'),
  });
}

// ─── Documents ─────────────────────────────────────────────

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedBy: string;
  changeNote?: string;
  size: number;
}

export interface OwnerDocument {
  id: string;
  type: string;
  category: string;
  name: string;
  mimeType: string;
  size: number;
  verificationStatus: string;
  verifiedAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  customer?: { id: string; name: string };
  requiresSignature?: boolean;
  signatureStatus?: 'PENDING' | 'SIGNED' | 'EXPIRED';
  signedAt?: string;
  signedBy?: string;
  versions?: DocumentVersion[];
}

export function useDocuments() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'documents'),
    queryFn: async () => unwrap(await api.get<OwnerDocument[]>('/documents'), 'Documents'),
  });
}

// ─── Work Orders (Maintenance) ─────────────────────────────

export interface OwnerWorkOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reportedAt: string;
  scheduledAt?: string;
  completedAt?: string;
  estimatedCost?: number;
  actualCost?: number;
  requiresApproval?: boolean;
  approvalThreshold?: number;
  unit?: { id: string; unitNumber: string };
  property?: { id: string; name: string };
  customer?: { id: string; name: string; phone?: string };
  vendor?: { id: string; name: string; phone?: string };
}

export function useOwnerWorkOrders() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'work-orders'),
    queryFn: async () =>
      unwrap(await api.get<OwnerWorkOrder[]>('/owner/work-orders'), 'Work orders'),
  });
}

export function useApproveWorkOrder() {
  const qc = useQueryClient();
  const tenantId = useTenantScope();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return unwrap(
        await api.post(`/owner/work-orders/${id}/approve`, { decision: 'APPROVED' }),
        'Approve work order'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'owner', 'work-orders') }),
  });
}

export function useRejectWorkOrder() {
  const qc = useQueryClient();
  const tenantId = useTenantScope();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return unwrap(
        await api.post(`/owner/work-orders/${id}/reject`, { decision: 'REJECTED', reason }),
        'Reject work order'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'owner', 'work-orders') }),
  });
}

// ─── Financial ─────────────────────────────────────────────

export interface FinancialStats {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  pendingDisbursement: number;
}

export interface FinancialInvoice {
  id: string;
  number: string;
  status: string;
  type: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  customer?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  property?: { id: string; name: string };
  lineItems?: { description: string; amount: number }[];
}

export interface FinancialPayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string;
  createdAt: string;
  customer?: { id: string; name: string };
  invoiceId?: string;
}

export function useFinancialStats() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'financial', 'stats'),
    queryFn: async () =>
      unwrap(await api.get<FinancialStats>('/owner/financial/stats'), 'Financial stats'),
  });
}

export function useOwnerInvoices() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'invoices'),
    queryFn: async () =>
      unwrap(await api.get<FinancialInvoice[]>('/owner/invoices'), 'Invoices'),
  });
}

export function useOwnerPayments() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'payments'),
    queryFn: async () =>
      unwrap(await api.get<FinancialPayment[]>('/owner/payments'), 'Payments'),
  });
}

// ─── Dashboard ─────────────────────────────────────────────

export interface ArrearsAging {
  bucket: string;
  amount: number;
  count: number;
}

export interface OwnerDashboardData {
  portfolio: {
    totalProperties: number;
    totalUnits: number;
    portfolioValue: number;
  };
  financial: {
    currentMonthRevenue: number;
    revenueChange: number;
    outstandingBalance: number;
    collectionRate: number;
    collectionRateChange: number;
    noi: number;
  };
  maintenance: {
    openRequests: number;
    inProgress: number;
    completedThisMonth: number;
    totalCostThisMonth: number;
    pendingApprovals: number;
  };
  occupancy: {
    occupancyRate: number;
    occupancyChange: number;
    vacantUnits: number;
    totalTenants: number;
  };
  arrears: ArrearsAging[];
  recentActivity: {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
  }[];
  alerts: {
    id: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
  }[];
}

export type DashboardRange = '7d' | '30d' | '90d' | '1y';

export function useOwnerDashboard(params: {
  propertyId?: string;
  dateRange: DashboardRange;
}) {
  const { propertyId, dateRange } = params;
  const tenantId = useTenantScope();
  const qs = new URLSearchParams();
  if (propertyId && propertyId !== 'all') qs.append('propertyId', propertyId);
  qs.append('dateRange', dateRange);
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'dashboard', propertyId ?? 'all', dateRange),
    queryFn: async () =>
      unwrap(
        await api.get<OwnerDashboardData>(`/dashboard/owner?${qs.toString()}`),
        'Owner dashboard'
      ),
  });
}

// ─── Messaging (Owner) ─────────────────────────────────────

export interface MessagingConversation {
  id: string;
  participantName: string;
  participantRole: string;
  participantInitials: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline?: boolean;
  propertyContext?: string;
}

export interface MessagingAttachment {
  id: string;
  type: 'image' | 'document' | 'file';
  name: string;
  url: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface MessagingMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'owner' | 'manager' | 'system';
  senderName: string;
  content: string;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  attachments: MessagingAttachment[];
  readAt?: string;
  createdAt: string;
}

export function useOwnerConversations() {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'messaging', 'conversations'),
    queryFn: async () =>
      unwrap(
        await api.get<MessagingConversation[]>('/owner/messaging/conversations'),
        'Conversations'
      ),
  });
}

export function useOwnerConversationMessages(
  conversationId: string | null,
  options: { pollMs?: number } = {}
) {
  const tenantId = useTenantScope();
  return useQuery({
    queryKey: tenantKey(tenantId, 'owner', 'messaging', 'conversations', conversationId, 'messages'),
    queryFn: async () =>
      unwrap(
        await api.get<MessagingMessage[]>(
          `/owner/messaging/conversations/${conversationId}/messages`
        ),
        'Messages'
      ),
    enabled: !!conversationId,
    refetchInterval: options.pollMs,
  });
}

export function useSendOwnerMessage() {
  const qc = useQueryClient();
  const tenantId = useTenantScope();
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return unwrap(
        await api.post(`/owner/messaging/conversations/${conversationId}/messages`, { content }),
        'Send message'
      );
    },
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({
        queryKey: tenantKey(tenantId, 'owner', 'messaging', 'conversations', conversationId, 'messages'),
      });
      qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'owner', 'messaging', 'conversations') });
    },
  });
}
