import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Download,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Filter,
  Play,
  Clock,
  CheckCircle,
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency } from '../lib/api';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  lastRun: string | null;
}

function buildReportTemplates(t: (key: string) => string): ReportTemplate[] {
  return [
    { id: '1', name: t('templates.revenue.name'), description: t('templates.revenue.description'), category: t('categories.financial'), icon: TrendingUp, lastRun: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', name: t('templates.growth.name'), description: t('templates.growth.description'), category: t('categories.growth'), icon: Users, lastRun: new Date(Date.now() - 172800000).toISOString() },
    { id: '3', name: t('templates.usage.name'), description: t('templates.usage.description'), category: t('categories.usage'), icon: BarChart3, lastRun: null },
    { id: '4', name: t('templates.portfolio.name'), description: t('templates.portfolio.description'), category: t('categories.operations'), icon: Building2, lastRun: new Date(Date.now() - 259200000).toISOString() },
    { id: '5', name: t('templates.payments.name'), description: t('templates.payments.description'), category: t('categories.financial'), icon: CreditCard, lastRun: new Date(Date.now() - 43200000).toISOString() },
    { id: '6', name: t('templates.subscriptions.name'), description: t('templates.subscriptions.description'), category: t('categories.financial'), icon: FileText, lastRun: new Date(Date.now() - 604800000).toISOString() },
  ];
}

const revenueData = [
  { month: 'Aug', mrr: 2100000, newMrr: 180000, churnedMrr: 50000 },
  { month: 'Sep', mrr: 2350000, newMrr: 300000, churnedMrr: 50000 },
  { month: 'Oct', mrr: 2600000, newMrr: 320000, churnedMrr: 70000 },
  { month: 'Nov', mrr: 2900000, newMrr: 380000, churnedMrr: 80000 },
  { month: 'Dec', mrr: 3200000, newMrr: 400000, churnedMrr: 100000 },
  { month: 'Jan', mrr: 3500000, newMrr: 420000, churnedMrr: 120000 },
];

function buildPlanDistribution(t: (key: string) => string) {
  return [
    { name: t('plans.enterprise'), value: 35, color: '#8b5cf6' },
    { name: t('plans.professional'), value: 45, color: '#3b82f6' },
    { name: t('plans.starter'), value: 15, color: '#22c55e' },
    { name: t('plans.trial'), value: 5, color: '#f59e0b' },
  ];
}

const tenantGrowthData = [
  { month: 'Aug', acquired: 12, churned: 2 },
  { month: 'Sep', acquired: 15, churned: 3 },
  { month: 'Oct', acquired: 18, churned: 2 },
  { month: 'Nov', acquired: 20, churned: 4 },
  { month: 'Dec', acquired: 22, churned: 3 },
  { month: 'Jan', acquired: 25, churned: 5 },
];

export function ReportsPage() {
  const t = useTranslations('reportsPage');
  const reportTemplates = buildReportTemplates(t);
  const planDistribution = buildPlanDistribution(t);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'templates' | 'scheduled'>('dashboard');
  const [dateRange, setDateRange] = useState('last30');

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="last7">{t('dateRange.last7')}</option>
            <option value="last30">{t('dateRange.last30')}</option>
            <option value="last90">{t('dateRange.last90')}</option>
            <option value="thisYear">{t('dateRange.thisYear')}</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <Download className="h-4 w-4" />
            {t('export')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tabs.dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tabs.templates')}
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'scheduled'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tabs.scheduled')}
          </button>
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{t('kpis.mrr')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(3500000)}
              </p>
              <p className="text-sm text-green-600 mt-1">{t('kpis.mrrDelta')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{t('kpis.activeTenants')}</p>
              <p className="text-2xl font-bold text-gray-900">118</p>
              <p className="text-sm text-green-600 mt-1">{t('kpis.activeDelta')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{t('kpis.totalUnits')}</p>
              <p className="text-2xl font-bold text-gray-900">4,536</p>
              <p className="text-sm text-green-600 mt-1">{t('kpis.unitsDelta')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{t('kpis.churnRate')}</p>
              <p className="text-2xl font-bold text-gray-900">2.1%</p>
              <p className="text-sm text-green-600 mt-1">{t('kpis.churnDelta')}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">{t('charts.mrrTrend')}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#colorMrr)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('charts.acquisitionVsChurn')}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenantGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip />
                    <Bar
                      dataKey="acquired"
                      fill="#22c55e"
                      name={t('charts.acquired')}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="churned"
                      fill="#ef4444"
                      name={t('charts.churned')}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('charts.revenueByPlan')}
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('charts.topTenants')}
              </h3>
              {/* Live wiring pending — top-tenants endpoint not yet mounted.
                  Render an empty-state placeholder rather than fixture names. */}
              <div className="text-sm text-gray-500 py-6 text-center">
                {t('charts.topTenantsEmpty')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <template.icon className="h-5 w-5 text-violet-600" />
                </div>
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {template.category}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {template.description}
              </p>
              {template.lastRun && (
                <p className="text-xs text-gray-400 mt-3">
                  {t('templates.lastRun', { date: formatDate(template.lastRun) })}
                </p>
              )}
              <div className="flex items-center gap-2 mt-4">
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  <Play className="h-4 w-4" />
                  {t('templates.generate')}
                </button>
                <button className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Calendar className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{t('scheduled.title')}</h3>
            <button className="px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
              {t('scheduled.scheduleNew')}
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.report')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.schedule')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.recipients')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.nextRun')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('scheduled.cols.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                {
                  name: t('scheduled.rows.weeklyRevenue'),
                  schedule: t('scheduled.rows.weeklyRevenueSchedule'),
                  recipients: 3,
                  status: 'active',
                  nextRun: '2025-02-17',
                },
                {
                  name: t('scheduled.rows.monthlyGrowth'),
                  schedule: t('scheduled.rows.monthlyGrowthSchedule'),
                  recipients: 5,
                  status: 'active',
                  nextRun: '2025-03-01',
                },
                {
                  name: t('scheduled.rows.dailyOps'),
                  schedule: t('scheduled.rows.dailyOpsSchedule'),
                  recipients: 2,
                  status: 'paused',
                  nextRun: null,
                },
              ].map((report, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {report.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.schedule}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {t('scheduled.recipientsCount', { count: report.recipients })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        report.status === 'active'
                          ? 'text-green-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {report.status === 'active' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.nextRun || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-sm text-violet-600 hover:text-violet-700">
                      {t('scheduled.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
