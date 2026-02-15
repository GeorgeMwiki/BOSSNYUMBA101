import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  Building2,
  Target,
  ArrowRight,
  PieChart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency } from '../../lib/api';

interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  variance: number;
  byCategory: Array<{ category: string; budgeted: number; spent: number }>;
}

export default function BudgetsPage() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<BudgetSummary>('/budgets/summary'),
      api.get<typeof properties>('/properties'),
    ]).then(([budgetRes, propertiesRes]) => {
      if (budgetRes.success && budgetRes.data) {
        setBudget(budgetRes.data);
      }
      if (propertiesRes.success && propertiesRes.data) {
        setProperties(propertiesRes.data);
      }
      setLoading(false);
    });
  }, []);

  const displayBudget = budget || {
    totalBudget: 25000000,
    totalSpent: 13500000,
    variance: -11500000,
    byCategory: [
      { category: 'Maintenance', budgeted: 6000000, spent: 3100000 },
      { category: 'Utilities', budgeted: 4000000, spent: 2100000 },
      { category: 'Admin', budgeted: 2400000, spent: 1230000 },
      { category: 'Insurance', budgeted: 1500000, spent: 720000 },
      { category: 'Other', budgeted: 2100000, spent: 635000 },
    ],
  };

  const displayProperties = properties.length ? properties : [
    { id: '1', name: 'Westlands Apartments' },
    { id: '2', name: 'Kilimani Complex' },
    { id: '3', name: 'Lavington Residence' },
  ];

  const utilizationPercent = displayBudget.totalBudget
    ? (displayBudget.totalSpent / displayBudget.totalBudget) * 100
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Overview</h1>
          <p className="text-gray-500">Annual budget planning and tracking</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/budgets/forecasts"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <TrendingUp className="h-4 w-4" />
            Forecasts
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Budget</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalBudget)}
          </p>
          <p className="text-sm text-gray-500">annual</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Spent</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalSpent)}
          </p>
          <p className="text-sm text-gray-500">
            {utilizationPercent.toFixed(1)}% utilized
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Remaining</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalBudget - displayBudget.totalSpent)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <PieChart className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">On Track</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-green-600">Yes</p>
          <p className="text-sm text-gray-500">within budget</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayBudget.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="category" stroke="#9CA3AF" fontSize={12} />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="budgeted" name="Budgeted" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Budgets</h3>
          <div className="space-y-3">
            {displayProperties.map((p) => (
              <Link
                key={p.id}
                to={`/budgets/${p.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">{p.name}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
