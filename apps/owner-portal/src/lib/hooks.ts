/**
 * Owner portal React Query hooks.
 *
 * Consolidates server-state access so pages stop duplicating
 * `useState + useEffect + api.get` patterns. Mirrors the pattern
 * established in admin-portal/src/lib/hooks.ts — keep shapes aligned
 * so a shared package can replace both files later.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

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
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => unwrap(await api.get<Property[]>('/properties'), 'Properties'),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
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
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => unwrap(await api.get<OwnerTenant[]>('/tenants'), 'Tenants'),
  });
}

export interface TenantDetail extends OwnerTenant {
  leaseStartDate: string;
  balance?: number;
  payments?: Array<{ id: string; amount: number; date: string; status: string }>;
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenants', id],
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
  return useQuery({
    queryKey: ['tenants', 'communications'],
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
  return useQuery({
    queryKey: ['vendors'],
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
  return useQuery({
    queryKey: ['vendors', id],
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
  return useQuery({
    queryKey: ['vendors', 'contracts'],
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
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => unwrap(await api.get<Approval[]>('/approvals'), 'Approvals'),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/approve`, { decision: decision ?? 'Approved' }),
        'Approve request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/reject`, { decision: decision ?? 'Rejected' }),
        'Reject request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
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
  return useQuery({
    queryKey: ['portfolio', 'summary'],
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
  return useQuery({
    queryKey: ['portfolio', 'performance'],
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
  return useQuery({
    queryKey: ['portfolio', 'growth'],
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
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () =>
      unwrap(await api.get<AnalyticsSummary>('/analytics/summary'), 'Analytics summary'),
  });
}

export function useOccupancyAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'occupancy'],
    queryFn: async () =>
      unwrap(
        await api.get<Array<{ month: string; rate: number }>>('/analytics/occupancy'),
        'Occupancy analytics'
      ),
  });
}

export function useRevenueAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: async () =>
      unwrap(
        await api.get<Array<{ month: string; rent: number; other: number }>>('/analytics/revenue'),
        'Revenue analytics'
      ),
  });
}

export function useExpensesAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'expenses'],
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
  return useQuery({
    queryKey: ['budgets', 'summary'],
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
  return useQuery({
    queryKey: ['budgets', propertyId],
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
  return useQuery({
    queryKey: ['budgets', 'forecasts'],
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
  return useQuery({
    queryKey: ['compliance', 'summary'],
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
  return useQuery({
    queryKey: ['compliance', 'licenses'],
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
  return useQuery({
    queryKey: ['compliance', 'inspections'],
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
  return useQuery({
    queryKey: ['compliance', 'insurance'],
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
  return useQuery({
    queryKey: ['documents'],
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
  return useQuery({
    queryKey: ['owner', 'work-orders'],
    queryFn: async () =>
      unwrap(await api.get<OwnerWorkOrder[]>('/owner/work-orders'), 'Work orders'),
  });
}

export function useApproveWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return unwrap(
        await api.post(`/owner/work-orders/${id}/approve`, { decision: 'APPROVED' }),
        'Approve work order'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner', 'work-orders'] }),
  });
}

export function useRejectWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return unwrap(
        await api.post(`/owner/work-orders/${id}/reject`, { decision: 'REJECTED', reason }),
        'Reject work order'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner', 'work-orders'] }),
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
  return useQuery({
    queryKey: ['owner', 'financial', 'stats'],
    queryFn: async () =>
      unwrap(await api.get<FinancialStats>('/owner/financial/stats'), 'Financial stats'),
  });
}

export function useOwnerInvoices() {
  return useQuery({
    queryKey: ['owner', 'invoices'],
    queryFn: async () =>
      unwrap(await api.get<FinancialInvoice[]>('/owner/invoices'), 'Invoices'),
  });
}

export function useOwnerPayments() {
  return useQuery({
    queryKey: ['owner', 'payments'],
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
  const qs = new URLSearchParams();
  if (propertyId && propertyId !== 'all') qs.append('propertyId', propertyId);
  qs.append('dateRange', dateRange);
  return useQuery({
    queryKey: ['owner', 'dashboard', propertyId ?? 'all', dateRange],
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
  return useQuery({
    queryKey: ['owner', 'messaging', 'conversations'],
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
  return useQuery({
    queryKey: ['owner', 'messaging', 'conversations', conversationId, 'messages'],
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
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return unwrap(
        await api.post(`/owner/messaging/conversations/${conversationId}/messages`, { content }),
        'Send message'
      );
    },
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({
        queryKey: ['owner', 'messaging', 'conversations', conversationId, 'messages'],
      });
      qc.invalidateQueries({ queryKey: ['owner', 'messaging', 'conversations'] });
    },
  });
}
