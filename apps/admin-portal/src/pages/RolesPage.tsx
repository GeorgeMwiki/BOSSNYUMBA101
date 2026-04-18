import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton, Alert, AlertDescription, Button, toast } from '@bossnyumba/design-system';
import {
  useRoles,
  useRolesAudit,
  type AdminRole as Role,
  type AdminAuditEntry as AuditEntry,
} from '../lib/hooks';
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronRight,
  Users,
  Lock,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  RefreshCw,
  Copy,
  Eye,
  Settings,
  Building2,
  DollarSign,
  FileText,
  Wrench,
  Grid3X3,
  GitBranch,
} from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}


const permissionCategories = [
  {
    id: 'properties',
    name: 'Properties',
    icon: Building2,
    permissions: [
      { id: 'properties.view', name: 'View Properties', description: 'View property details and listings' },
      { id: 'properties.create', name: 'Create Properties', description: 'Add new properties to the system' },
      { id: 'properties.edit', name: 'Edit Properties', description: 'Modify property details' },
      { id: 'properties.delete', name: 'Delete Properties', description: 'Remove properties from the system' },
    ],
  },
  {
    id: 'units',
    name: 'Units',
    icon: Building2,
    permissions: [
      { id: 'units.view', name: 'View Units', description: 'View unit details and availability' },
      { id: 'units.create', name: 'Create Units', description: 'Add new units to properties' },
      { id: 'units.edit', name: 'Edit Units', description: 'Modify unit details and pricing' },
      { id: 'units.delete', name: 'Delete Units', description: 'Remove units from properties' },
    ],
  },
  {
    id: 'tenants',
    name: 'Tenant Organizations',
    icon: Users,
    permissions: [
      { id: 'tenants.view', name: 'View Tenants', description: 'View tenant organization details' },
      { id: 'tenants.create', name: 'Create Tenants', description: 'Onboard new tenant organizations' },
      { id: 'tenants.edit', name: 'Edit Tenants', description: 'Modify tenant settings and policies' },
      { id: 'tenants.suspend', name: 'Suspend/Activate Tenants', description: 'Suspend or reactivate tenant accounts' },
      { id: 'tenants.delete', name: 'Delete Tenants', description: 'Permanently remove tenant organizations' },
    ],
  },
  {
    id: 'users',
    name: 'Users',
    icon: Users,
    permissions: [
      { id: 'users.view', name: 'View Users', description: 'View user profiles and activity' },
      { id: 'users.create', name: 'Create Users', description: 'Add new users to the system' },
      { id: 'users.edit', name: 'Edit Users', description: 'Modify user details and roles' },
      { id: 'users.delete', name: 'Delete Users', description: 'Remove users from the system' },
      { id: 'users.impersonate', name: 'Impersonate Users', description: 'Access system as another user' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: DollarSign,
    permissions: [
      { id: 'finance.view', name: 'View Financials', description: 'View financial reports and transactions' },
      { id: 'finance.invoices', name: 'Manage Invoices', description: 'Create and modify invoices' },
      { id: 'finance.payments', name: 'Process Payments', description: 'Record and process payments' },
      { id: 'finance.disbursements', name: 'Manage Disbursements', description: 'Create and approve disbursements' },
      { id: 'finance.adjustments', name: 'Apply Adjustments', description: 'Apply credits and adjustments' },
    ],
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    icon: Wrench,
    permissions: [
      { id: 'maintenance.view', name: 'View Work Orders', description: 'View maintenance requests' },
      { id: 'maintenance.create', name: 'Create Work Orders', description: 'Submit maintenance requests' },
      { id: 'maintenance.assign', name: 'Assign Work Orders', description: 'Assign work to vendors/staff' },
      { id: 'maintenance.approve', name: 'Approve Work Orders', description: 'Approve high-value work orders' },
      { id: 'maintenance.complete', name: 'Complete Work Orders', description: 'Mark work orders as complete' },
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: FileText,
    permissions: [
      { id: 'documents.view', name: 'View Documents', description: 'Access and view documents' },
      { id: 'documents.upload', name: 'Upload Documents', description: 'Upload new documents' },
      { id: 'documents.delete', name: 'Delete Documents', description: 'Remove documents' },
      { id: 'documents.sign', name: 'E-Sign Documents', description: 'Sign documents electronically' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    permissions: [
      { id: 'settings.view', name: 'View Settings', description: 'View system configuration' },
      { id: 'settings.edit', name: 'Edit Settings', description: 'Modify system configuration' },
      { id: 'settings.roles', name: 'Manage Roles', description: 'Create and modify roles' },
      { id: 'settings.audit', name: 'View Audit Logs', description: 'Access audit trail' },
    ],
  },
];

export function RolesPage() {
  const rolesQuery = useRoles();
  const auditQuery = useRolesAudit();
  const roles = rolesQuery.data ?? [];
  const auditLog = auditQuery.data ?? [];
  const loading = rolesQuery.isLoading;
  const queryError = rolesQuery.error;

  // Client-side list used by the create/delete UX (mirrors query result,
  // then diverges on optimistic local mutation).
  const [localRoles, setLocalRoles] = useState<Role[] | null>(null);
  const displayRoles = localRoles ?? roles;

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showPermissionAudit, setShowPermissionAudit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    permissions: string[];
  }>({
    name: '',
    description: '',
    permissions: [],
  });

  // Legacy hardcoded role seed removed — the real list is loaded via
  // rolesService.list() above; missing endpoint returns an empty list.

  const filteredRoles = displayRoles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRole = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newRole: Role = {
      id: String(displayRoles.length + 1),
      name: roleForm.name,
      description: roleForm.description,
      permissions: roleForm.permissions,
      userCount: 0,
      isSystem: false,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: 'admin@bossnyumba.com',
    };
    setLocalRoles([...displayRoles, newRole]);
    setSaving(false);
    setShowCreateModal(false);
    setRoleForm({ name: '', description: '', permissions: [] });
    toast.success('Role created successfully');
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLocalRoles(displayRoles.map(r => r.id === selectedRole.id ? {
      ...r,
      name: roleForm.name,
      description: roleForm.description,
      permissions: roleForm.permissions,
    } : r));
    setSaving(false);
    setSelectedRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    toast.success('Role updated successfully');
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      toast.error('Cannot delete system roles');
      return;
    }
    if (role.userCount > 0) {
      toast.error('Cannot delete role with assigned users');
      return;
    }
    setLocalRoles(displayRoles.filter(r => r.id !== role.id));
    toast.success('Role deleted successfully');
  };

  const togglePermission = (permissionId: string) => {
    if (roleForm.permissions.includes(permissionId)) {
      setRoleForm({ ...roleForm, permissions: roleForm.permissions.filter(p => p !== permissionId) });
    } else {
      setRoleForm({ ...roleForm, permissions: [...roleForm.permissions, permissionId] });
    }
  };

  const toggleCategoryPermissions = (categoryId: string) => {
    const category = permissionCategories.find(c => c.id === categoryId);
    if (!category) return;
    const categoryPermissionIds = category.permissions.map(p => p.id);
    const allSelected = categoryPermissionIds.every(id => roleForm.permissions.includes(id));
    if (allSelected) {
      setRoleForm({ ...roleForm, permissions: roleForm.permissions.filter(p => !categoryPermissionIds.includes(p)) });
    } else {
      const newPermissions = [...new Set([...roleForm.permissions, ...categoryPermissionIds])];
      setRoleForm({ ...roleForm, permissions: newPermissions });
    }
  };

  const editRole = (role: Role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    });
  };

  const duplicateRole = (role: Role) => {
    setRoleForm({
      name: `${role.name} (Copy)`,
      description: role.description,
      permissions: [...role.permissions],
    });
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (queryError) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {queryError instanceof Error ? queryError.message : 'Failed to load roles'}
          <Button size="sm" onClick={() => rolesQuery.refetch()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage roles and permissions for platform access</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/roles/permissions"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Grid3X3 className="h-4 w-4" />
            Permission Matrix
          </Link>
          <Link
            to="/roles/approvals"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <GitBranch className="h-4 w-4" />
            Approval Matrix
          </Link>
          <button
            onClick={() => setShowPermissionAudit(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" />
            Audit Log
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Notifications are shown via the design-system toast (Toaster mounted at app root). */}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${role.isSystem ? 'bg-violet-100' : 'bg-gray-100'}`}>
                  <Shield className={`h-5 w-5 ${role.isSystem ? 'text-violet-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{role.name}</h3>
                  {role.isSystem && (
                    <span className="text-xs text-violet-600 font-medium">System Role</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicateRole(role)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {!role.isSystem && (
                  <>
                    <button
                      onClick={() => editRole(role)}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{role.description}</p>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-gray-500">
                  <Lock className="h-4 w-4" />
                  {role.permissions.length} permissions
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                  <Users className="h-4 w-4" />
                  {role.userCount} users
                </span>
              </div>
            </div>

            <button
              onClick={() => editRole(role)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100"
            >
              View Permissions
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Create/Edit Role Modal */}
      {(showCreateModal || selectedRole) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => { setShowCreateModal(false); setSelectedRole(null); setRoleForm({ name: '', description: '', permissions: [] }); }} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedRole ? `Edit Role: ${selectedRole.name}` : 'Create New Role'}
                </h3>
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedRole(null); setRoleForm({ name: '', description: '', permissions: [] }); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Role Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      placeholder="e.g., Property Manager"
                      disabled={selectedRole?.isSystem}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      placeholder="Brief description of this role"
                      disabled={selectedRole?.isSystem}
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Permissions</h4>
                    <span className="text-sm text-gray-500">{roleForm.permissions.length} selected</span>
                  </div>

                  {selectedRole?.isSystem && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm text-amber-800">System roles cannot be modified</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {permissionCategories.map((category) => {
                      const Icon = category.icon;
                      const categoryPermissionIds = category.permissions.map(p => p.id);
                      const selectedCount = categoryPermissionIds.filter(id => roleForm.permissions.includes(id)).length;
                      const allSelected = selectedCount === categoryPermissionIds.length;
                      const someSelected = selectedCount > 0 && !allSelected;

                      return (
                        <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => !selectedRole?.isSystem && toggleCategoryPermissions(category.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-white rounded border border-gray-200">
                                <Icon className="h-4 w-4 text-gray-600" />
                              </div>
                              <span className="font-medium text-gray-900">{category.name}</span>
                              <span className="text-xs text-gray-500">({selectedCount}/{category.permissions.length})</span>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              allSelected ? 'bg-violet-600 border-violet-600' : someSelected ? 'border-violet-600' : 'border-gray-300'
                            } ${selectedRole?.isSystem ? 'opacity-50' : ''}`}>
                              {allSelected && <CheckCircle className="h-3 w-3 text-white" />}
                              {someSelected && <div className="w-2 h-2 bg-violet-600 rounded-sm" />}
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            {category.permissions.map((permission) => (
                              <label
                                key={permission.id}
                                className={`flex items-center justify-between p-2 rounded hover:bg-gray-50 ${selectedRole?.isSystem ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div>
                                  <span className="text-sm font-medium text-gray-700">{permission.name}</span>
                                  <p className="text-xs text-gray-500">{permission.description}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.includes(permission.id)}
                                  onChange={() => togglePermission(permission.id)}
                                  disabled={selectedRole?.isSystem}
                                  className="h-4 w-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedRole(null); setRoleForm({ name: '', description: '', permissions: [] }); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                {!selectedRole?.isSystem && (
                  <button
                    onClick={selectedRole ? handleUpdateRole : handleCreateRole}
                    disabled={saving || !roleForm.name || roleForm.permissions.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {selectedRole ? 'Save Changes' : 'Create Role'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Audit Log Modal */}
      {showPermissionAudit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPermissionAudit(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Permission Change Audit Log</h3>
                <button onClick={() => setShowPermissionAudit(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {auditLog.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.action}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{entry.actor}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{entry.target}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.changes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
