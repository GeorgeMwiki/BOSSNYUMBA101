import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  X,
  ArrowLeft,
  FileText,
  TrendingUp,
  TrendingDown,
  Loader2,
  Filter,
  Banknote,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, formatCurrency, formatDate, formatDateTime } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────
interface DisbursementBreakdown {
  rentCollected: number;
  managementFees: number;
  maintenanceCosts: number;
  utilities: number;
  insurance: number;
  repairs: number;
  otherDeductions: number;
  netDisbursement: number;
}

interface Disbursement {
  id: string;
  reference: string;
  amount: number;
  date: string;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED';
  method: string;
  period: string;
  bankAccount?: string;
  property?: { id: string; name: string };
  breakdown?: DisbursementBreakdown;
  statementUrl?: string;
}

interface DisbursementStats {
  totalDisbursed: number;
  pendingAmount: number;
  nextDisbursementDate: string;
  yearToDate: number;
  averageMonthly: number;
}

// ─── Main Page ───────────────────────────────────────────────────
export function DisbursementsPage() {
  const navigate = useNavigate();
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [stats, setStats] = useState<DisbursementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        disbursements: Disbursement[];
        stats: DisbursementStats;
      }>('/owner/disbursements');
      if (response.success && response.data) {
        setDisbursements(response.data.disbursements || []);
        setStats(response.data.stats || null);
      }
    } catch {
      // Fallback mock data for development
      setStats({
        totalDisbursed: 154200000,
        pendingAmount: 25400000,
        nextDisbursementDate: '2026-02-28',
        yearToDate: 46700000,
        averageMonthly: 23350000,
      });

      setDisbursements([
        {
          id: 'dis-1',
          reference: 'DIS-2026-0024',
          amount: 14980000,
          date: '2026-02-28',
          status: 'PENDING',
          method: 'BANK_TRANSFER',
          period: 'February 2026',
          bankAccount: '****4521',
          property: { id: '1', name: 'Palm Gardens' },
          breakdown: {
            rentCollected: 25500000,
            managementFees: 2670000,
            maintenanceCosts: 2100000,
            utilities: 1800000,
            insurance: 450000,
            repairs: 3500000,
            otherDeductions: 0,
            netDisbursement: 14980000,
          },
        },
        {
          id: 'dis-2',
          reference: 'DIS-2026-0025',
          amount: 10420000,
          date: '2026-02-28',
          status: 'PENDING',
          method: 'BANK_TRANSFER',
          period: 'February 2026',
          bankAccount: '****4521',
          property: { id: '2', name: 'Ocean View Apartments' },
          breakdown: {
            rentCollected: 18500000,
            managementFees: 1930000,
            maintenanceCosts: 1500000,
            utilities: 1400000,
            insurance: 350000,
            repairs: 2800000,
            otherDeductions: 100000,
            netDisbursement: 10420000,
          },
        },
        {
          id: 'dis-3',
          reference: 'DIS-2026-0022',
          amount: 12500000,
          date: '2026-01-31',
          status: 'COMPLETED',
          method: 'BANK_TRANSFER',
          period: 'January 2026',
          bankAccount: '****4521',
          property: { id: '1', name: 'Palm Gardens' },
          breakdown: {
            rentCollected: 24800000,
            managementFees: 2480000,
            maintenanceCosts: 1850000,
            utilities: 1750000,
            insurance: 450000,
            repairs: 5770000,
            otherDeductions: 0,
            netDisbursement: 12500000,
          },
          statementUrl: '#',
        },
        {
          id: 'dis-4',
          reference: 'DIS-2026-0023',
          amount: 9200000,
          date: '2026-01-31',
          status: 'COMPLETED',
          method: 'BANK_TRANSFER',
          period: 'January 2026',
          bankAccount: '****4521',
          property: { id: '2', name: 'Ocean View Apartments' },
          breakdown: {
            rentCollected: 17200000,
            managementFees: 1720000,
            maintenanceCosts: 1200000,
            utilities: 1350000,
            insurance: 350000,
            repairs: 3380000,
            otherDeductions: 0,
            netDisbursement: 9200000,
          },
          statementUrl: '#',
        },
        {
          id: 'dis-5',
          reference: 'DIS-2025-0020',
          amount: 13800000,
          date: '2025-12-31',
          status: 'COMPLETED',
          method: 'BANK_TRANSFER',
          period: 'December 2025',
          bankAccount: '****4521',
          property: { id: '1', name: 'Palm Gardens' },
          statementUrl: '#',
        },
        {
          id: 'dis-6',
          reference: 'DIS-2025-0021',
          amount: 9500000,
          date: '2025-12-31',
          status: 'COMPLETED',
          method: 'BANK_TRANSFER',
          period: 'December 2025',
          bankAccount: '****4521',
          property: { id: '2', name: 'Ocean View Apartments' },
          statementUrl: '#',
        },
      ]);
    }
    setLoading(false);
  };

  const handleDownloadStatement = async (disbursement: Disbursement) => {
    setDownloading(disbursement.id);
    try {
      await api.get(`/owner/disbursements/${disbursement.id}/statement`);
    } catch {
      // Dev fallback
    }
    await new Promise((r) => setTimeout(r, 1200));
    setDownloading(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700';
      case 'FAILED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const chartData = [
    { month: 'Sep', palmGardens: 12200000, oceanView: 8800000 },
    { month: 'Oct', palmGardens: 13100000, oceanView: 9100000 },
    { month: 'Nov', palmGardens: 12800000, oceanView: 8600000 },
    { month: 'Dec', palmGardens: 13800000, oceanView: 9500000 },
    { month: 'Jan', palmGardens: 12500000, oceanView: 9200000 },
    { month: 'Feb', palmGardens: 14980000, oceanView: 10420000 },
  ];

  const filteredDisbursements = disbursements.filter((d) => {
    const matchesProperty =
      propertyFilter === 'all' || d.property?.id === propertyFilter;
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesProperty && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/financial')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disbursements</h1>
            <p className="text-gray-500">Track owner payouts and statement history</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Total Disbursed</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(stats.totalDisbursed)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(stats.pendingAmount)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Next Payout</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatDate(stats.nextDisbursementDate)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-purple-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Year to Date</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(stats.yearToDate)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Banknote className="h-4 w-4" />
              <span className="text-sm font-medium">Avg Monthly</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(stats.averageMonthly)}
            </p>
          </div>
        </div>
      )}

      {/* Pending Disbursement Banner */}
      {stats && stats.pendingAmount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-800">Upcoming Disbursement</p>
            <p className="text-sm text-blue-600">
              Next payout scheduled for {formatDate(stats.nextDisbursementDate)}
            </p>
          </div>
          <p className="text-2xl font-bold text-blue-700">
            {formatCurrency(stats.pendingAmount)}
          </p>
        </div>
      )}

      {/* Disbursement Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Disbursement Trend</h3>
            <p className="text-sm text-gray-500">Monthly disbursements by property</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                }}
              />
              <Legend />
              <Bar
                dataKey="palmGardens"
                name="Palm Gardens"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="oceanView"
                name="Ocean View"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Properties</option>
            <option value="1">Palm Gardens</option>
            <option value="2">Ocean View Apartments</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
          </select>
        </div>
      </div>

      {/* Disbursements List */}
      <div className="space-y-4">
        {filteredDisbursements.map((disbursement) => (
          <div
            key={disbursement.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Row Header */}
            <button
              onClick={() =>
                setExpandedId(
                  expandedId === disbursement.id ? null : disbursement.id
                )
              }
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    disbursement.status === 'COMPLETED'
                      ? 'bg-green-100'
                      : disbursement.status === 'PENDING'
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                  }`}
                >
                  <DollarSign
                    className={`h-5 w-5 ${
                      disbursement.status === 'COMPLETED'
                        ? 'text-green-600'
                        : disbursement.status === 'PENDING'
                        ? 'text-yellow-600'
                        : 'text-gray-500'
                    }`}
                  />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {disbursement.reference}
                    </p>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                        disbursement.status
                      )}`}
                    >
                      {disbursement.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {disbursement.property && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {disbursement.property.name}
                      </span>
                    )}
                    <span>{disbursement.period}</span>
                    <span>{formatDate(disbursement.date)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(disbursement.amount)}
                </p>
                {expandedId === disbursement.id ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded Detail */}
            {expandedId === disbursement.id && (
              <div className="border-t border-gray-200 p-6">
                {disbursement.breakdown ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Income Section */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Gross Income
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Rent Collected</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(disbursement.breakdown.rentCollected)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-medium border-t pt-2">
                          <span className="text-gray-900">Total Income</span>
                          <span className="text-green-600">
                            {formatCurrency(disbursement.breakdown.rentCollected)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Section */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Deductions
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Management Fees (10%)</span>
                          <span className="text-gray-900">
                            -{formatCurrency(disbursement.breakdown.managementFees)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Maintenance</span>
                          <span className="text-gray-900">
                            -{formatCurrency(disbursement.breakdown.maintenanceCosts)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Utilities</span>
                          <span className="text-gray-900">
                            -{formatCurrency(disbursement.breakdown.utilities)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Insurance</span>
                          <span className="text-gray-900">
                            -{formatCurrency(disbursement.breakdown.insurance)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Repairs</span>
                          <span className="text-gray-900">
                            -{formatCurrency(disbursement.breakdown.repairs)}
                          </span>
                        </div>
                        {disbursement.breakdown.otherDeductions > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Other Deductions</span>
                            <span className="text-gray-900">
                              -
                              {formatCurrency(
                                disbursement.breakdown.otherDeductions
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-medium border-t pt-2">
                          <span className="text-gray-900">Total Deductions</span>
                          <span className="text-red-600">
                            -
                            {formatCurrency(
                              disbursement.breakdown.rentCollected -
                                disbursement.breakdown.netDisbursement
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Detailed breakdown not available for this disbursement.
                  </p>
                )}

                {/* Net Disbursement */}
                {disbursement.breakdown && (
                  <div className="mt-6 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-green-800">
                        Net Disbursement
                      </span>
                      {disbursement.bankAccount && (
                        <p className="text-sm text-green-600 mt-0.5">
                          To bank account ending {disbursement.bankAccount}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(disbursement.breakdown.netDisbursement)}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-3">
                  {disbursement.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleDownloadStatement(disbursement)}
                      disabled={downloading === disbursement.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {downloading === disbursement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download Statement
                    </button>
                  )}
                  <button className="flex items-center gap-1.5 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium">
                    <Eye className="h-4 w-4" />
                    View Full Report
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDisbursements.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p>No disbursements found</p>
        </div>
      )}
    </div>
  );
}

export default DisbursementsPage;
