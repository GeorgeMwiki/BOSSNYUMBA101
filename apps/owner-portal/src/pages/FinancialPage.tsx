import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
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
import { Skeleton, Alert, AlertDescription, Button, EmptyState, Spinner, toast } from '@bossnyumba/design-system';
import { api, formatCurrency, formatDate, formatPercentage, formatDateTime } from '../lib/api';
import {
  useFinancialStats,
  useOwnerInvoices,
  useOwnerPayments,
  type FinancialInvoice as Invoice,
  type FinancialPayment as Payment,
} from '../lib/hooks';

// ─── Types ───────────────────────────────────────────────────────
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

// ─── Main Page ───────────────────────────────────────────────────
export function FinancialPage() {
  const t = useTranslations('financialPage');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statsQuery = useFinancialStats();
  const invoicesQuery = useOwnerInvoices();
  const paymentsQuery = useOwnerPayments();

  const stats = statsQuery.data ?? null;
  const invoices = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const statements: IncomeStatement[] = [];
  const disbursements: Disbursement[] = [];
  const transactions: TransactionDetail[] = [];

  const loading =
    statsQuery.isLoading && invoicesQuery.isLoading && paymentsQuery.isLoading;
  const refreshing =
    !loading &&
    (statsQuery.isFetching || invoicesQuery.isFetching || paymentsQuery.isFetching);

  // If every one of the three queries failed, surface a single error.
  const allFailed =
    statsQuery.isError && invoicesQuery.isError && paymentsQuery.isError;
  const error = allFailed ? 'Live owner financial data is unavailable.' : null;

  const loadData = (_silent = false) => {
    statsQuery.refetch();
    invoicesQuery.refetch();
    paymentsQuery.refetch();
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [selectedMonth, setSelectedMonth] = useState('Feb 2026');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [expandedStatement, setExpandedStatement] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    try {
      const response = await api.get<{ downloadUrl: string }>(
        `/owner/reports/export/financial?format=${format}&month=${selectedMonth}&property=${selectedProperty}`
      );
      if (response.success && response.data?.downloadUrl) {
        window.open(response.data.downloadUrl, '_blank');
      } else {
        toast.error(response.error?.message ?? 'Financial export is unavailable.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Financial export is unavailable.');
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
    { name: t('expOperating'), value: statements.reduce((s, st) => s + st.operatingExpenses, 0), color: '#3B82F6' },
    { name: t('expMaintenance'), value: statements.reduce((s, st) => s + st.maintenanceCosts, 0), color: '#F59E0B' },
    { name: t('expMgmtFees'), value: statements.reduce((s, st) => s + st.managementFees, 0), color: '#10B981' },
    { name: t('expUtilities'), value: statements.reduce((s, st) => s + st.utilities, 0), color: '#8B5CF6' },
    { name: t('expInsurance'), value: statements.reduce((s, st) => s + st.insurance, 0), color: '#EC4899' },
    { name: t('expTaxes'), value: statements.reduce((s, st) => s + st.taxes, 0), color: '#6B7280' },
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
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error}
          <Button size="sm" onClick={() => loadData()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const tabs = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'statements', label: t('tabIncomeStatements') },
    { id: 'transactions', label: t('tabTransactions') },
    { id: 'invoices', label: t('tabInvoices') },
    { id: 'payments', label: t('tabPayments') },
    { id: 'disbursements', label: t('tabDisbursements') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
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
              {exporting ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
              {t('export')}
              <ChevronDown className="h-4 w-4" />
            </button>
            {exportMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button role="menuitem" onClick={() => { handleExport('pdf'); setExportMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {t('exportAsPdf')}
                </button>
                <button role="menuitem" onClick={() => { handleExport('excel'); setExportMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {t('exportAsExcel')}
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
              <span className="text-sm font-medium">{t('totalInvoiced')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalInvoiced)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">{t('collected')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalCollected)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{t('outstanding')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">{t('collectionRate')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPercentage(stats.collectionRate)}</p>
          </div>
          <Link to="/financial/disbursements" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">{t('pendingDisbursement')}</span>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('collectionOverview')}</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                      <Legend />
                      <Bar dataKey="collected" name={t('collected')} fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outstanding" name={t('outstanding')} fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Expense Breakdown Pie Chart */}
                {expenseBreakdown.length > 0 && (
                  <div className="h-72">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expenseBreakdown')}</h3>
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
                          <p className="text-xs text-green-600 mt-1">{t('netOperatingIncome')} - {st.month}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{t('income')}</p>
                          <p className="font-medium text-gray-900">{formatCurrency(st.totalIncome)}</p>
                          <p className="text-sm text-gray-500 mt-1">{t('expenses')}</p>
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
                    <option>{'Feb 2026'}</option>
                    <option>{'Jan 2026'}</option>
                    <option>{'Dec 2025'}</option>
                  </select>
                  <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="all">{t('allProperties')}</option>
                    <option value="1">{'Palm Gardens'}</option>
                    <option value="2">{'Ocean View Apartments'}</option>
                  </select>
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                >
                  <Download className="h-4 w-4" />
                  {t('downloadStatement')}
                </button>
              </div>

              {/* Combined Totals */}
              {statements.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-blue-600">{t('totalIncome')}</p>
                    <p className="text-xl font-bold text-blue-800">
                      {formatCurrency(statements.reduce((s, st) => s + st.totalIncome, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">{t('totalExpenses')}</p>
                    <p className="text-xl font-bold text-red-700">
                      {formatCurrency(statements.reduce((s, st) => s + st.totalExpenses, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">{t('combinedNoi')}</p>
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
                        <p className="text-sm text-gray-500">{t('noi')}</p>
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
                            <TrendingUp className="h-4 w-4 text-green-500" /> {t('income')}
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('rentCollected')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.rentCollected)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('otherIncome')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.otherIncome)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium border-t pt-2">
                              <span className="text-gray-900">{t('totalIncome')}</span>
                              <span className="text-green-600">{formatCurrency(statement.totalIncome)}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-500" /> {t('expenses')}
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('operatingExpenses')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.operatingExpenses)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('maintenance')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.maintenanceCosts)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('managementFees')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.managementFees)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('utilities')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.utilities)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('insurance')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.insurance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">{t('taxes')}</span>
                              <span className="text-gray-900">{formatCurrency(statement.taxes)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium border-t pt-2">
                              <span className="text-gray-900">{t('totalExpenses')}</span>
                              <span className="text-red-600">{formatCurrency(statement.totalExpenses)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 flex items-center justify-between">
                        <span className="font-medium text-green-800">{t('netOperatingIncome')}</span>
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
                <p className="text-sm text-gray-500">{t('transactionsCount', { count: transactions.length })}</p>
                <div className="flex items-center gap-2">
                  <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="all">{t('allTypes')}</option>
                    <option value="income">{t('income')}</option>
                    <option value="expense">{t('expense')}</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDescription')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colCategory')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperty')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAmount')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('colDetails')}</th>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colInvoice')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colTenant')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colPropertyUnit')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDueDate')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAmount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('colActions')}</th>
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
                        <div className="text-xs text-gray-400">{t('unitPrefix', { unit: invoice.unit?.unitNumber ?? '' })}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(invoice.total)}</p>
                        {invoice.amountDue > 0 && invoice.amountDue < invoice.total && (
                          <p className="text-xs text-gray-500">{t('duePrefix')}: {formatCurrency(invoice.amountDue)}</p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colReference')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colTenant')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colMethod')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAmount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
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
                    <p className="font-medium text-blue-800">{t('pendingDisbursement')}</p>
                    <p className="text-sm text-blue-600">{t('nextDisbursementScheduled')}</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats?.pendingDisbursement || 0)}</p>
                </div>
                <Link
                  to="/financial/disbursements"
                  className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {t('viewFullDetails')}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colReference')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperty')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colPeriod')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAmount')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
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
                <h3 className="text-lg font-semibold text-gray-900">{t('transactionDetail')}</h3>
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
                    <p className="text-xs text-gray-500">{t('colDate')}</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedTransaction.date)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{t('colCategory')}</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.category}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{t('colReference')}</p>
                    <p className="font-medium text-gray-900">{selectedTransaction.reference}</p>
                  </div>
                  {selectedTransaction.paymentMethod && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{t('paymentMethod')}</p>
                      <p className="font-medium text-gray-900">{selectedTransaction.paymentMethod}</p>
                    </div>
                  )}
                  {selectedTransaction.property && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{t('colProperty')}</p>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.property.name}
                        {selectedTransaction.unit && ` - ${selectedTransaction.unit.unitNumber}`}
                      </p>
                    </div>
                  )}
                  {selectedTransaction.customer && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{t('colTenant')}</p>
                      <p className="font-medium text-gray-900">{selectedTransaction.customer.name}</p>
                    </div>
                  )}
                  {selectedTransaction.relatedInvoice && (
                    <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                      <p className="text-xs text-gray-500">{t('relatedInvoice')}</p>
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
