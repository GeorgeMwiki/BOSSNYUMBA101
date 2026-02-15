import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Filter,
  ChevronRight,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/api';

interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  mrr: number;
  billingCycle: 'monthly' | 'annual';
  currentPeriodEnd: string;
  createdAt: string;
}

const subscriptions: Subscription[] = [
  {
    id: '1',
    tenantId: 't1',
    tenantName: 'Acme Properties Ltd',
    plan: 'Enterprise',
    status: 'active',
    mrr: 125000,
    billingCycle: 'monthly',
    currentPeriodEnd: '2025-03-15',
    createdAt: '2024-03-15',
  },
  {
    id: '2',
    tenantId: 't2',
    tenantName: 'Sunrise Realty',
    plan: 'Professional',
    status: 'active',
    mrr: 45000,
    billingCycle: 'annual',
    currentPeriodEnd: '2025-05-20',
    createdAt: '2024-05-20',
  },
  {
    id: '3',
    tenantId: 't3',
    tenantName: 'Metro Housing',
    plan: 'Professional',
    status: 'trialing',
    mrr: 0,
    billingCycle: 'monthly',
    currentPeriodEnd: '2025-02-11',
    createdAt: '2025-01-28',
  },
  {
    id: '4',
    tenantId: 't4',
    tenantName: 'Coastal Estates',
    plan: 'Starter',
    status: 'past_due',
    mrr: 15000,
    billingCycle: 'monthly',
    currentPeriodEnd: '2025-01-10',
    createdAt: '2024-08-10',
  },
  {
    id: '5',
    tenantId: 't5',
    tenantName: 'Highland Properties',
    plan: 'Enterprise',
    status: 'active',
    mrr: 95000,
    billingCycle: 'annual',
    currentPeriodEnd: '2025-01-05',
    createdAt: '2024-01-05',
  },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-red-100 text-red-700',
};

export default function PlatformSubscriptionsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch = sub.tenantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'active').length,
    trialing: subscriptions.filter((s) => s.status === 'trialing').length,
    pastDue: subscriptions.filter((s) => s.status === 'past_due').length,
    totalMrr: subscriptions
      .filter((s) => s.status === 'active' || s.status === 'past_due')
      .reduce((sum, s) => sum + s.mrr, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Tenant Subscriptions
          </h1>
          <p className="text-gray-500">
            Manage tenant plans and billing cycles
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total Subscriptions</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.trialing}</p>
          <p className="text-sm text-gray-500">In Trial</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.pastDue}</p>
          <p className="text-sm text-gray-500">Past Due</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.totalMrr)}
          </p>
          <p className="text-sm text-gray-500">Total MRR</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Billing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MRR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period End
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSubscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-violet-600" />
                    </div>
                    <span className="font-medium text-gray-900">
                      {sub.tenantName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sub.plan}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[sub.status] || statusColors.active
                    }`}
                  >
                    {sub.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="capitalize">{sub.billingCycle}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(sub.mrr)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(sub.currentPeriodEnd)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <Link
                    to={`/tenants/${sub.tenantId}`}
                    className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700"
                  >
                    Manage
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSubscriptions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No subscriptions found
        </div>
      )}
    </div>
  );
}
