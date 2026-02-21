import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  CheckCircle,
  X,
  Save,
  ArrowLeft,
  AlertTriangle,
  Search,
  Download,
  Building2,
  Users,
  DollarSign,
  Wrench,
  FileText,
  Settings,
  Lock,
} from 'lucide-react';

// ─── Data ──────────────────────────────────────────────────

interface PermissionModule {
  id: string;
  name: string;
  icon: React.ElementType;
  permissions: { id: string; name: string; short: string }[];
}

const modules: PermissionModule[] = [
  { id: 'properties', name: 'Properties', icon: Building2, permissions: [
    { id: 'properties.view', name: 'View Properties', short: 'View' },
    { id: 'properties.create', name: 'Create Properties', short: 'Create' },
    { id: 'properties.edit', name: 'Edit Properties', short: 'Edit' },
    { id: 'properties.delete', name: 'Delete Properties', short: 'Delete' },
  ]},
  { id: 'units', name: 'Units', icon: Building2, permissions: [
    { id: 'units.view', name: 'View Units', short: 'View' },
    { id: 'units.create', name: 'Create Units', short: 'Create' },
    { id: 'units.edit', name: 'Edit Units', short: 'Edit' },
    { id: 'units.delete', name: 'Delete Units', short: 'Delete' },
  ]},
  { id: 'tenants', name: 'Tenants', icon: Users, permissions: [
    { id: 'tenants.view', name: 'View Tenants', short: 'View' },
    { id: 'tenants.create', name: 'Create Tenants', short: 'Create' },
    { id: 'tenants.edit', name: 'Edit Tenants', short: 'Edit' },
    { id: 'tenants.suspend', name: 'Suspend/Activate', short: 'Suspend' },
    { id: 'tenants.delete', name: 'Delete Tenants', short: 'Delete' },
  ]},
  { id: 'users', name: 'Users', icon: Users, permissions: [
    { id: 'users.view', name: 'View Users', short: 'View' },
    { id: 'users.create', name: 'Create Users', short: 'Create' },
    { id: 'users.edit', name: 'Edit Users', short: 'Edit' },
    { id: 'users.delete', name: 'Delete Users', short: 'Delete' },
    { id: 'users.impersonate', name: 'Impersonate', short: 'Impersonate' },
  ]},
  { id: 'finance', name: 'Finance', icon: DollarSign, permissions: [
    { id: 'finance.view', name: 'View Financials', short: 'View' },
    { id: 'finance.invoices', name: 'Manage Invoices', short: 'Invoices' },
    { id: 'finance.payments', name: 'Process Payments', short: 'Payments' },
    { id: 'finance.disbursements', name: 'Disbursements', short: 'Disburse' },
    { id: 'finance.adjustments', name: 'Apply Adjustments', short: 'Adjust' },
  ]},
  { id: 'maintenance', name: 'Maintenance', icon: Wrench, permissions: [
    { id: 'maintenance.view', name: 'View Work Orders', short: 'View' },
    { id: 'maintenance.create', name: 'Create Work Orders', short: 'Create' },
    { id: 'maintenance.assign', name: 'Assign Work', short: 'Assign' },
    { id: 'maintenance.approve', name: 'Approve Work', short: 'Approve' },
    { id: 'maintenance.complete', name: 'Complete Work', short: 'Complete' },
  ]},
  { id: 'documents', name: 'Documents', icon: FileText, permissions: [
    { id: 'documents.view', name: 'View Docs', short: 'View' },
    { id: 'documents.upload', name: 'Upload Docs', short: 'Upload' },
    { id: 'documents.delete', name: 'Delete Docs', short: 'Delete' },
    { id: 'documents.sign', name: 'E-Sign', short: 'Sign' },
  ]},
  { id: 'settings', name: 'Settings', icon: Settings, permissions: [
    { id: 'settings.view', name: 'View Settings', short: 'View' },
    { id: 'settings.edit', name: 'Edit Settings', short: 'Edit' },
    { id: 'settings.roles', name: 'Manage Roles', short: 'Roles' },
    { id: 'settings.audit', name: 'View Audit Logs', short: 'Audit' },
  ]},
];

interface RoleData {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Set<string>;
  color: string;
}

const initialRoles: RoleData[] = [
  { id: '1', name: 'Super Admin', isSystem: true, permissions: new Set(modules.flatMap((m) => m.permissions.map((p) => p.id))), color: 'bg-violet-600' },
  { id: '2', name: 'Support Agent', isSystem: true, permissions: new Set(['tenants.view', 'users.view', 'users.impersonate', 'finance.view', 'maintenance.view', 'documents.view', 'settings.audit']), color: 'bg-blue-600' },
  { id: '3', name: 'Finance Manager', isSystem: false, permissions: new Set(['tenants.view', 'users.view', 'finance.view', 'finance.invoices', 'finance.payments', 'finance.disbursements', 'finance.adjustments']), color: 'bg-green-600' },
  { id: '4', name: 'Operations Lead', isSystem: false, permissions: new Set(['tenants.view', 'users.view', 'maintenance.view', 'maintenance.create', 'maintenance.assign', 'maintenance.approve', 'maintenance.complete', 'documents.view', 'documents.upload']), color: 'bg-amber-600' },
  { id: '5', name: 'Read Only', isSystem: false, permissions: new Set(['properties.view', 'units.view', 'tenants.view', 'users.view', 'finance.view', 'maintenance.view', 'documents.view', 'settings.view']), color: 'bg-gray-600' },
];

