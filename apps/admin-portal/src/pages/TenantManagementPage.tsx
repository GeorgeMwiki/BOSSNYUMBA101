import React, { useEffect, useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  MoreVertical,
  Filter,
  Download,
  Edit2,
  Settings,
  Shield,
  Users,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/api';

interface Tenant {
  id: string;
  name: string;
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CHURNED' | 'PENDING';
  plan: string;
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
  settings: {
    maxProperties: number;
    maxUsers: number;
    allowCustomBranding: boolean;
    enableMpesaIntegration: boolean;
    enableSmsNotifications: boolean;
    dataRetentionDays: number;
  };
}

interface PolicyConfig {
  tenantId: string;
  maxProperties: number;
  maxUsers: number;
  maxStorageGB: number;
  allowCustomBranding: boolean;
  enableMpesaIntegration: boolean;
  enableSmsNotifications: boolean;
  enableEmailNotifications: boolean;
  enableWhatsApp: boolean;
  dataRetentionDays: number;
  allowApiAccess: boolean;
  maxApiCallsPerDay: number;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIAL: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  CHURNED: 'bg-red-100 text-red-700',
  PENDING: 'bg-gray-100 text-gray-700',
};

const mockTenants: Tenant[] = [
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
      phone: '+254 712 345 678',
    },
    settings: {
      maxProperties: 100,
      maxUsers: 50,
      allowCustomBranding: true,
      enableMpesaIntegration: true,
      enableSmsNotifications: true,
      dataRetentionDays: 365,
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
      phone: '+254 723 456 789',
    },
    settings: {
      maxProperties: 25,
      maxUsers: 15,
      allowCustomBranding: true,
      enableMpesaIntegration: true,
      enableSmsNotifications: true,
      dataRetentionDays: 180,
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
      phone: '+254 734 567 890',
    },
    settings: {
      maxProperties: 25,
      maxUsers: 15,
      allowCustomBranding: false,
      enableMpesaIntegration: true,
      enableSmsNotifications: false,
      dataRetentionDays: 90,
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
      phone: '+254 745 678 901',
    },
    settings: {
      maxProperties: 10,
      maxUsers: 5,
      allowCustomBranding: false,
      enableMpesaIntegration: true,
      enableSmsNotifications: false,
      dataRetentionDays: 90,
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
      phone: '+254 756 789 012',
    },
    settings: {
      maxProperties: 100,
      maxUsers: 50,
      allowCustomBranding: true,
      enableMpesaIntegration: true,
      enableSmsNotifications: true,
      dataRetentionDays: 365,
    },
  },
];

