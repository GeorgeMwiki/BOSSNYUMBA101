import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

// ─── Tenants ───────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  status: string;
  plan: string;
  properties: number;
  units: number;
  users: number;
  mrr: number;
  createdAt: string;
  primaryContact: { name: string; email: string };
}

const mockTenants: Tenant[] = [
  { id: '1', name: 'Acme Properties Ltd', status: 'ACTIVE', plan: 'Enterprise', properties: 45, units: 320, users: 28, mrr: 125000, createdAt: '2024-03-15', primaryContact: { name: 'John Kamau', email: 'john@acmeproperties.co.ke' } },
  { id: '2', name: 'Sunrise Realty', status: 'ACTIVE', plan: 'Professional', properties: 12, units: 85, users: 8, mrr: 45000, createdAt: '2024-05-20', primaryContact: { name: 'Mary Wanjiku', email: 'mary@sunriserealty.co.ke' } },
  { id: '3', name: 'Metro Housing', status: 'TRIAL', plan: 'Professional', properties: 3, units: 24, users: 2, mrr: 0, createdAt: '2025-01-28', primaryContact: { name: 'Peter Ochieng', email: 'peter@metrohousing.co.ke' } },
  { id: '4', name: 'Coastal Estates', status: 'SUSPENDED', plan: 'Starter', properties: 5, units: 38, users: 4, mrr: 15000, createdAt: '2024-08-10', primaryContact: { name: 'Fatma Hassan', email: 'fatma@coastalestates.co.ke' } },
  { id: '5', name: 'Highland Properties', status: 'ACTIVE', plan: 'Enterprise', properties: 28, units: 195, users: 15, mrr: 95000, createdAt: '2024-01-05', primaryContact: { name: 'David Kipchoge', email: 'david@highland.co.ke' } },
];

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get<Tenant[]>('/tenants');
      if (res.success && res.data) return res.data;
      return mockTenants;
    },
    staleTime: 30_000,
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: async () => {
      const res = await api.get<Tenant>(`/tenants/${id}`);
      if (res.success && res.data) return res.data;
      return mockTenants.find((t) => t.id === id) || null;
    },
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<Tenant>('/tenants', data);
      if (res.success && res.data) return res.data;
      // Mock: simulate creation
      return { id: String(Date.now()), ...data } as unknown as Tenant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

// ─── System Health ─────────────────────────────────────────

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
}

const mockHealth: ServiceHealth[] = [
  { service: 'API Gateway', status: 'healthy', latency: 45, uptime: 99.99, lastCheck: new Date().toISOString(), errorRate: 0.01 },
  { service: 'Auth Service', status: 'healthy', latency: 32, uptime: 99.98, lastCheck: new Date().toISOString(), errorRate: 0.02 },
  { service: 'Payment Service', status: 'healthy', latency: 128, uptime: 99.95, lastCheck: new Date().toISOString(), errorRate: 0.05 },
  { service: 'Notification Service', status: 'degraded', latency: 450, uptime: 98.50, lastCheck: new Date().toISOString(), errorRate: 2.30 },
  { service: 'AI Engine', status: 'healthy', latency: 280, uptime: 99.90, lastCheck: new Date().toISOString(), errorRate: 0.10 },
  { service: 'Database Primary', status: 'healthy', latency: 12, uptime: 99.999, lastCheck: new Date().toISOString(), errorRate: 0.001 },
  { service: 'Redis Cache', status: 'healthy', latency: 3, uptime: 99.99, lastCheck: new Date().toISOString(), errorRate: 0.01 },
  { service: 'Message Queue', status: 'healthy', latency: 8, uptime: 99.98, lastCheck: new Date().toISOString(), errorRate: 0.02 },
];

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await api.get<ServiceHealth[]>('/system/health');
      if (res.success && res.data) return res.data;
      return mockHealth;
    },
    refetchInterval: 30_000,
  });
}

