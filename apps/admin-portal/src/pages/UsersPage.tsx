import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Mail,
  Shield,
  MoreVertical,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantName: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  SUPPORT: 'bg-blue-100 text-blue-700',
  PROPERTY_MANAGER: 'bg-green-100 text-green-700',
  ACCOUNTANT: 'bg-amber-100 text-amber-700',
  OWNER: 'bg-cyan-100 text-cyan-700',
  RESIDENT: 'bg-gray-100 text-gray-700',
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Mock data for demo
    setUsers([
      {
        id: '1',
        email: 'admin@bossnyumba.com',
        firstName: 'System',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        tenantName: 'BOSSNYUMBA',
        status: 'ACTIVE',
        lastLogin: new Date().toISOString(),
        createdAt: '2024-01-01',
      },
      {
        id: '2',
        email: 'support@bossnyumba.com',
        firstName: 'Support',
        lastName: 'Team',
        role: 'SUPPORT',
        tenantName: 'BOSSNYUMBA',
        status: 'ACTIVE',
        lastLogin: new Date(Date.now() - 86400000).toISOString(),
        createdAt: '2024-01-15',
      },
      {
        id: '3',
        email: 'john@acmeproperties.co.ke',
        firstName: 'John',
        lastName: 'Kamau',
        role: 'ADMIN',
        tenantName: 'Acme Properties Ltd',
        status: 'ACTIVE',
        lastLogin: new Date(Date.now() - 3600000).toISOString(),
        createdAt: '2024-03-15',
      },
      {
        id: '4',
        email: 'mary@sunriserealty.co.ke',
        firstName: 'Mary',
        lastName: 'Wanjiku',
        role: 'PROPERTY_MANAGER',
        tenantName: 'Sunrise Realty',
        status: 'ACTIVE',
        lastLogin: new Date(Date.now() - 7200000).toISOString(),
        createdAt: '2024-05-20',
      },
      {
        id: '5',
        email: 'peter@metrohousing.co.ke',
        firstName: 'Peter',
        lastName: 'Ochieng',
        role: 'ADMIN',
        tenantName: 'Metro Housing',
        status: 'PENDING',
        lastLogin: null,
        createdAt: '2025-01-28',
      },
      {
        id: '6',
        email: 'fatma@coastalestates.co.ke',
        firstName: 'Fatma',
        lastName: 'Hassan',
        role: 'PROPERTY_MANAGER',
        tenantName: 'Coastal Estates',
        status: 'SUSPENDED',
        lastLogin: new Date(Date.now() - 604800000).toISOString(),
        createdAt: '2024-08-10',
      },
    ]);
    setLoading(false);
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      user.tenantName.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage users across all tenants</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="all">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPPORT">Support</option>
            <option value="PROPERTY_MANAGER">Property Manager</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="OWNER">Owner</option>
            <option value="RESIDENT">Resident</option>
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
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {users.filter((u) => u.status === 'ACTIVE').length}
          </p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">
            {users.filter((u) => u.status === 'PENDING').length}
          </p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">
            {users.filter((u) => u.status === 'SUSPENDED').length}
          </p>
          <p className="text-sm text-gray-500">Suspended</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-violet-600">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.tenantName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      roleColors[user.role] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`flex items-center gap-1 text-sm ${
                      user.status === 'ACTIVE'
                        ? 'text-green-600'
                        : user.status === 'PENDING'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {user.status === 'ACTIVE' ? (
                      <UserCheck className="h-4 w-4" />
                    ) : user.status === 'PENDING' ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <UserX className="h-4 w-4" />
                    )}
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Send Email"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Change Role"
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12 text-gray-500">No users found</div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Add New User
              </h2>
              <p className="text-sm text-gray-500">Create a new user account</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Select tenant...</option>
                  <option value="bossnyumba">BOSSNYUMBA (Internal)</option>
                  <option value="acme">Acme Properties Ltd</option>
                  <option value="sunrise">Sunrise Realty</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="property_manager">Property Manager</option>
                  <option value="accountant">Accountant</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendInvite"
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  defaultChecked
                />
                <label htmlFor="sendInvite" className="text-sm text-gray-700">
                  Send invitation email
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
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
