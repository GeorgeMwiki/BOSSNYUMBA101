import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Filter,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  X,
  Loader2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
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
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, formatCurrency, formatDate, formatPercentage, formatDateTime } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────
interface Invoice {
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

interface Payment {
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

interface IncomeStatement {
  propertyId: string;
  propertyName: string;
  month: string;
  rentCollected: number;
  otherIncome: number;
  totalIncome: number;
  operatingExpenses: number;
  maintenanceCosts: number;
  managementFees: number;
  utilities: number;
  insurance: number;
  taxes: number;
  totalExpenses: number;
  netOperatingIncome: number;
}

interface Disbursement {
  id: string;
  amount: number;
  date: string;
  status: string;
  method: string;
  reference: string;
  period: string;
  property?: { id: string; name: string };
}

interface TransactionDetail {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string;
  reference: string;
  category: string;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  customer?: { id: string; name: string };
  relatedInvoice?: string;
  paymentMethod?: string;
}

interface FinancialStats {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  pendingDisbursement: number;
}

// ─── Main Page ───────────────────────────────────────────────────
export function FinancialPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statements, setStatements] = useState<IncomeStatement[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // React-owned state for the export dropdown. Replaces the previous
  // `document.getElementById('export-menu').classList.toggle(...)` DOM
  // manipulation — brittle, defeats React rendering, and breaks if
  // multiple FinancialPage instances ever mount.
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [selectedMonth, setSelectedMonth] = useState('Feb 2026');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [expandedStatement, setExpandedStatement] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [statsRes, invoicesRes, paymentsRes] = await Promise.allSettled([
        api.get<FinancialStats>('/owner/financial/stats'),
        api.get<Invoice[]>('/owner/invoices'),
        api.get<Payment[]>('/owner/payments'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        setStats(statsRes.value.data!);
      } else {
        setStats(null);
      }
      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.success) {
        setInvoices(invoicesRes.value.data!);
      } else {
        setInvoices([]);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.success) {
        setPayments(paymentsRes.value.data!);
      } else {
        setPayments([]);
      }
      if (
        (statsRes.status !== 'fulfilled' || !statsRes.value.success) &&
        (invoicesRes.status !== 'fulfilled' || !invoicesRes.value.success) &&
        (paymentsRes.status !== 'fulfilled' || !paymentsRes.value.success)
      ) {
        setError('Live owner financial data is unavailable.');
      }
    } catch (err) {
      setStats(null);
      setInvoices([]);
      setPayments([]);
      setError(err instanceof Error ? err.message : 'Live owner financial data is unavailable.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    try {
      const response = await api.get<{ downloadUrl: string }>(
        `/owner/reports/export/financial?format=${format}&month=${selectedMonth}&property=${selectedProperty}`
      );
      if (response.success && response.data?.downloadUrl) {
        window.open(response.data.downloadUrl, '_blank');
      } else {
        setError(response.error?.message ?? 'Financial export is unavailable.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Financial export is unavailable.');
    }
    setExporting(false);
  };

  const chartData = Array.from(
    payments.reduce((acc, payment) => {
      const month = new Date(payment.createdAt).toLocaleDateString('en-KE', {
        month: 'short',
        year: 'numeric',
      });
      const entry = acc.get(month) ?? { month, collected: 0, outstanding: 0 };
      entry.collected += payment.amount;
      acc.set(month, entry);
      return acc;
    }, new Map<string, { month: string; collected: number; outstanding: number }>())
      .values()
  );

  const expenseBreakdown = statements.length > 0 ? [
    { name: 'Operating', value: statements.reduce((s, st) => s + st.operatingExpenses, 0), color: '#3B82F6' },
    { name: 'Maintenance', value: statements.reduce((s, st) => s + st.maintenanceCosts, 0), color: '#F59E0B' },
    { name: 'Mgmt Fees', value: statements.reduce((s, st) => s + st.managementFees, 0), color: '#10B981' },
    { name: 'Utilities', value: statements.reduce((s, st) => s + st.utilities, 0), color: '#8B5CF6' },
    { name: 'Insurance', value: statements.reduce((s, st) => s + st.insurance, 0), color: '#EC4899' },
    { name: 'Taxes', value: statements.reduce((s, st) => s + st.taxes, 0), color: '#6B7280' },
  ] : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'OVERDUE': case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'PARTIALLY_PAID': case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'OVERDUE': case 'FAILED': return 'bg-red-100 text-red-700';
      case 'PARTIALLY_PAID': case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <button onClick={() => loadData()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'statements', label: 'Income Statements' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payments', label: 'Payments' },
    { id: 'disbursements', label: 'Disbursements' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial</h1>
          <p className="text-gray-500">Track invoices, payments, and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exporting}
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {exportMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button role="menuitem" onClick={() => { handleExport('pdf'); setExportMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export as PDF
                </button>
                <button role="menuitem" onClick={() => { handleExport('excel'); setExportMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Total Invoiced</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalInvoiced)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Collected</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalCollected)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Outstanding</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Collection Rate</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPercentage(stats.collectionRate)}</p>
          </div>
          <Link to="/financial/disbursements" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Pending Disbursement</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.pendingDisbursement)}</p>
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-72">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Overview</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                      <Legend />
                      <Bar dataKey="collected" name="Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outstanding" name="Outstanding" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Expense Breakdown Pie Chart */}
                {expenseBreakdown.length > 0 && (
                  <div className="h-72">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* NOI Summary */}
              {statements.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {statements.map((st) => (
                    <div key={st.propertyId} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-medium">{st.propertyName}</p>
                          <p className="text-2xl font-bold text-green-800 mt-1">{formatCurrency(st.netOperatingIncome)}</p>
                          <p className="text-xs text-green-600 mt-1">Net Operating Income - {st.month}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Income</p>
                          <p className="font-medium text-gray-900">{formatCurrency(st.totalIncome)}</p>
                          <p className="text-sm text-gray-500 mt-1">Expenses</p>
                          <p className="font-medium text-red-600">{formatCurrency(st.totalExpenses)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Income Statements Tab */}
          {activeTab === 'statements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option>Feb 2026</option>
                    <option>Jan 2026</option>
                    <option>Dec 2025</option>
                  </select>
                  <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="all">All Properties</option>
                    <option value="1">Palm Gardens</option>
                    <option value="2">Ocean View Apartments</option>
                  </select>
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                >
                  <Download className="h-4 w-4" />
                  Download Statement
                </button>
              </div>

              {/* Combined Totals */}
              {statements.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-blue-600">Total Income</p>
                    <p className="text-xl font-bold text-blue-800">
                      {formatCurrency(statements.reduce((s, st) => s + st.totalIncome, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Total Expenses</p>
                    <p className="text-xl font-bold text-red-700">
                      {formatCurrency(statements.reduce((s, st) => s + st.totalExpenses, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Combined NOI</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(statements.reduce((s, st) => s + st.netOperatingIncome, 0))}
                    </p>
                  </div>
                </div>
              )}

              {statements.map((statement) => (
                <div key={statement.propertyId} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedStatement(expandedStatement === statement.propertyId ? null : statement.propertyId)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-gray-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{statement.propertyName}</p>
                        <p className="text-sm text-gray-500">{statement.month}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">NOI</p>
                        <p className="font-semibold text-green-600">{formatCurrency(statement.netOperatingIncome)}</p>
                      </div>
                      {expandedStatement === statement.propertyId ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    </div>
                  </button>

                  {expandedStatement === statement.propertyId && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" /> Income
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Rent Collected</span>
                              <span className="text-gray-900">{formatCurrency(statement.rentCollected)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Other Income</span>
                              <span className="text-gray-900">{formatCurrency(statement.otherIncome)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium border-t pt-2">
                              <span className="text-gray-900">Total Income</span>
                              <span className="text-green-600">{formatCurrency(statement.totalIncome)}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-500" /> Expenses
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Operating Expenses</span>
                              <span className="text-gray-900">{formatCurrency(statement.operatingExpenses)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Maintenance</span>
                              <span className="text-gray-900">{formatCurrency(statement.maintenanceCosts)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Management Fees</span>
                              <span className="text-gray-900">{formatCurrency(statement.managementFees)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Utilities</span>
                              <span className="text-gray-900">{formatCurrency(statement.utilities)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Insurance</span>
                              <span className="text-gray-900">{formatCurrency(statement.insurance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Taxes</span>
                              <span className="text-gray-900">{formatCurrency(statement.taxes)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium border-t pt-2">
                              <span className="text-gray-900">Total Expenses</span>
                              <span className="text-red-600">{formatCurrency(statement.totalExpenses)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 flex items-center justify-between">
                        <span className="font-medium text-green-800">Net Operating Income</span>
                        <span className="text-2xl font-bold text-green-600">{formatCurrency(statement.netOperatingIncome)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Transactions Drill-down Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{transactions.length} transactions</p>
                <div className="flex items-center gap-2">
                  <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="all">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                          <p className="text-xs text-gray-400">{tx.reference}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {tx.property?.name}
                          {tx.unit && <span className="text-xs text-gray-400 ml-1">{tx.unit.unitNumber}</span>}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedTransaction(tx)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property / Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(invoice.status)}
                          <span className="font-medium text-gray-900">{invoice.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{invoice.customer?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{invoice.property?.name}</div>
                        <div className="text-xs text-gray-400">Unit {invoice.unit?.unitNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(invoice.total)}</p>
                        {invoice.amountDue > 0 && invoice.amountDue < invoice.total && (
                          <p className="text-xs text-gray-500">Due: {formatCurrency(invoice.amountDue)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{payment.reference}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{payment.customer?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                          {payment.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Disbursements Tab */}
          {activeTab === 'disbursements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between flex-1">
                  <div>
                    <p className="font-medium text-blue-800">Pending Disbursement</p>
                    <p className="text-sm text-blue-600">Next disbursement scheduled for Feb 28, 2026</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats?.pendingDisbursement || 0)}</p>
                </div>
                <Link
                  to="/financial/disbursements"
                  className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  View Full Details
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {disbursements.map((disbursement) => (
                      <tr key={disbursement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{disbursement.reference}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{disbursement.property?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{disbursement.period}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(disbursement.date)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(disbursement.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(disbursement.status)}`}>
                            {disbursement.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedTransaction(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Transaction Detail</h3>
                <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className={`text-center p-4 rounded-lg ${
                  selectedTransaction.type === 'income' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <p className={`text-3xl font-bold ${
                    selectedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedTransaction.type === 'income' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{selectedTransaction.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedTransaction.date)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.category}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Reference</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.reference}</p>
                  </div>
                  {selectedTransaction.paymentMethod && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Payment Method</p>
                      <p className="font-medium text-gray-900">{selectedTransaction.paymentMethod}</p>
                    </div>
                  )}
                  {selectedTransaction.property && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Property</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.property.name}
                        {selectedTransaction.unit && ` - ${selectedTransaction.unit.unitNumber}`}
                      </p>
                    </div>
                  )}
                  {selectedTransaction.customer && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Tenant</p>
                      <p className="font-medium text-gray-900">{selectedTransaction.customer.name}</p>
                    </div>
                  )}
                  {selectedTransaction.relatedInvoice && (
                    <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                      <p className="text-xs text-gray-500">Related Invoice</p>
                      <p className="font-medium text-blue-600">{selectedTransaction.relatedInvoice}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
