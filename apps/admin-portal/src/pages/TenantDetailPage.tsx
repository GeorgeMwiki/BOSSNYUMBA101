import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  Home,
  CreditCard,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  MoreVertical,
  Shield,
  FileText,
  X,
  Save,
  RefreshCw,
  Pause,
  Play,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Activity,
  DollarSign,
  Bell,
} from 'lucide-react';
import { api, formatCurrency, formatDate, formatDateTime } from '../lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface PolicyConstitution {
  paymentGracePeriodDays: number;
  lateFeePercentage: number;
  maintenanceApprovalThreshold: number;
  autoRemindersEnabled: boolean;
  reminderSchedule: string[];
  legalEscalationDays: number;
  depositMultiplier: number;
  noticeRequiredDays: number;
  renewalWindowDays: number;
  allowPartialPayments: boolean;
}

interface ApprovalMatrix {
  id: string;
  action: string;
  threshold: number;
  approverRole: string;
  escalationHours: number;
}

interface TenantDetail {
  id: string;
  name: string;
  status: string;
  plan: string;
  domain: string;
  properties: number;
  units: number;
  users: number;
  mrr: number;
  createdAt: string;
  primaryContact: {
    name: string;
    email: string;
    phone: string;
  };
  billingAddress: {
    line1: string;
    city: string;
    country: string;
  };
  subscription: {
    plan: string;
    status: string;
    nextBillingDate: string;
    amount: number;
    trialEndsAt?: string;
  };
  usage: {
    properties: { used: number; limit: number };
    units: { used: number; limit: number };
    users: { used: number; limit: number };
    storage: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
    messages: { used: number; limit: number };
  };
  policyConstitution: PolicyConstitution;
  approvalMatrix: ApprovalMatrix[];
}

interface UsageMetric {
  date: string;
  apiCalls: number;
  messages: number;
  activeUsers: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [policyForm, setPolicyForm] = useState<PolicyConstitution | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Mock data for demo
    const mockTenant: TenantDetail = {
      id: id || '1',
      name: 'Acme Properties Ltd',
      status: 'ACTIVE',
      plan: 'Enterprise',
      domain: 'acme.bossnyumba.com',
      properties: 45,
      units: 320,
      users: 28,
      mrr: 125000,
      createdAt: '2024-03-15',
      primaryContact: {
        name: 'John Kamau',
        email: 'john@acmeproperties.co.ke',
        phone: '+254 722 123 456',
      },
      billingAddress: {
        line1: '123 Kenyatta Avenue',
        city: 'Nairobi',
        country: 'Kenya',
      },
      subscription: {
        plan: 'Enterprise',
        status: 'active',
        nextBillingDate: '2025-02-15',
        amount: 125000,
      },
      usage: {
        properties: { used: 45, limit: 100 },
        units: { used: 320, limit: 500 },
        users: { used: 28, limit: 50 },
        storage: { used: 2.4, limit: 10 },
        apiCalls: { used: 45000, limit: 100000 },
        messages: { used: 12500, limit: 50000 },
      },
      policyConstitution: {
        paymentGracePeriodDays: 5,
        lateFeePercentage: 5,
        maintenanceApprovalThreshold: 500000,
        autoRemindersEnabled: true,
        reminderSchedule: ['3_days_before', '1_day_before', 'due_day', '3_days_after', '7_days_after'],
        legalEscalationDays: 60,
        depositMultiplier: 2,
        noticeRequiredDays: 30,
        renewalWindowDays: 90,
        allowPartialPayments: true,
      },
      approvalMatrix: [
        { id: '1', action: 'Work Order', threshold: 500000, approverRole: 'Owner', escalationHours: 24 },
        { id: '2', action: 'Payment Plan', threshold: 1000000, approverRole: 'Manager', escalationHours: 12 },
        { id: '3', action: 'Fee Waiver', threshold: 100000, approverRole: 'Owner', escalationHours: 48 },
        { id: '4', action: 'Lease Modification', threshold: 0, approverRole: 'Owner', escalationHours: 72 },
      ],
    };
    setTenant(mockTenant);
    setPolicyForm(mockTenant.policyConstitution);