// ─── AI Decisions ──────────────────────────────────────────

export interface AIDecisionRecord {
  id: string;
  type: string;
  tenant: string;
  input: string;
  decision: string;
  confidence: number;
  reasoning: string;
  model: string;
  latencyMs: number;
  timestamp: string;
  status: 'auto_approved' | 'pending_review' | 'approved' | 'rejected' | 'overridden';
  reviewedBy?: string;
  reviewedAt?: string;
}

const mockAIDecisions: AIDecisionRecord[] = [
  { id: 'AI-001', type: 'Late Payment Response', tenant: 'Acme Properties', input: 'Tenant 3 days overdue, KES 45,000', decision: 'Send reminder SMS + grace period', confidence: 0.92, reasoning: 'First-time late payer with good history. Grace period policy allows 5 days.', model: 'bossnyumba-decision-v3', latencyMs: 245, timestamp: '2026-02-13T14:00:00Z', status: 'auto_approved' },
  { id: 'AI-002', type: 'Maintenance Priority', tenant: 'Sunset Estates', input: 'Water leak in Unit 12B', decision: 'Priority: CRITICAL, Dispatch immediate', confidence: 0.98, reasoning: 'Water damage risk high. Similar issues in building require urgent attention.', model: 'bossnyumba-decision-v3', latencyMs: 189, timestamp: '2026-02-13T13:30:00Z', status: 'auto_approved' },
  { id: 'AI-003', type: 'Rent Adjustment', tenant: 'Prime Rentals', input: 'Market analysis for Block A', decision: 'Recommend 8% increase', confidence: 0.78, reasoning: 'Market rates increased 12% but tenant retention risk suggests moderate adjustment.', model: 'bossnyumba-pricing-v2', latencyMs: 1250, timestamp: '2026-02-13T12:00:00Z', status: 'pending_review' },
  { id: 'AI-004', type: 'Lease Renewal', tenant: 'Urban Living', input: 'Tenant renewal request', decision: 'Auto-approve with standard terms', confidence: 0.95, reasoning: 'Perfect payment history, no violations, long-term tenant (3+ years).', model: 'bossnyumba-decision-v3', latencyMs: 312, timestamp: '2026-02-13T11:00:00Z', status: 'approved', reviewedBy: 'admin@bossnyumba.com', reviewedAt: '2026-02-13T11:15:00Z' },
  { id: 'AI-005', type: 'Eviction Assessment', tenant: 'Coastal Homes', input: '90 days overdue, KES 180,000', decision: 'Initiate legal process', confidence: 0.88, reasoning: 'Multiple payment plans defaulted. No response to communication attempts.', model: 'bossnyumba-decision-v3', latencyMs: 478, timestamp: '2026-02-13T10:00:00Z', status: 'pending_review' },
  { id: 'AI-006', type: 'Fraud Detection', tenant: 'Metro Housing', input: 'Duplicate payment detected KES 25,000', decision: 'Flag for review, hold disbursement', confidence: 0.85, reasoning: 'Same amount paid twice within 5 minutes from different M-Pesa numbers linked to same tenant.', model: 'bossnyumba-fraud-v1', latencyMs: 156, timestamp: '2026-02-13T09:30:00Z', status: 'overridden', reviewedBy: 'ops@bossnyumba.com', reviewedAt: '2026-02-13T10:00:00Z' },
  { id: 'AI-007', type: 'Vendor Selection', tenant: 'Acme Properties', input: 'Plumbing repair needed Unit 5A', decision: 'Assign Plumber Pro Ltd', confidence: 0.91, reasoning: 'Highest rated plumber in area, available today, competitive pricing (KES 8,500 estimate).', model: 'bossnyumba-vendor-v1', latencyMs: 523, timestamp: '2026-02-13T09:00:00Z', status: 'auto_approved' },
  { id: 'AI-008', type: 'Communication Tone', tenant: 'Highland Properties', input: 'Overdue notice for long-term tenant', decision: 'Use empathetic tone, offer payment plan', confidence: 0.94, reasoning: 'Tenant of 5 years, first-time late payment, likely temporary hardship.', model: 'bossnyumba-comms-v2', latencyMs: 201, timestamp: '2026-02-12T16:00:00Z', status: 'auto_approved' },
];