export function TenantManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    plan: 'starter',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    startTrial: true,
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTenants(mockTenants);
    } catch (err) {
      setError('Failed to load tenants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      plan: tenant.plan.toLowerCase(),
      contactName: tenant.primaryContact.name,
      contactEmail: tenant.primaryContact.email,
      contactPhone: tenant.primaryContact.phone,
      startTrial: tenant.status === 'TRIAL',
    });
    setShowEditModal(true);
  };

  const handleOpenPolicy = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setPolicyConfig({
      tenantId: tenant.id,
      maxProperties: tenant.settings.maxProperties,
      maxUsers: tenant.settings.maxUsers,
      maxStorageGB: 50,
      allowCustomBranding: tenant.settings.allowCustomBranding,
      enableMpesaIntegration: tenant.settings.enableMpesaIntegration,
      enableSmsNotifications: tenant.settings.enableSmsNotifications,
      enableEmailNotifications: true,
      enableWhatsApp: false,
      dataRetentionDays: tenant.settings.dataRetentionDays,
      allowApiAccess: true,
      maxApiCallsPerDay: 10000,
    });
    setShowPolicyModal(true);
  };

  const handleSavePolicy = () => {
    // In real app, this would call API
    console.log('Saving policy config:', policyConfig);
    setShowPolicyModal(false);
    setPolicyConfig(null);
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.primaryContact.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || tenant.status === statusFilter;
    const matchesPlan =
      planFilter === 'all' ||
      tenant.plan.toLowerCase() === planFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesPlan;
  });

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
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadTenants}
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
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-gray-500">
            Manage tenant organizations, subscriptions, and policies
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: '',
              plan: 'starter',
              contactName: '',
              contactEmail: '',
              contactPhone: '',
              startTrial: true,
            });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CHURNED">Churned</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <p className="text-2xl font-bold text-amber-600">
            {tenants.filter((t) => t.status === 'SUSPENDED').length}
          </p>
          <p className="text-sm text-gray-500">Suspended</p>
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
        <div className="overflow-x-auto">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Resources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  MRR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
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
                      <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {tenant.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {tenant.primaryContact.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[tenant.status]}`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.plan}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {tenant.properties}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {tenant.users}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 hidden lg:table-cell">
                    {formatCurrency(tenant.mrr)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {formatDate(tenant.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(tenant)}
                        className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Edit Tenant"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenPolicy(tenant)}
                        className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="Policy Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="More Actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredTenants.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No tenants found matching your criteria</p>
        </div>
      )}

      {/* Create/Edit Tenant Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {showEditModal ? 'Edit Tenant' : 'Create New Tenant'}
                </h2>
                <p className="text-sm text-gray-500">
                  {showEditModal
                    ? 'Update tenant organization details'
                    : 'Set up a new tenant organization'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.plan}
                  onChange={(e) =>
                    setFormData({ ...formData, plan: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="starter">Starter - KES 15,000/mo</option>
                  <option value="professional">
                    Professional - KES 45,000/mo
                  </option>
                  <option value="enterprise">Enterprise - Custom Pricing</option>
                </select>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Primary Contact
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) =>
                        setFormData({ ...formData, contactName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Enter contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="admin@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPhone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="+254 7XX XXX XXX"
                    />
                  </div>
                </div>
              </div>
              {!showEditModal && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="trial"
                    checked={formData.startTrial}
                    onChange={(e) =>
                      setFormData({ ...formData, startTrial: e.target.checked })
                    }
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="trial" className="text-sm text-gray-700">
                    Start with 14-day free trial
                  </label>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                <Save className="h-4 w-4" />
                {showEditModal ? 'Save Changes' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Configuration Modal */}
      {showPolicyModal && policyConfig && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Policy Configuration
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedTenant.name} - {selectedTenant.plan} Plan
                </p>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Resource Limits */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-600" />
                  Resource Limits
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Properties
                    </label>
                    <input
                      type="number"
                      value={policyConfig.maxProperties}
                      onChange={(e) =>
                        setPolicyConfig({
                          ...policyConfig,
                          maxProperties: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Users
                    </label>
                    <input
                      type="number"
                      value={policyConfig.maxUsers}
                      onChange={(e) =>
                        setPolicyConfig({
                          ...policyConfig,
                          maxUsers: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Storage (GB)
                    </label>
                    <input
                      type="number"
                      value={policyConfig.maxStorageGB}
                      onChange={(e) =>
                        setPolicyConfig({
                          ...policyConfig,
                          maxStorageGB: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Retention (days)
                    </label>
                    <input
                      type="number"
                      value={policyConfig.dataRetentionDays}
                      onChange={(e) =>
                        setPolicyConfig({
                          ...policyConfig,
                          dataRetentionDays: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-violet-600" />
                  Feature Flags
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      key: 'allowCustomBranding',
                      label: 'Custom Branding',
                      desc: 'Allow tenant to customize logos and colors',
                    },
                    {
                      key: 'enableMpesaIntegration',
                      label: 'M-Pesa Integration',
                      desc: 'Enable mobile money payment processing',
                    },
                    {
                      key: 'enableSmsNotifications',
                      label: 'SMS Notifications',
                      desc: 'Send SMS alerts to tenants and owners',
                    },
                    {
                      key: 'enableEmailNotifications',
                      label: 'Email Notifications',
                      desc: 'Send email notifications for events',
                    },
                    {
                      key: 'enableWhatsApp',
                      label: 'WhatsApp Integration',
                      desc: 'Enable WhatsApp messaging channel',
                    },
                    {
                      key: 'allowApiAccess',
                      label: 'API Access',
                      desc: 'Allow external API integrations',
                    },
                  ].map((feature) => (
                    <div
                      key={feature.key}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {feature.label}
                        </p>
                        <p className="text-sm text-gray-500">{feature.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            policyConfig[
                              feature.key as keyof PolicyConfig
                            ] as boolean
                          }
                          onChange={(e) =>
                            setPolicyConfig({
                              ...policyConfig,
                              [feature.key]: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Limits */}
              {policyConfig.allowApiAccess && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">API Limits</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max API Calls Per Day
                    </label>
                    <input
                      type="number"
                      value={policyConfig.maxApiCallsPerDay}
                      onChange={(e) =>
                        setPolicyConfig({
                          ...policyConfig,
                          maxApiCallsPerDay: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="h-4 w-4" />
                Reset to Default
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePolicy}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  <CheckCircle className="h-4 w-4" />
                  Save Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
