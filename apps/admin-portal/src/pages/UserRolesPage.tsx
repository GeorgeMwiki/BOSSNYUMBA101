import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Shield,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Save,
  Copy,
} from 'lucide-react';
import { formatDate } from '../lib/api';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  tenantName: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const permissions: Permission[] = [
  // Tenant Management
  { id: 'tenant.view', name: 'View Tenants', description: 'View tenant list and details', category: 'Tenant Management' },
  { id: 'tenant.create', name: 'Create Tenants', description: 'Create new tenant organizations', category: 'Tenant Management' },
  { id: 'tenant.edit', name: 'Edit Tenants', description: 'Modify tenant settings', category: 'Tenant Management' },
  { id: 'tenant.delete', name: 'Delete Tenants', description: 'Remove tenant organizations', category: 'Tenant Management' },
  { id: 'tenant.suspend', name: 'Suspend Tenants', description: 'Suspend tenant access', category: 'Tenant Management' },
  // User Management
  { id: 'user.view', name: 'View Users', description: 'View user list and profiles', category: 'User Management' },
  { id: 'user.create', name: 'Create Users', description: 'Create new user accounts', category: 'User Management' },
  { id: 'user.edit', name: 'Edit Users', description: 'Modify user profiles and settings', category: 'User Management' },
  { id: 'user.delete', name: 'Delete Users', description: 'Remove user accounts', category: 'User Management' },
  { id: 'user.impersonate', name: 'Impersonate Users', description: 'Log in as another user', category: 'User Management' },
  // Billing
  { id: 'billing.view', name: 'View Billing', description: 'View invoices and payments', category: 'Billing' },
  { id: 'billing.manage', name: 'Manage Billing', description: 'Issue credits and refunds', category: 'Billing' },
  { id: 'billing.export', name: 'Export Billing', description: 'Export billing data', category: 'Billing' },
  // Support
  { id: 'support.view', name: 'View Tickets', description: 'View support tickets', category: 'Support' },
  { id: 'support.respond', name: 'Respond to Tickets', description: 'Reply to support tickets', category: 'Support' },
  { id: 'support.escalate', name: 'Escalate Tickets', description: 'Escalate to higher support', category: 'Support' },
  { id: 'support.close', name: 'Close Tickets', description: 'Close support tickets', category: 'Support' },
  // System
  { id: 'system.health', name: 'View System Health', description: 'Monitor system status', category: 'System' },
  { id: 'system.config', name: 'System Configuration', description: 'Modify system settings', category: 'System' },
  { id: 'system.logs', name: 'View Logs', description: 'Access audit and system logs', category: 'System' },
  { id: 'system.ai', name: 'Manage AI Settings', description: 'Configure AI decision making', category: 'System' },
];

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full system access with all permissions',
    permissions: permissions.map((p) => p.id),
    userCount: 2,
    isSystem: true,
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'ADMIN',
    displayName: 'Administrator',
    description: 'Administrative access for tenant management',
    permissions: [
      'tenant.view', 'tenant.create', 'tenant.edit',
      'user.view', 'user.create', 'user.edit',
      'billing.view', 'support.view', 'support.respond',
      'system.health', 'system.logs',
    ],
    userCount: 5,
    isSystem: true,
    createdAt: '2024-01-01',
  },
  {
    id: '3',
    name: 'SUPPORT',
    displayName: 'Support Agent',
    description: 'Customer support and ticket management',
    permissions: [
      'tenant.view', 'user.view',
      'support.view', 'support.respond', 'support.escalate', 'support.close',
      'system.health',
    ],
    userCount: 8,
    isSystem: true,
    createdAt: '2024-01-01',
  },
  {
    id: '4',
    name: 'BILLING_MANAGER',
    displayName: 'Billing Manager',
    description: 'Manage billing, invoices, and payments',
    permissions: [
      'tenant.view', 'user.view',
      'billing.view', 'billing.manage', 'billing.export',
    ],
    userCount: 3,
    isSystem: false,
    createdAt: '2024-06-15',
  },
  {
    id: '5',
    name: 'VIEWER',
    displayName: 'Read-Only Viewer',
    description: 'View-only access across all modules',
    permissions: [
      'tenant.view', 'user.view', 'billing.view', 'support.view', 'system.health',
    ],
    userCount: 12,
    isSystem: false,
    createdAt: '2024-08-20',
  },
];

const mockUsers: User[] = [
  { id: '1', email: 'admin@bossnyumba.com', firstName: 'System', lastName: 'Admin', roles: ['SUPER_ADMIN'], tenantName: 'BOSSNYUMBA', status: 'ACTIVE', lastLogin: new Date().toISOString(), createdAt: '2024-01-01' },
  { id: '2', email: 'john@bossnyumba.com', firstName: 'John', lastName: 'Mwangi', roles: ['ADMIN'], tenantName: 'BOSSNYUMBA', status: 'ACTIVE', lastLogin: new Date(Date.now() - 3600000).toISOString(), createdAt: '2024-02-15' },
  { id: '3', email: 'mary@bossnyumba.com', firstName: 'Mary', lastName: 'Akinyi', roles: ['SUPPORT'], tenantName: 'BOSSNYUMBA', status: 'ACTIVE', lastLogin: new Date(Date.now() - 7200000).toISOString(), createdAt: '2024-03-10' },
  { id: '4', email: 'peter@bossnyumba.com', firstName: 'Peter', lastName: 'Kamau', roles: ['BILLING_MANAGER'], tenantName: 'BOSSNYUMBA', status: 'ACTIVE', lastLogin: new Date(Date.now() - 86400000).toISOString(), createdAt: '2024-06-20' },
  { id: '5', email: 'grace@bossnyumba.com', firstName: 'Grace', lastName: 'Wanjiku', roles: ['SUPPORT', 'VIEWER'], tenantName: 'BOSSNYUMBA', status: 'ACTIVE', lastLogin: null, createdAt: '2024-09-01' },
];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  SUPPORT: 'bg-blue-100 text-blue-700',
  BILLING_MANAGER: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