    // Mock usage metrics
    setUsageMetrics([
      { date: '2026-02-07', apiCalls: 5200, messages: 1800, activeUsers: 24 },
      { date: '2026-02-08', apiCalls: 4800, messages: 2100, activeUsers: 26 },
      { date: '2026-02-09', apiCalls: 3200, messages: 1200, activeUsers: 18 },
      { date: '2026-02-10', apiCalls: 5800, messages: 2400, activeUsers: 25 },
      { date: '2026-02-11', apiCalls: 6200, messages: 2800, activeUsers: 28 },
      { date: '2026-02-12', apiCalls: 5500, messages: 2200, activeUsers: 27 },
      { date: '2026-02-13', apiCalls: 4900, messages: 1900, activeUsers: 23 },
    ]);

    // Mock audit log
    setAuditLog([
      { id: '1', action: 'User Login', actor: 'john@acme.com', target: 'Session', details: 'Successful login from Chrome on macOS', timestamp: '2026-02-13T08:30:00Z', ipAddress: '196.207.120.45' },
      { id: '2', action: 'Property Created', actor: 'mary@acme.com', target: 'Property: Sunset Apartments', details: 'New property with 24 units', timestamp: '2026-02-12T14:15:00Z', ipAddress: '196.207.120.52' },
      { id: '3', action: 'User Invited', actor: 'john@acme.com', target: 'david@acme.com', details: 'Invited as Estate Manager', timestamp: '2026-02-12T10:00:00Z', ipAddress: '196.207.120.45' },
      { id: '4', action: 'Settings Updated', actor: 'john@acme.com', target: 'Policy Constitution', details: 'Updated late fee from 3% to 5%', timestamp: '2026-02-11T16:45:00Z', ipAddress: '196.207.120.45' },
      { id: '5', action: 'Subscription Renewed', actor: 'System', target: 'Enterprise Plan', details: 'Auto-renewal successful', timestamp: '2026-02-10T00:00:00Z', ipAddress: 'N/A' },
    ]);

