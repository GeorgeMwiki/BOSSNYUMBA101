import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
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


function buildPermissionCategories(t: (key: string) => string) {
  return [
    {
      id: 'properties',
      name: t('categories.properties.name'),
      icon: Building2,
      permissions: [
        { id: 'properties.view', name: t('categories.properties.perms.view'), description: t('categories.properties.descs.view') },
        { id: 'properties.create', name: t('categories.properties.perms.create'), description: t('categories.properties.descs.create') },
        { id: 'properties.edit', name: t('categories.properties.perms.edit'), description: t('categories.properties.descs.edit') },
        { id: 'properties.delete', name: t('categories.properties.perms.delete'), description: t('categories.properties.descs.delete') },
      ],
    },
    {
      id: 'units',
      name: t('categories.units.name'),
      icon: Building2,
      permissions: [
        { id: 'units.view', name: t('categories.units.perms.view'), description: t('categories.units.descs.view') },
        { id: 'units.create', name: t('categories.units.perms.create'), description: t('categories.units.descs.create') },
        { id: 'units.edit', name: t('categories.units.perms.edit'), description: t('categories.units.descs.edit') },
        { id: 'units.delete', name: t('categories.units.perms.delete'), description: t('categories.units.descs.delete') },
      ],
    },
    {
      id: 'tenants',
      name: t('categories.tenants.name'),
      icon: Users,
      permissions: [
        { id: 'tenants.view', name: t('categories.tenants.perms.view'), description: t('categories.tenants.descs.view') },
        { id: 'tenants.create', name: t('categories.tenants.perms.create'), description: t('categories.tenants.descs.create') },
        { id: 'tenants.edit', name: t('categories.tenants.perms.edit'), description: t('categories.tenants.descs.edit') },
        { id: 'tenants.suspend', name: t('categories.tenants.perms.suspend'), description: t('categories.tenants.descs.suspend') },
        { id: 'tenants.delete', name: t('categories.tenants.perms.delete'), description: t('categories.tenants.descs.delete') },
      ],
    },
    {
      id: 'users',
      name: t('categories.users.name'),
      icon: Users,
      permissions: [
        { id: 'users.view', name: t('categories.users.perms.view'), description: t('categories.users.descs.view') },
        { id: 'users.create', name: t('categories.users.perms.create'), description: t('categories.users.descs.create') },
        { id: 'users.edit', name: t('categories.users.perms.edit'), description: t('categories.users.descs.edit') },
        { id: 'users.delete', name: t('categories.users.perms.delete'), description: t('categories.users.descs.delete') },
        { id: 'users.impersonate', name: t('categories.users.perms.impersonate'), description: t('categories.users.descs.impersonate') },
      ],
    },
    {
      id: 'finance',
      name: t('categories.finance.name'),
      icon: DollarSign,
      permissions: [
        { id: 'finance.view', name: t('categories.finance.perms.view'), description: t('categories.finance.descs.view') },
        { id: 'finance.invoices', name: t('categories.finance.perms.invoices'), description: t('categories.finance.descs.invoices') },
        { id: 'finance.payments', name: t('categories.finance.perms.payments'), description: t('categories.finance.descs.payments') },
        { id: 'finance.disbursements', name: t('categories.finance.perms.disbursements'), description: t('categories.finance.descs.disbursements') },
        { id: 'finance.adjustments', name: t('categories.finance.perms.adjustments'), description: t('categories.finance.descs.adjustments') },
      ],
    },
    {
      id: 'maintenance',
      name: t('categories.maintenance.name'),
      icon: Wrench,
      permissions: [
        { id: 'maintenance.view', name: t('categories.maintenance.perms.view'), description: t('categories.maintenance.descs.view') },
        { id: 'maintenance.create', name: t('categories.maintenance.perms.create'), description: t('categories.maintenance.descs.create') },
        { id: 'maintenance.assign', name: t('categories.maintenance.perms.assign'), description: t('categories.maintenance.descs.assign') },
        { id: 'maintenance.approve', name: t('categories.maintenance.perms.approve'), description: t('categories.maintenance.descs.approve') },
        { id: 'maintenance.complete', name: t('categories.maintenance.perms.complete'), description: t('categories.maintenance.descs.complete') },
      ],
    },
    {
      id: 'documents',
      name: t('categories.documents.name'),
      icon: FileText,
      permissions: [
        { id: 'documents.view', name: t('categories.documents.perms.view'), description: t('categories.documents.descs.view') },
        { id: 'documents.upload', name: t('categories.documents.perms.upload'), description: t('categories.documents.descs.upload') },
        { id: 'documents.delete', name: t('categories.documents.perms.delete'), description: t('categories.documents.descs.delete') },
        { id: 'documents.sign', name: t('categories.documents.perms.sign'), description: t('categories.documents.descs.sign') },
      ],
    },
    {
      id: 'settings',
      name: t('categories.settings.name'),
      icon: Settings,
      permissions: [
        { id: 'settings.view', name: t('categories.settings.perms.view'), description: t('categories.settings.descs.view') },
        { id: 'settings.edit', name: t('categories.settings.perms.edit'), description: t('categories.settings.descs.edit') },
        { id: 'settings.roles', name: t('categories.settings.perms.roles'), description: t('categories.settings.descs.roles') },
        { id: 'settings.audit', name: t('categories.settings.perms.audit'), description: t('categories.settings.descs.audit') },
      ],
    },
  ];
}