export function useAIDecisions(filter?: string) {
  return useQuery({
    queryKey: ['ai-decisions', filter],
    queryFn: async () => {
      const res = await api.get<AIDecisionRecord[]>('/ai/decisions');
      if (res.success && res.data) return res.data;
      if (filter && filter !== 'all') {
        return mockAIDecisions.filter((d) => d.status === filter);
      }
      return mockAIDecisions;
    },
    staleTime: 15_000,
  });
}

export function useReviewAIDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' | 'override' }) => {
      const res = await api.post(`/ai/decisions/${id}/review`, { action });
      if (res.success) return res.data;
      return { id, action };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-decisions'] }),
  });
}

// ─── Support Cases ─────────────────────────────────────────

export interface SupportCaseRecord {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  tenant: string;
  requester: { name: string; email: string; phone?: string };
  assignee: string | null;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
}

const mockCases: SupportCaseRecord[] = [
  { id: '1', ticketNumber: 'SUP-2026-0142', subject: 'Unable to process M-Pesa payments', description: 'Payment gateway timing out', status: 'escalated', priority: 'critical', category: 'Payments', tenant: 'Acme Properties Ltd', requester: { name: 'John Kamau', email: 'john@acme.co.ke', phone: '+254712345678' }, assignee: 'Level 2 Support', escalationLevel: 2, createdAt: '2026-02-13T08:00:00Z', updatedAt: '2026-02-13T10:00:00Z' },
  { id: '2', ticketNumber: 'SUP-2026-0141', subject: 'Custom report generation help', description: 'Need help creating quarterly financial report', status: 'in_progress', priority: 'medium', category: 'Reports', tenant: 'Sunrise Realty', requester: { name: 'Mary Wanjiku', email: 'mary@sunrise.co.ke' }, assignee: 'Support Team', escalationLevel: 0, createdAt: '2026-02-12T14:00:00Z', updatedAt: '2026-02-13T08:00:00Z' },
  { id: '3', ticketNumber: 'SUP-2026-0140', subject: 'API documentation request', description: 'Need API docs for custom integration', status: 'resolved', priority: 'low', category: 'Technical', tenant: 'Highland Properties', requester: { name: 'David Kipchoge', email: 'david@highland.co.ke' }, assignee: 'Support Team', escalationLevel: 0, createdAt: '2026-02-11T09:00:00Z', updatedAt: '2026-02-12T16:00:00Z' },
  { id: '4', ticketNumber: 'SUP-2026-0139', subject: 'Billing inquiry - incorrect charges', description: 'Charged for 50 units but only have 38', status: 'open', priority: 'high', category: 'Billing', tenant: 'Coastal Estates', requester: { name: 'Fatma Hassan', email: 'fatma@coastal.co.ke', phone: '+254723456789' }, assignee: null, escalationLevel: 0, createdAt: '2026-02-10T11:00:00Z', updatedAt: '2026-02-10T11:00:00Z' },
];

export function useSupportCases() {
  return useQuery({
    queryKey: ['support-cases'],
    queryFn: async () => {
      const res = await api.get<SupportCaseRecord[]>('/support/cases');
      if (res.success && res.data) return res.data;
      return mockCases;
    },
    staleTime: 15_000,
  });
}

export function useEscalateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, level, reason }: { id: string; level: number; reason: string }) => {
      const res = await api.post(`/support/cases/${id}/escalate`, { level, reason });
      if (res.success) return res.data;
      return { id, level, reason };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-cases'] }),
  });
}
