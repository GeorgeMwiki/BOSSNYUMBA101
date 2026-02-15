import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  MoreVertical,
  Filter,
  Download,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../lib/api';

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
  primaryContact: {
    name: string;
    email: string;
  };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIAL: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  CHURNED: 'bg-red-100 text-red-700',
  PENDING: 'bg-gray-100 text-gray-700',
};

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    api.get<Tenant[]>('/tenants').then((response) => {
      if (response.success && response.data) {
        setTenants(response.data);
      } else {
        // Mock data for demo
        setTenants([
          {
            id: '1',
            name: 'Acme Properties Ltd',
            status: 'ACTIVE',
            plan: 'Enterprise',
            properties: 45,
            units: 320,
            users: 28,
            mrr: 125000,
            createdAt: '2024-03-15',
            primaryContact: {
              name: 'John Kamau',
              email: 'john@acmeproperties.co.ke',
            },
          },
          {
            id: '2',
            name: 'Sunrise Realty',
            status: 'ACTIVE',
            plan: 'Professional',
            properties: 12,
            units: 85,
            users: 8,
            mrr: 45000,
            createdAt: '2024-05-20',
            primaryContact: {
              name: 'Mary Wanjiku',
              email: 'mary@sunriserealty.co.ke',
            },
          },
          {
            id: '3',
            name: 'Metro Housing',
            status: 'TRIAL',
            plan: 'Professional',
            properties: 3,
            units: 24,
            users: 2,
            mrr: 0,
            createdAt: '2025-01-28',
            primaryContact: {
              name: 'Peter Ochieng',
              email: 'peter@metrohousing.co.ke',
            },
          },
          {
            id: '4',
            name: 'Coastal Estates',
            status: 'SUSPENDED',
            plan: 'Starter',
            properties: 5,
            units: 38,
            users: 4,
            mrr: 15000,
            createdAt: '2024-08-10',
            primaryContact: {
              name: 'Fatma Hassan',
              email: 'fatma@coastalestates.co.ke',
            },
          },
          {
            id: '5',
            name: 'Highland Properties',
            status: 'ACTIVE',
            plan: 'Enterprise',
            properties: 28,
            units: 195,
            users: 15,
            mrr: 95000,
            createdAt: '2024-01-05',
            primaryContact: {
              name: 'David Kipchoge',
              email: 'david@highland.co.ke',
            },
          },
        ]);
      }
      setLoading(false);
    });
  }, []);

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.primaryContact.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Tenant Organizations
          </h1>
          <p className="text-gray-500">
            Manage tenant accounts and subscriptions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Quick Create
          </button>
          <Link
            to="/tenants/onboard"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Onboard Tenant
          </Link>
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
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CHURNED">Churned</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            More Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
          <p className="text-sm text-gray-500">Total Tenants</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {tenants.filter((t) => t.status === 'ACTIVE').length}
          </p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            {tenants.filter((t) => t.status === 'TRIAL').length}
          </p>
          <p className="text-sm text-gray-500">In Trial</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(tenants.reduce((sum, t) => sum + t.mrr, 0))}
          </p>
          <p className="text-sm text-gray-500">Total MRR</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resources
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MRR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tenant.name}</p>
                      <p className="text-sm text-gray-500">
                        {tenant.primaryContact.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[tenant.status] || statusColors.PENDING
                    }`}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {tenant.plan}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>{tenant.properties} properties</span>
                    <span>{tenant.units} units</span>
                    <span>{tenant.users} users</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(tenant.mrr)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <Link
                    to={`/tenants/${tenant.id}`}
                    className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700"
                  >
                    View
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTenants.length === 0 && (
        <div className="text-center py-12 text-gray-500">No tenants found</div>
      )}

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Create New Tenant
              </h2>
              <p className="text-sm text-gray-500">
                Set up a new tenant organization
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trial"
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="trial" className="text-sm text-gray-700">
                  Start with 14-day free trial
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                Create Tenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
