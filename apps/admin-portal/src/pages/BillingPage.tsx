import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  DollarSign,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Send,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency, formatDate } from '../lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  tenant: string;
  tenantId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidDate?: string;
  items: { description: string; amount: number }[];
  createdAt: string;
}

interface Credit {
  id: string;
  tenant: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'applied';
  createdBy: string;
  createdAt: string;
  appliedTo?: string;
}

interface UsageData {
  month: string;
  revenue: number;
  transactions: number;
  activeUsers: number;
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2025-001',
    tenant: 'Acme Properties Ltd',
    tenantId: '1',
    amount: 125000,
    status: 'paid',
    dueDate: '2025-02-15',
    paidDate: '2025-02-10',
    items: [
      { description: 'Enterprise Plan - February 2025', amount: 125000 },
    ],
    createdAt: '2025-02-01',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2025-002',
    tenant: 'Sunrise Realty',
    tenantId: '2',
    amount: 45000,
    status: 'paid',
    dueDate: '2025-02-15',
    paidDate: '2025-02-12',
    items: [
      { description: 'Professional Plan - February 2025', amount: 45000 },
    ],
    createdAt: '2025-02-01',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2025-003',
    tenant: 'Highland Properties',
    tenantId: '5',
    amount: 95000,
    status: 'sent',
    dueDate: '2025-02-20',
    items: [
      { description: 'Enterprise Plan - February 2025', amount: 95000 },
    ],
    createdAt: '2025-02-05',
  },
  {
    id: '4',
    invoiceNumber: 'INV-2025-004',
    tenant: 'Coastal Estates',
    tenantId: '4',
    amount: 15000,
    status: 'overdue',
    dueDate: '2025-02-01',
    items: [
      { description: 'Starter Plan - February 2025', amount: 15000 },
    ],
    createdAt: '2025-01-15',
  },
  {
    id: '5',
    invoiceNumber: 'INV-2025-005',
    tenant: 'Metro Housing',
    tenantId: '3',
    amount: 0,
    status: 'draft',
    dueDate: '2025-03-01',
    items: [
      { description: 'Professional Plan - Trial', amount: 0 },
    ],
    createdAt: '2025-02-10',
  },
];

const mockCredits: Credit[] = [
  {
    id: '1',
    tenant: 'Acme Properties Ltd',
    amount: 10000,
    reason: 'Service disruption compensation - Feb 10 outage',
    status: 'applied',
    createdBy: 'John Mwangi',
    createdAt: '2025-02-11',
    appliedTo: 'INV-2025-001',
  },
  {
    id: '2',
    tenant: 'Sunrise Realty',
    amount: 5000,
    reason: 'Referral bonus credit',
    status: 'approved',
    createdBy: 'Mary Akinyi',
    createdAt: '2025-02-08',
  },
  {
    id: '3',
    tenant: 'Highland Properties',
    amount: 15000,
    reason: 'Annual payment discount',
    status: 'pending',
    createdBy: 'Peter Kamau',
    createdAt: '2025-02-12',
  },
];

const mockUsageData: UsageData[] = [
  { month: 'Sep', revenue: 450000, transactions: 1250, activeUsers: 180 },
  { month: 'Oct', revenue: 520000, transactions: 1480, activeUsers: 195 },
  { month: 'Nov', revenue: 580000, transactions: 1620, activeUsers: 210 },
  { month: 'Dec', revenue: 620000, transactions: 1750, activeUsers: 225 },
  { month: 'Jan', revenue: 680000, transactions: 1890, activeUsers: 240 },
  { month: 'Feb', revenue: 720000, transactions: 2050, activeUsers: 258 },
];