    setLoading(false);
  }, [id]);

  const handleSavePolicy = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (tenant && policyForm) {
      setTenant({ ...tenant, policyConstitution: policyForm });
    }
    setSaving(false);
    setShowPolicyModal(false);
    setNotification({ type: 'success', message: 'Policy Constitution updated successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSuspend = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (tenant) {
      setTenant({ ...tenant, status: 'SUSPENDED' });
    }
    setSaving(false);
    setShowSuspendModal(false);
    setNotification({ type: 'success', message: 'Tenant suspended successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleReactivate = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (tenant) {
      setTenant({ ...tenant, status: 'ACTIVE' });
    }
    setSaving(false);
    setNotification({ type: 'success', message: 'Tenant reactivated successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (!tenant) {
    return <div>Tenant not found</div>;
  }

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'users', name: 'Users' },
    { id: 'policy', name: 'Policy Constitution' },
    { id: 'usage', name: 'Usage Metrics' },
    { id: 'billing', name: 'Billing' },
    { id: 'audit', name: 'Audit Log' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/tenants"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Building2 className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              <p className="text-gray-500">{tenant.domain}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              tenant.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : tenant.status === 'TRIAL'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {tenant.status}
          </span>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Home className="h-4 w-4" />
                  <span className="text-sm">Properties</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {tenant.properties}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm">Units</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {tenant.units}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Users</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {tenant.users}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">MRR</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(tenant.mrr)}
                </p>
              </div>
            </div>

            {/* Usage */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Resource Usage
              </h3>
              <div className="space-y-4">
                {Object.entries(tenant.usage).map(([key, value]) => {
                  const percentage = (value.used / value.limit) * 100;
                  const label =
                    key === 'storage'
                      ? `${value.used}GB / ${value.limit}GB`
                      : `${value.used} / ${value.limit}`;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {key}
                        </span>
                        <span className="text-sm text-gray-500">{label}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            percentage >= 90
                              ? 'bg-red-500'
                              : percentage >= 70
                              ? 'bg-amber-500'
                              : 'bg-violet-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Recent Activity
              </h3>
              <div className="space-y-4">
                {[
                  {
                    action: 'User added',
                    detail: 'jane.doe@acmeproperties.co.ke',
                    time: '2 hours ago',
                    icon: Users,
                  },
                  {
                    action: 'Property created',
                    detail: 'Sunset Apartments',
                    time: '1 day ago',
                    icon: Home,
                  },
                  {
                    action: 'Subscription renewed',
                    detail: 'Enterprise plan',
                    time: '5 days ago',
                    icon: CreditCard,
                  },
                  {
                    action: 'Settings updated',
                    detail: 'Payment gateway configured',
                    time: '1 week ago',
                    icon: Settings,
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <item.icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.action}
                      </p>
                      <p className="text-sm text-gray-500">{item.detail}</p>
                    </div>
                    <span className="text-xs text-gray-400">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Primary Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-violet-600">
                      {tenant.primaryContact.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {tenant.primaryContact.name}
                    </p>
                    <p className="text-sm text-gray-500">Account Owner</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {tenant.primaryContact.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {tenant.primaryContact.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {tenant.billingAddress.city}, {tenant.billingAddress.country}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Subscription</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900">
                    {tenant.subscription.plan}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(tenant.subscription.amount)}/mo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Next billing</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(tenant.subscription.nextBillingDate)}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <button className="w-full px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                    Manage Subscription
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Users className="h-4 w-4 text-gray-400" />
                  Impersonate User
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-400" />
                  Send Email
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  Issue Credit
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  Suspend Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Constitution Tab */}
      {activeTab === 'policy' && tenant && (
        <div className="space-y-6">
          {/* Notification */}
          {notification && (
            <div className={`p-4 rounded-lg flex items-center justify-between ${
              notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {notification.message}
                </span>
              </div>
              <button onClick={() => setNotification(null)}>
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Policy Constitution</h3>
              <p className="text-sm text-gray-500">Configure tenant-specific policies and thresholds</p>
            </div>
            <button
              onClick={() => setShowPolicyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <Edit className="h-4 w-4" />
              Edit Policies
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Policies */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Payment Policies
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Grace Period</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.paymentGracePeriodDays} days</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Late Fee</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.lateFeePercentage}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Partial Payments</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tenant.policyConstitution.allowPartialPayments ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tenant.policyConstitution.allowPartialPayments ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Legal Escalation</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.legalEscalationDays} days overdue</span>
                </div>
              </div>
            </div>

            {/* Lease Policies */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Lease Policies
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Security Deposit</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.depositMultiplier}x monthly rent</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Notice Period</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.noticeRequiredDays} days</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Renewal Window</span>
                  <span className="font-medium text-gray-900">{tenant.policyConstitution.renewalWindowDays} days before expiry</span>
                </div>
              </div>
            </div>

            {/* Maintenance Policies */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-600" />
                Maintenance Policies
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Approval Threshold</span>
                  <span className="font-medium text-gray-900">{formatCurrency(tenant.policyConstitution.maintenanceApprovalThreshold)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Auto Reminders</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tenant.policyConstitution.autoRemindersEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tenant.policyConstitution.autoRemindersEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Reminder Schedule */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-600" />
                Reminder Schedule
              </h4>
              <div className="space-y-2">
                {tenant.policyConstitution.reminderSchedule.map((schedule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">{schedule.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Approval Matrix */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-600" />
                Approval Matrix
              </h4>
              <button className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Rule
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenant.approvalMatrix.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.action}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rule.threshold > 0 ? `Above ${formatCurrency(rule.threshold)}` : 'Any amount'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.approverRole}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.escalationHours}h</td>
                      <td className="px-4 py-3 text-center">
                        <button className="p-1 text-gray-400 hover:text-gray-600"><Edit className="h-4 w-4" /></button>
                        <button className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Usage Metrics Tab */}
      {activeTab === 'usage' && tenant && (
        <div className="space-y-6">
          {/* Current Usage */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(tenant.usage).map(([key, value]) => {
              const percentage = (value.used / value.limit) * 100;
              const isStorage = key === 'storage';
              const label = isStorage ? `${value.used}GB / ${value.limit}GB` : `${value.used.toLocaleString()} / ${value.limit.toLocaleString()}`;
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-xl font-bold text-gray-900 mb-2">{isStorage ? `${value.used}GB` : value.used.toLocaleString()}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div
                      className={`h-2 rounded-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              );
            })}
          </div>

          {/* Usage Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Usage Trends (Last 7 Days)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                  <Area type="monotone" dataKey="apiCalls" name="API Calls" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="messages" name="Messages" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Users Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Active Users (Last 7 Days)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                  <Bar dataKey="activeUsers" name="Active Users" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Audit Log</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(entry.timestamp)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.action}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.actor}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.target}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{entry.details}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">{entry.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Tenant Users</h3>
            <button className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
              Invite User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">John Mwangi</td>
                  <td className="px-4 py-3 text-sm text-gray-600">john@masakiproperties.co.tz</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-violet-100 text-violet-800 rounded-full">Tenant Admin</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">2 hours ago</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Alice Kimaro</td>
                  <td className="px-4 py-3 text-sm text-gray-600">alice@masakiproperties.co.tz</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Property Manager</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">5 hours ago</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Sarah Mushi</td>
                  <td className="px-4 py-3 text-sm text-gray-600">sarah@masakiproperties.co.tz</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Accountant</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">Yesterday</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Billing tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Current Plan</p>
              <p className="text-xl font-bold text-gray-900 mt-1">Professional</p>
              <p className="text-sm text-violet-600 mt-1">TZS 2,500,000/mo</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Billed</p>
              <p className="text-xl font-bold text-gray-900 mt-1">TZS 30,000,000</p>
              <p className="text-sm text-gray-500 mt-1">Since Jan 2023</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <p className="text-xl font-bold text-red-600 mt-1">TZS 2,500,000</p>
              <p className="text-sm text-gray-500 mt-1">Due Mar 15, 2024</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Billing History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-violet-600">PLAT-2024-03-001</td>
                    <td className="px-4 py-3 text-sm text-gray-600">March 2024</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">TZS 2,500,000</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Pending</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">-</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-violet-600">PLAT-2024-02-001</td>
                    <td className="px-4 py-3 text-sm text-gray-600">February 2024</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">TZS 2,500,000</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Paid</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">Feb 5, 2024</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-violet-600">PLAT-2024-01-001</td>
                    <td className="px-4 py-3 text-sm text-gray-600">January 2024</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">TZS 2,500,000</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Paid</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">Jan 5, 2024</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Policy Edit Modal */}
      {showPolicyModal && policyForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPolicyModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b z-10">
                <h3 className="text-lg font-semibold text-gray-900">Edit Policy Constitution</h3>
                <button onClick={() => setShowPolicyModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
                    <input
                      type="number"
                      value={policyForm.paymentGracePeriodDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, paymentGracePeriodDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee (%)</label>
                    <input
                      type="number"
                      value={policyForm.lateFeePercentage}
                      onChange={(e) => setPolicyForm({ ...policyForm, lateFeePercentage: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Approval Threshold (TZS)</label>
                    <input
                      type="number"
                      value={policyForm.maintenanceApprovalThreshold}
                      onChange={(e) => setPolicyForm({ ...policyForm, maintenanceApprovalThreshold: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal Escalation (days)</label>
                    <input
                      type="number"
                      value={policyForm.legalEscalationDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, legalEscalationDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit (x monthly rent)</label>
                    <input
                      type="number"
                      value={policyForm.depositMultiplier}
                      onChange={(e) => setPolicyForm({ ...policyForm, depositMultiplier: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
                    <input
                      type="number"
                      value={policyForm.noticeRequiredDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, noticeRequiredDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Window (days)</label>
                    <input
                      type="number"
                      value={policyForm.renewalWindowDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, renewalWindowDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Auto Reminders</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policyForm.autoRemindersEnabled}
                        onChange={(e) => setPolicyForm({ ...policyForm, autoRemindersEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Allow Partial Payments</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policyForm.allowPartialPayments}
                        onChange={(e) => setPolicyForm({ ...policyForm, allowPartialPayments: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 p-4 border-t">
                <button onClick={() => setShowPolicyModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
                  Cancel
                </button>
                <button onClick={handleSavePolicy} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowSuspendModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Suspend Tenant</h3>
                    <p className="text-sm text-gray-500">This action will suspend access immediately</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to suspend <strong>{tenant?.name}</strong>? All users will lose access to the platform until reactivated.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for suspension</label>
                  <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" rows={3} placeholder="Enter reason..."></textarea>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
                <button onClick={() => setShowSuspendModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
                  Cancel
                </button>
                <button onClick={handleSuspend} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Suspend Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