export function UserRolesPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    [...new Set(permissions.map((p) => p.category))]
  );

  // Role form state
  const [roleForm, setRoleForm] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
  });

  // User role assignment state
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRoles(mockRoles);
      setUsers(mockUsers);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissions: [...role.permissions],
    });
    setShowRoleModal(true);
  };

  const handleCreateRole = () => {
    setSelectedRole(null);
    setRoleForm({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
    });
    setShowRoleModal(true);
  };

  const handleDuplicateRole = (role: Role) => {
    setSelectedRole(null);
    setRoleForm({
      name: `${role.name}_COPY`,
      displayName: `${role.displayName} (Copy)`,
      description: role.description,
      permissions: [...role.permissions],
    });
    setShowRoleModal(true);
  };

  const handleEditUserRoles = (user: User) => {
    setSelectedUser(user);
    setUserRoles([...user.roles]);
    setShowUserModal(true);
  };

  const togglePermission = (permissionId: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleAllInCategory = (category: string, enabled: boolean) => {
    const categoryPermissions = permissions
      .filter((p) => p.category === category)
      .map((p) => p.id);
    
    setRoleForm((prev) => ({
      ...prev,
      permissions: enabled
        ? [...new Set([...prev.permissions, ...categoryPermissions])]
        : prev.permissions.filter((p) => !categoryPermissions.includes(p)),
    }));
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const categories = [...new Set(permissions.map((p) => p.category))];

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
          onClick={loadData}
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
          <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-gray-500">Manage user access and role permissions</p>
        </div>
        <button
          onClick={activeTab === 'users' ? () => setShowUserModal(true) : handleCreateRole}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'users' ? 'Add User' : 'Create Role'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users ({users.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'roles'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles ({roles.length})
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Users Tab */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.displayName}
                  </option>
                ))}
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
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
                          <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-violet-600">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((roleName) => (
                            <span
                              key={roleName}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                roleColors[roleName] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {roles.find((r) => r.name === roleName)?.displayName || roleName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEditUserRoles(user)}
                          className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Edit Roles"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Roles Tab */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const permissionCount = role.permissions.length;
              const totalPermissions = permissions.length;
              return (
                <div
                  key={role.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          roleColors[role.name]?.replace('text-', 'bg-').replace('-700', '-100') ||
                          'bg-gray-100'
                        }`}
                      >
                        <Shield
                          className={`h-5 w-5 ${
                            roleColors[role.name]?.split(' ')[1] || 'text-gray-600'
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {role.displayName}
                        </h3>
                        {role.isSystem && (
                          <span className="text-xs text-gray-400">System Role</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDuplicateRole(role)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                        title="Duplicate Role"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditRole(role)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                        title="Edit Role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {!role.isSystem && (
                        <button
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete Role"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{role.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {permissionCount} of {totalPermissions} permissions
                    </span>
                    <span className="text-gray-500">{role.userCount} users</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-violet-600 h-1.5 rounded-full"
                      style={{
                        width: `${(permissionCount / totalPermissions) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Role Editor Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedRole ? 'Edit Role' : 'Create New Role'}
                </h2>
                <p className="text-sm text-gray-500">
                  Configure role name and permissions
                </p>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Role Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role Name (Key) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) =>
                        setRoleForm({
                          ...roleForm,
                          name: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="ROLE_NAME"
                      disabled={selectedRole?.isSystem}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={roleForm.displayName}
                      onChange={(e) =>
                        setRoleForm({ ...roleForm, displayName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Role Display Name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Describe what this role is for..."
                  />
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">Permissions</h3>
                    <span className="text-sm text-gray-500">
                      {roleForm.permissions.length} of {permissions.length} selected
                    </span>
                  </div>
                  <div className="space-y-2">
                    {categories.map((category) => {
                      const categoryPermissions = permissions.filter(
                        (p) => p.category === category
                      );
                      const selectedCount = categoryPermissions.filter((p) =>
                        roleForm.permissions.includes(p.id)
                      ).length;
                      const isExpanded = expandedCategories.includes(category);
                      const allSelected = selectedCount === categoryPermissions.length;

                      return (
                        <div
                          key={category}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                              <span className="font-medium text-gray-900">
                                {category}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({selectedCount}/{categoryPermissions.length})
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAllInCategory(category, !allSelected);
                              }}
                              className="text-sm text-violet-600 hover:text-violet-700"
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="p-3 space-y-2">
                              {categoryPermissions.map((permission) => (
                                <label
                                  key={permission.id}
                                  className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permissions.includes(permission.id)}
                                    onChange={() => togglePermission(permission.id)}
                                    className="mt-1 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                  />
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {permission.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {permission.description}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowRoleModal(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                <Save className="h-4 w-4" />
                {selectedRole ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Role Assignment Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Assign Roles
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={userRoles.includes(role.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUserRoles([...userRoles, role.name]);
                        } else {
                          setUserRoles(userRoles.filter((r) => r !== role.name));
                        }
                      }}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{role.displayName}</p>
                      <p className="text-sm text-gray-500">{role.description}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        roleColors[role.name] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {role.permissions.length} perms
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowUserModal(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                <Check className="h-4 w-4" />
                Save Roles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