const planDistribution = [
  { name: 'Enterprise', value: 45, color: '#8b5cf6' },
  { name: 'Professional', value: 35, color: '#3b82f6' },
  { name: 'Starter', value: 15, color: '#22c55e' },
  { name: 'Trial', value: 5, color: '#9ca3af' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  applied: 'bg-green-100 text-green-700',
};

export function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'credits'>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [creditForm, setCreditForm] = useState({
    tenant: '',
    amount: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setInvoices(mockInvoices);
      setCredits(mockCredits);
      setUsageData(mockUsageData);
    } catch (err) {
      setError('Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      invoice.tenant.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = usageData.reduce((sum, d) => sum + d.revenue, 0);
  const currentMRR = invoices
    .filter((i) => i.status === 'paid' || i.status === 'sent')
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueAmount = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + i.amount, 0);
  const pendingCredits = credits
    .filter((c) => c.status === 'pending' || c.status === 'approved')
    .reduce((sum, c) => sum + c.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-500">Invoices, credits, and revenue analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreditModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Issue Credit
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <FileText className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-gray-400" />
            <span className="flex items-center gap-1 text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              12%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentMRR)}</p>
          <p className="text-sm text-gray-500">Monthly Recurring Revenue</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            <span className="flex items-center gap-1 text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              8%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-sm text-gray-500">6-Month Revenue</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</p>
          <p className="text-sm text-gray-500">Overdue Amount</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <Receipt className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingCredits)}</p>
          <p className="text-sm text-gray-500">Pending Credits</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend (6 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Plan Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, 'Share']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {planDistribution.map((plan) => (
              <div key={plan.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="text-sm text-gray-600">{plan.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'invoices'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'credits'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Credits ({credits.length})
          </button>
        </nav>
      </div>

      {activeTab === 'invoices' ? (
        <>
          {/* Invoice Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(invoice.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {invoice.tenant}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            statusColors[invoice.status]
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 hidden md:table-cell">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowInvoiceModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {invoice.status === 'draft' && (
                            <button
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Send Invoice"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Credits Tab */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {credits.map((credit) => (
                  <tr key={credit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {credit.tenant}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">
                      {formatCurrency(credit.amount)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                      {credit.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          statusColors[credit.status]
                        }`}
                      >
                        {credit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 hidden md:table-cell">
                      <div>
                        <p>{formatDate(credit.createdAt)}</p>
                        <p className="text-xs">by {credit.createdBy}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {credit.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-lg">
                            Approve
                          </button>
                          <button className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                            Reject
                          </button>
                        </div>
                      )}
                      {credit.status === 'approved' && (
                        <button className="px-3 py-1 text-sm text-violet-600 hover:bg-violet-50 rounded-lg">
                          Apply to Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Issue Credit</h2>
                <p className="text-sm text-gray-500">Create a credit for a tenant</p>
              </div>
              <button
                onClick={() => setShowCreditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant <span className="text-red-500">*</span>
                </label>
                <select
                  value={creditForm.tenant}
                  onChange={(e) => setCreditForm({ ...creditForm, tenant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select tenant...</option>
                  <option value="1">Acme Properties Ltd</option>
                  <option value="2">Sunrise Realty</option>
                  <option value="3">Metro Housing</option>
                  <option value="4">Coastal Estates</option>
                  <option value="5">Highland Properties</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={creditForm.reason}
                  onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Describe the reason for this credit..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreditModal(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                <CheckCircle className="h-4 w-4" />
                Issue Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedInvoice.invoiceNumber}
                </h2>
                <p className="text-sm text-gray-500">{selectedInvoice.tenant}</p>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    statusColors[selectedInvoice.status]
                  }`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Due Date</span>
                <span className="text-gray-900">{formatDate(selectedInvoice.dueDate)}</span>
              </div>
              {selectedInvoice.paidDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Paid Date</span>
                  <span className="text-green-600">{formatDate(selectedInvoice.paidDate)}</span>
                </div>
              )}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Line Items</h4>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-gray-600">{item.description}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(selectedInvoice.amount)}
                </span>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Download PDF
              </button>
              {selectedInvoice.status === 'draft' && (
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg">
                  <Send className="h-4 w-4" />
                  Send Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
