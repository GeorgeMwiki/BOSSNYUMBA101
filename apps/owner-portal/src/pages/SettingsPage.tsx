import React, { useEffect, useState } from 'react';
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
import { useTranslations } from 'next-intl';
import { useAuth } from '../contexts/AuthContext';
import { api, formatDate } from '../lib/api';

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
  const t = useTranslations('settingsPage');
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [showInviteModal, setShowInviteModal] = useState(false);
  // Live data only — co-owners load from the API. The signed-in owner
  // is seeded into the local list from the auth context (no fake fallback).
  const [coOwners, setCoOwners] = useState<CoOwner[]>(() =>
    user
      ? [
          {
            id: String(user.id ?? 'self'),
            email: user.email ?? '',
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            role: 'OWNER',
            status: 'ACTIVE',
            lastLogin: new Date().toISOString(),
            properties: [],
          },
        ]
      : []
  );

  useEffect(() => {
    let cancelled = false;
    api.get<CoOwner[]>('/owner/co-owners').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setCoOwners(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    { id: 'profile', label: t('tabProfile'), icon: User },
    { id: 'notifications', label: t('tabNotifications'), icon: Bell },
    { id: 'security', label: t('tabSecurity'), icon: Shield },
    { id: 'users', label: t('tabUsers'), icon: Users },
    { id: 'preferences', label: t('tabPreferences'), icon: Globe },
  ];

  const properties = ['Palm Gardens', 'Ocean View Apartments', 'Sunset Villas', 'Garden Estate'];

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setNotification({ type: 'success', message: t('savedSuccess') });
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
    setNotification({ type: 'success', message: t('invitationSent') });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRemoveUser = (id: string) => {
    setCoOwners(coOwners.filter(u => u.id !== id));
    setNotification({ type: 'success', message: t('userRemoved') });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResendInvite = (id: string) => {
    setNotification({ type: 'success', message: t('invitationResent') });
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
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
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
                    {t('changePhoto')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                  <input type="text" defaultValue={user?.firstName} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                  <input type="text" defaultValue={user?.lastName} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                <input type="email" defaultValue={user?.email} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneNumber')}</label>
                <input
                  type="tel"
                  defaultValue={(user as { phone?: string } | null)?.phone ?? ''}
                  placeholder={t('phonePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('organization')}</label>
                <input type="text" defaultValue={tenant?.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
              </div>

              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? t('savingLoading') : t('saveChanges')}
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-xl">
              <p className="text-sm text-gray-500">{t('notifDesc')}</p>

              <div className="space-y-4">
                {[
                  { id: 'payment', label: t('notifPayment'), desc: t('notifPaymentDesc'), default: true },
                  { id: 'maintenance', label: t('notifMaintenance'), desc: t('notifMaintenanceDesc'), default: true },
                  { id: 'approval', label: t('notifApproval'), desc: t('notifApprovalDesc'), default: true },
                  { id: 'overdue', label: t('notifOverdue'), desc: t('notifOverdueDesc'), default: true },
                  { id: 'weekly', label: t('notifWeekly'), desc: t('notifWeeklyDesc'), default: false },
                  { id: 'monthly', label: t('notifMonthly'), desc: t('notifMonthlyDesc'), default: true },
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
                {saving ? t('savingLoading') : t('savePreferences')}
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">{t('changePassword')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('currentPassword')}</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword')}</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('confirmNewPassword')}</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                    {t('updatePassword')}
                  </button>
                </div>
              </div>

              <hr />

              <div>
                <h3 className="font-medium text-gray-900 mb-4">{t('twoFactor')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('twoFactorDesc')}</p>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                  <Key className="h-4 w-4" />
                  {t('enable2fa')}
                </button>
              </div>

              <hr />

              <div>
                <h3 className="font-medium text-gray-900 mb-4">{t('activeSessions')}</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{t('currentSession')}</p>
                      <p className="text-sm text-gray-500">{t('sessionLocation')}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">{t('activeBadge')}</span>
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
                  <h3 className="font-medium text-gray-900">{t('teamMembers')}</h3>
                  <p className="text-sm text-gray-500">{t('teamMembersDesc')}</p>
                </div>
                <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  {t('inviteUser')}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colUser')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colRole')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperties')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colLastActive')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('colActions')}</th>
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
                            {member.properties.length > 1 ? t('propertiesCount', { count: member.properties.length }) : member.properties[0]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(member.status)}
                            <span className="text-sm text-gray-600">{member.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {member.lastLogin ? formatDate(member.lastLogin) : t('never')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {member.status === 'PENDING' && (
                              <button onClick={() => handleResendInvite(member.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title={t('resendInvite')}>
                                <Mail className="h-4 w-4" />
                              </button>
                            )}
                            {member.role !== 'OWNER' && (
                              <>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title={t('editBtn')}>
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleRemoveUser(member.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title={t('removeBtn')}>
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
                  <h4 className="font-medium text-purple-800 mb-2">{t('roleOwner')}</h4>
                  <p className="text-sm text-purple-600">{t('roleOwnerDesc')}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">{t('roleCoOwner')}</h4>
                  <p className="text-sm text-blue-600">{t('roleCoOwnerDesc')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2">{t('roleViewer')}</h4>
                  <p className="text-sm text-gray-600">{t('roleViewerDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="en">{t('langEnglish')}</option>
                  <option value="sw">{t('langSwahili')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('timezone')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Africa/Dar_es_Salaam">{t('tzEat')}</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="TZS">{t('currencyTzs')}</option>
                  <option value="USD">{t('currencyUsd')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dateFormat')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? t('savingLoading') : t('savePreferences')}
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
                <h3 className="text-lg font-semibold text-gray-900">{t('inviteUser')}</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                    <input type="text" value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                    <input type="text" value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                  <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('colRole')}</label>
                  <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="VIEWER">{t('roleViewer')}</option>
                    <option value="CO_OWNER">{t('roleCoOwner')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('propertyAccess')}</label>
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
                  {t('cancel')}
                </button>
                <button onClick={handleInviteUser} disabled={!inviteForm.email || !inviteForm.firstName || inviteForm.properties.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Mail className="h-4 w-4" />
                  {t('sendInvitation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
