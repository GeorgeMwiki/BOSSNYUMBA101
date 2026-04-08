import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench, Zap, Shield, FileText } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, formatCurrency } from '../../../lib/api';

const COLORS = ['#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981'];

interface ExpensesMeta {
  trend: Array<{ month: string; maintenance: number; utilities: number; admin: number }>;
  byCategory: Array<{ name: string; value: number }>;
  totalExpenses: number;
}

export default function ExpensesPage() {
  const [chartData, setChartData] = useState<
    Array<{ month: string; maintenance: number; utilities: number; admin: number }>
  >([]);
  const [byCategory, setByCategory] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<Array<{ month: string; maintenance: number; utilities: number; admin: number }>>(
        '/analytics/expenses'
      )
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setChartData(res.data);
          const meta = (res as { meta?: ExpensesMeta }).meta;
          if (meta) setByCategory(meta.byCategory);
        } else {
          setChartData([]);
          setByCategory([]);
          setError(res.error?.message ?? 'Live expense KPIs are unavailable.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Live expense KPIs are unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Latest period snapshot for stat cards.
  const latest = chartData[chartData.length - 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Breakdown</h1>
          <p className="text-gray-500">Track and analyze property expenses</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Wrench className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Maintenance</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {latest ? formatCurrency(latest.maintenance) : '—'}
          </p>
          <p className="text-sm text-gray-500">latest period</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Utilities</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {latest ? formatCurrency(latest.utilities) : '—'}
          </p>
          <p className="text-sm text-gray-500">latest period</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Admin</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {latest ? formatCurrency(latest.admin) : '—'}
          </p>
          <p className="text-sm text-gray-500">latest period</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Insurance</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {(() => {
              const insurance = byCategory.find((c) => c.name === 'Insurance');
              return insurance ? formatCurrency(insurance.value) : '—';
            })()}
          </p>
          <p className="text-sm text-gray-500">period total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Month</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="maintenance" name="Maintenance" fill="#F59E0B" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="utilities" name="Utilities" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="admin" name="Admin" fill="#8B5CF6" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
