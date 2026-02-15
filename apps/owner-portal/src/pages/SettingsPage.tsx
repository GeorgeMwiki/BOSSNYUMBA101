import React, { useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Globe,
  Save,
  Users,
  Plus,
  Mail,
  Phone,
  MoreVertical,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Building2,
  Key,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/api';

interface CoOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'OWNER' | 'CO_OWNER' | 'VIEWER';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  invitedAt?: string;
  lastLogin?: string;
  properties: string[];
}

export function SettingsPage() {
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [coOwners, setCoOwners] = useState<CoOwner[]>([
    {
      id: '1',
      email: user?.email || 'owner@example.com',
      firstName: user?.firstName || 'John',
      lastName: user?.lastName || 'Doe',
      phone: '+255712345678',
      role: 'OWNER',
      status: 'ACTIVE',
      lastLogin: new Date().toISOString(),
      properties: ['Palm Gardens', 'Ocean View Apartments'],
    },
    {
      id: '2',
      email: 'sarah.coowner@example.com',
      firstName: 'Sarah',
      lastName: 'Wilson',
      phone: '+255723456789',
      role: 'CO_OWNER',
      status: 'ACTIVE',
      invitedAt: '2026-01-15T10:00:00Z',
      lastLogin: '2026-02-10T14:30:00Z',
      properties: ['Palm Gardens'],
    },
    {
      id: '3',
      email: 'david.viewer@example.com',
      firstName: 'David',
      lastName: 'Brown',
      role: 'VIEWER',
      status: 'PENDING',
      invitedAt: '2026-02-08T09:00:00Z',
      properties: ['Ocean View Apartments'],
    },
  ]);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'VIEWER' as 'CO_OWNER' | 'VIEWER',
    properties: [] as string[],
  });

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ];

  const properties = ['Palm Gardens', 'Ocean View Apartments', 'Sunset Villas', 'Garden Estate'];

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setNotification({ type: 'success', message: 'Settings saved successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInviteUser = () => {
    const newUser: CoOwner = {
      id: Date.now().toString(),
      ...inviteForm,
      status: 'PENDING',
      invitedAt: new Date().toISOString(),
    };
    setCoOwners([...coOwners, newUser]);
    setShowInviteModal(false);
    setInviteForm({ email: '', firstName: '', lastName: '', role: 'VIEWER', properties: [] });
    setNotification({ type: 'success', message: 'Invitation sent successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRemoveUser = (id: string) => {
    setCoOwners(coOwners.filter(u => u.id !== id));
    setNotification({ type: 'success', message: 'User removed successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResendInvite = (id: string) => {
    setNotification({ type: 'success', message: 'Invitation resent successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-700';
      case 'CO_OWNER': return 'bg-blue-100 text-blue-700';
      case 'VIEWER': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'SUSPENDED': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {notification.message}
            </span>
          </div>
          <button onClick={() => setNotification(null)}>
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-xl">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                    Change Photo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" defaultValue={user?.firstName} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" defaultValue={user?.lastName} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" defaultValue={user?.email} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" defaultValue="+255712345678" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input type="text" defaultValue={tenant?.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
              </div>

              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-xl">
              <p className="text-sm text-gray-500">Choose how you want to be notified about activity on your properties.</p>

              <div className="space-y-4">
                {[
                  { id: 'payment', label: 'Payment Received', desc: 'Get notified when a tenant makes a payment', default: true },
                  { id: 'maintenance', label: 'Maintenance Request', desc: 'Get notified when a new maintenance request is submitted', default: true },
                  { id: 'approval', label: 'Approval Required', desc: 'Get notified when something needs your approval', default: true },
                  { id: 'overdue', label: 'Overdue Payments', desc: 'Get notified when payments become overdue', default: true },
                  { id: 'weekly', label: 'Weekly Summary', desc: 'Receive a weekly summary of property activity', default: false },
                  { id: 'monthly', label: 'Monthly Report', desc: 'Receive monthly financial reports', default: true },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                    Update Password
                  </button>
                </div>
              </div>

              <hr />

              <div>
                <h3 className="font-medium text-gray-900 mb-4">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-500 mb-4">Add an extra layer of security to your account.</p>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                  <Key className="h-4 w-4" />
                  Enable 2FA
                </button>
              </div>

              <hr />

              <div>
                <h3 className="font-medium text-gray-900 mb-4">Active Sessions</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Current Session</p>
                      <p className="text-sm text-gray-500">Chrome on macOS - Dar es Salaam, Tanzania</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Team Members</h3>
                  <p className="text-sm text-gray-500">Manage co-owners and viewers for your properties</p>
                </div>
                <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Invite User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Properties</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Active</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {coOwners.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                              {member.firstName[0]}{member.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.firstName} {member.lastName}</p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                            {member.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {member.properties.length > 1 ? `${member.properties.length} properties` : member.properties[0]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(member.status)}
                            <span className="text-sm text-gray-600">{member.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {member.lastLogin ? formatDate(member.lastLogin) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {member.status === 'PENDING' && (
                              <button onClick={() => handleResendInvite(member.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Resend Invite">
                                <Mail className="h-4 w-4" />
                              </button>
                            )}
                            {member.role !== 'OWNER' && (
                              <>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Edit">
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleRemoveUser(member.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Role Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <h4 className="font-medium text-purple-800 mb-2">Owner</h4>
                  <p className="text-sm text-purple-600">Full access to all properties and settings. Can invite and manage users.</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">Co-Owner</h4>
                  <p className="text-sm text-blue-600">Can view and manage assigned properties. Can approve work orders and access financial data.</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2">Viewer</h4>
                  <p className="text-sm text-gray-600">Read-only access to assigned properties. Can view reports and documents.</p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Africa/Dar_es_Salaam">East Africa Time (EAT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="TZS">Tanzanian Shilling (TZS)</option>
                  <option value="USD">US Dollar (USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowInviteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Invite User</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="VIEWER">Viewer</option>
                    <option value="CO_OWNER">Co-Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Access</label>
                  <div className="space-y-2 mt-2">
                    {properties.map((property) => (
                      <label key={property} className="flex items-center gap-2">
                        <input type="checkbox" checked={inviteForm.properties.includes(property)} onChange={(e) => {
                          if (e.target.checked) {
                            setInviteForm({ ...inviteForm, properties: [...inviteForm.properties, property] });
                          } else {
                            setInviteForm({ ...inviteForm, properties: inviteForm.properties.filter(p => p !== property) });
                          }
                        }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">{property}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t">
                <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
                  Cancel
                </button>
                <button onClick={handleInviteUser} disabled={!inviteForm.email || !inviteForm.firstName || inviteForm.properties.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Mail className="h-4 w-4" />
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