export function RolesPage() {
  const t = useTranslations('rolesPage');
  const permissionCategories = buildPermissionCategories(t);
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
    // createdBy is filled in by the backend from the authenticated principal
    // when the role actually persists; the optimistic row carries an empty
    // string rather than a hardcoded admin email.
    const newRole: Role = {
      id: String(displayRoles.length + 1),
      name: roleForm.name,
      description: roleForm.description,
      permissions: roleForm.permissions,
      userCount: 0,
      isSystem: false,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: '',
    };
    setLocalRoles([...displayRoles, newRole]);
    setSaving(false);
    setShowCreateModal(false);
    setRoleForm({ name: '', description: '', permissions: [] });
    toast.success(t('toasts.created'));
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
    toast.success(t('toasts.updated'));
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      toast.error(t('toasts.cannotDeleteSystem'));
      return;
    }
    if (role.userCount > 0) {
      toast.error(t('toasts.cannotDeleteAssigned'));
      return;
    }
    setLocalRoles(displayRoles.filter(r => r.id !== role.id));
    toast.success(t('toasts.deleted'));
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
      name: t('duplicateName', { name: role.name }),
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
          {queryError instanceof Error ? queryError.message : t('errors.loadFailed')}
          <Button size="sm" onClick={() => rolesQuery.refetch()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/roles/permissions"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Grid3X3 className="h-4 w-4" />
            {t('nav.permissionMatrix')}
          </Link>
          <Link
            to="/roles/approvals"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <GitBranch className="h-4 w-4" />
            {t('nav.approvalMatrix')}
          </Link>
          <button
            onClick={() => setShowPermissionAudit(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" />
            {t('nav.auditLog')}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            {t('nav.createRole')}
          </button>
        </div>
      </div>

      {/* Notifications are shown via the design-system toast (Toaster mounted at app root). */}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
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
                    <span className="text-xs text-violet-600 font-medium">{t('systemRole')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicateRole(role)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title={t('actions.duplicate')}
                >
                  <Copy className="h-4 w-4" />
                </button>
                {!role.isSystem && (
                  <>
                    <button
                      onClick={() => editRole(role)}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                      title={t('actions.edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title={t('actions.delete')}
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
                  {t('permissionsCount', { count: role.permissions.length })}
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                  <Users className="h-4 w-4" />
                  {t('usersCount', { count: role.userCount })}
                </span>
              </div>
            </div>

            <button
              onClick={() => editRole(role)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100"
            >
              {t('viewPermissions')}
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
                  {selectedRole ? t('modal.editTitle', { name: selectedRole.name }) : t('modal.createTitle')}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.roleName')}</label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      placeholder={t('form.roleNamePlaceholder')}
                      disabled={selectedRole?.isSystem}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.description')}</label>
                    <input
                      type="text"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      placeholder={t('form.descriptionPlaceholder')}
                      disabled={selectedRole?.isSystem}
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">{t('form.permissions')}</h4>
                    <span className="text-sm text-gray-500">{t('form.selectedCount', { count: roleForm.permissions.length })}</span>
                  </div>

                  {selectedRole?.isSystem && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm text-amber-800">{t('form.systemReadOnly')}</span>
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
                  {t('modal.cancel')}
                </button>
                {!selectedRole?.isSystem && (
                  <button
                    onClick={selectedRole ? handleUpdateRole : handleCreateRole}
                    disabled={saving || !roleForm.name || roleForm.permissions.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {selectedRole ? t('modal.saveChanges') : t('modal.createRole')}
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
                <h3 className="text-lg font-semibold text-gray-900">{t('audit.title')}</h3>
                <button onClick={() => setShowPermissionAudit(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.time')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.action')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.actor')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.target')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.changes')}</th>
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