// ─── Component ─────────────────────────────────────────────

export default function PermissionMatrix() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleData[]>(initialRoles);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const allPermissions = useMemo(() => modules.flatMap((m) => m.permissions.map((p) => p.id)), []);

  const filteredModules = useMemo(() => {
    if (!search) return modules;
    const q = search.toLowerCase();
    return modules.filter(
      (m) => m.name.toLowerCase().includes(q) || m.permissions.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [search]);

  const togglePermission = (roleId: string, permissionId: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId || r.isSystem) return r;
        const newPerms = new Set(r.permissions);
        if (newPerms.has(permissionId)) newPerms.delete(permissionId);
        else newPerms.add(permissionId);
        return { ...r, permissions: newPerms };
      })
    );
    setHasChanges(true);
  };

  const toggleModuleForRole = (roleId: string, moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const modPermIds = mod.permissions.map((p) => p.id);

    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId || r.isSystem) return r;
        const allSelected = modPermIds.every((pid) => r.permissions.has(pid));
        const newPerms = new Set(r.permissions);
        if (allSelected) {
          modPermIds.forEach((pid) => newPerms.delete(pid));
        } else {
          modPermIds.forEach((pid) => newPerms.add(pid));
        }
        return { ...r, permissions: newPerms };
      })
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSaving(false);
    setHasChanges(false);
    setNotification({ type: 'success', message: 'Permission matrix saved successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/roles')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permission Matrix</h1>
            <p className="text-sm text-gray-500 mt-1">Visual editor for role-permission assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const csvRows = ['Role,Module,Permission,Granted'];
              roles.forEach((role) => {
                modules.forEach((mod) => {
                  mod.permissions.forEach((perm) => {
                    csvRows.push(`${role.name},${mod.name},${perm.name},${role.permissions.includes(perm.id)}`);
                  });
                });
              });
              const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'permission-matrix.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
          >
            {saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
            <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800">You have unsaved changes</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search modules or permissions..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center"><CheckCircle className="h-3.5 w-3.5 text-white" /></div>
          <span>Granted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-100 border border-gray-300 rounded" />
          <span>Not granted</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" />
          <span>System role (read-only)</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                Module / Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`inline-block w-3 h-3 rounded-full ${role.color}`} />
                    <span className="text-gray-700">{role.name}</span>
                    {role.isSystem && <Lock className="h-3 w-3 text-gray-400" />}
                    <span className="text-gray-400 font-normal normal-case">{role.permissions.size} perms</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <React.Fragment key={mod.id}>
                  {/* Module header row */}
                  <tr className="bg-gray-50/50 border-t border-gray-200">
                    <td className="px-4 py-2.5 sticky left-0 bg-gray-50/50 z-10">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold text-gray-900 text-sm">{mod.name}</span>
                      </div>
                    </td>
                    {roles.map((role) => {
                      const modPermIds = mod.permissions.map((p) => p.id);
                      const count = modPermIds.filter((pid) => role.permissions.has(pid)).length;
                      const allSelected = count === modPermIds.length;
                      const someSelected = count > 0 && !allSelected;

                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => toggleModuleForRole(role.id, mod.id)}
                            disabled={role.isSystem}
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              allSelected ? 'bg-violet-600 border-violet-600' :
                              someSelected ? 'bg-white border-violet-600' :
                              'bg-white border-gray-300'
                            } ${role.isSystem ? 'opacity-60 cursor-not-allowed' : 'hover:border-violet-400 cursor-pointer'}`}
                          >
                            {allSelected && <CheckCircle className="h-4 w-4 text-white" />}
                            {someSelected && <div className="w-2.5 h-2.5 bg-violet-600 rounded-sm" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Individual permission rows */}
                  {mod.permissions.map((perm) => (
                    <tr key={perm.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-2 pl-11 sticky left-0 bg-white z-10 hover:bg-gray-50/50">
                        <span className="text-sm text-gray-600">{perm.name}</span>
                      </td>
                      {roles.map((role) => (
                        <td key={role.id} className="px-3 py-2 text-center">
                          <button
                            onClick={() => togglePermission(role.id, perm.id)}
                            disabled={role.isSystem}
                            className={`w-6 h-6 rounded transition-colors inline-flex items-center justify-center ${
                              role.permissions.has(perm.id)
                                ? 'bg-violet-600 text-white'
                                : 'bg-gray-100 border border-gray-300 text-transparent'
                            } ${role.isSystem ? 'opacity-60 cursor-not-allowed' : 'hover:ring-2 hover:ring-violet-300 cursor-pointer'}`}
                          >
                            {role.permissions.has(perm.id) && <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
