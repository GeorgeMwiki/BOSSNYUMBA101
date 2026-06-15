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
import { useProperties } from '../lib/hooks';
import { QrCode } from '../components/QrCode';

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
    // Real source of truth: accepted members (users) + pending invites.
    api.get<CoOwner[]>('/owner/account/co-owners').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setCoOwners(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Profile (persisted via POST /owner/account/profile) ──────────────────
  // Controlled inputs hydrated from the auth context. No more uncontrolled
  // defaultValue inputs whose edits the Save button silently discarded.
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: (user as { phone?: string } | null)?.phone ?? '',
  });

  // Re-hydrate if the auth context resolves after first paint.
  useEffect(() => {
    if (!user) return;
    setProfileForm((prev) => ({
      firstName: prev.firstName || user.firstName || '',
      lastName: prev.lastName || user.lastName || '',
      email: prev.email || user.email || '',
      phone: prev.phone || (user as { phone?: string }).phone || '',
    }));
  }, [user]);

  // Real portfolio for the invite modal's Property Access list. Replaces the
  // former hardcoded fictional array; options are keyed by real property id.
  const { data: portfolio, isLoading: portfolioLoading } = useProperties();

  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'VIEWER' as 'CO_OWNER' | 'VIEWER',
    properties: [] as string[],
  });

  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Preferences (persisted via /owner/account/settings) ──────────────────
  // Controlled state, hydrated from the API. No more fake-success Save.
  const [prefs, setPrefs] = useState({
    language: 'en' as 'en' | 'sw',
    currency: 'USD',
    timezone: 'Africa/Dar_es_Salaam',
    dateFormat: 'DD/MM/YYYY',
  });
  // Notification toggles keyed by the six FE ids. Defaults applied; API overrides.
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    payment: true,
    maintenance: true,
    approval: true,
    overdue: true,
    weekly: false,
    monthly: true,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get<{
        language?: 'en' | 'sw';
        currency?: string;
        timezone?: string;
        dateFormat?: string;
        notificationPrefs?: Record<string, boolean>;
      }>('/owner/account/settings')
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const d = res.data;
        setPrefs({
          language: d.language ?? 'en',
          currency: d.currency ?? 'USD',
          timezone: d.timezone ?? 'Africa/Dar_es_Salaam',
          dateFormat: d.dateFormat ?? 'DD/MM/YYYY',
        });
        if (d.notificationPrefs && Object.keys(d.notificationPrefs).length > 0) {
          setNotificationPrefs((prev) => ({ ...prev, ...d.notificationPrefs }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Security (2FA capability + password change) ──────────────────────────
  const [twoFa, setTwoFa] = useState<{ available: boolean; enrolled: boolean }>({
    available: false,
    enrolled: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // 2FA enrollment, surfaced INLINE (no more dispatch into a listener-less
  // window event). enroll → render otpauth QR + manual key → 6-digit confirm.
  const [mfaEnroll, setMfaEnroll] = useState<{
    secret: string;
    otpauth: string;
    recoveryCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ available: boolean; enrolled: boolean }>('/owner/account/security/2fa')
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        setTwoFa({ available: res.data.available, enrolled: res.data.enrolled });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flashError = (message: string) => {
    setNotification({ type: 'error', message });
    setTimeout(() => setNotification(null), 4000);
  };
  const flashSuccess = (message: string) => {
    setNotification({ type: 'success', message });
    setTimeout(() => setNotification(null), 3000);
  };

  const tabs = [
    { id: 'profile', label: t('tabProfile'), icon: User },
    { id: 'notifications', label: t('tabNotifications'), icon: Bell },
    { id: 'security', label: t('tabSecurity'), icon: Shield },
    { id: 'users', label: t('tabUsers'), icon: Users },
    { id: 'preferences', label: t('tabPreferences'), icon: Globe },
  ];

  // Real persistence — POST /owner/account/settings upserts the prefs row AND
  // mirrors the currency into the canonical currency_preferences chain.
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/owner/account/settings', {
        language: prefs.language,
        currency: prefs.currency,
        timezone: prefs.timezone,
        dateFormat: prefs.dateFormat,
        notificationPrefs,
      });
      if (res.success) {
        flashSuccess(t('savedSuccess'));
      } else {
        flashError(res.error?.message ?? t('savedFailed'));
      }
    } catch {
      flashError(t('savedFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Real profile save — POST /owner/account/profile updates the caller's own
  // users row (first/last name, email, phone), tenant_id + user_id scoped. The
  // four inputs are controlled, so what the owner typed is exactly what posts.
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.post('/owner/account/profile', {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
        phone: profileForm.phone,
      });
      if (res.success) {
        flashSuccess(t('profileSaved'));
      } else {
        flashError(res.error?.message ?? t('profileSaveFailed'));
      }
    } catch {
      flashError(t('profileSaveFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Real invite — POST /owner/account/co-owners/invite persists a pending
  // invite AND enqueues a real email via the notifications engine.
  const handleInviteUser = async () => {
    setInviting(true);
    try {
      const res = await api.post<CoOwner>('/owner/account/co-owners/invite', {
        email: inviteForm.email,
        firstName: inviteForm.firstName,
        lastName: inviteForm.lastName,
        role: inviteForm.role,
        properties: inviteForm.properties,
      });
      if (res.success && res.data) {
        // Send ids on the wire; show human-readable names in the optimistic row.
        const grantedNames = (portfolio ?? [])
          .filter((p) => inviteForm.properties.includes(p.id))
          .map((p) => p.name);
        setCoOwners((prev) => [...prev, { ...res.data!, properties: grantedNames }]);
        setShowInviteModal(false);
        setInviteForm({ email: '', firstName: '', lastName: '', role: 'VIEWER', properties: [] });
        flashSuccess(t('invitationSent'));
      } else {
        flashError(res.error?.message ?? 'Failed to send invitation');
      }
    } catch {
      flashError('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Real revoke — DELETE /owner/account/co-owners/:id. The backend only revokes
  // PENDING invites, so the Remove control is gated to status === 'PENDING' in
  // the table (matching the resend gate). On failure we surface a GENUINE error
  // string — never the success copy — so a 404/500/network error reads true.
  const handleRemoveUser = async (id: string) => {
    const previous = coOwners;
    setCoOwners((prev) => prev.filter((u) => u.id !== id));
    try {
      const res = await api.delete(`/owner/account/co-owners/${encodeURIComponent(id)}`);
      if (res.success) {
        flashSuccess(t('userRemoved'));
      } else {
        setCoOwners(previous);
        flashError(res.error?.message ?? t('userRemoveFailed'));
      }
    } catch {
      setCoOwners(previous);
      flashError(t('userRemoveFailed'));
    }
  };

  // Real resend — POST /owner/account/co-owners/:id/resend rotates the token and
  // re-enqueues a fresh email. Failure surfaces a genuine error (never the
  // success copy).
  const handleResendInvite = async (id: string) => {
    try {
      const res = await api.post(`/owner/account/co-owners/${encodeURIComponent(id)}/resend`);
      if (res.success) {
        flashSuccess(t('invitationResent'));
      } else {
        flashError(res.error?.message ?? t('invitationResendFailed'));
      }
    } catch {
      flashError(t('invitationResendFailed'));
    }
  };

  // Real password change — POST /owner/account/security/password (bcrypt-backed).
  const handleUpdatePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      flashError('Passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      const res = await api.post('/owner/account/security/password', passwordForm);
      if (res.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        flashSuccess(t('savedSuccess'));
      } else {
        flashError(res.error?.message ?? 'Failed to update password');
      }
    } catch {
      flashError('Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Real 2FA enrollment — step 1: POST /auth/mfa/enroll returns the otpauth URI
  // + manual key + recovery codes. We render the QR + a 6-digit confirm INLINE
  // in the Security tab (no listener-less window event). The secret is held in
  // component state only until confirmation; it is never persisted server-side
  // until /auth/mfa/confirm succeeds.
  const handleEnable2fa = async () => {
    setEnrolling(true);
    try {
      const res = await api.post<{
        secret: string;
        otpauth: string;
        recoveryCodes: string[];
      }>('/auth/mfa/enroll', {
        accountName: user?.email ?? 'owner',
        issuer: 'BossNyumba',
      });
      if (res.success && res.data?.otpauth && res.data?.secret) {
        setMfaEnroll({
          secret: res.data.secret,
          otpauth: res.data.otpauth,
          recoveryCodes: res.data.recoveryCodes ?? [],
        });
        setMfaCode('');
      } else {
        flashError(res.error?.message ?? t('twoFactorStartFailed'));
      }
    } catch {
      flashError(t('twoFactorStartFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  // Step 2: POST /auth/mfa/confirm with the scanned secret + the 6-digit code.
  // Only AFTER the server verifies the TOTP do we mark the account enrolled.
  const handleConfirm2fa = async () => {
    if (!mfaEnroll) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      flashError(t('twoFactorCodeInvalid'));
      return;
    }
    setConfirming(true);
    try {
      const res = await api.post<{ verified: boolean; enrolled: boolean }>(
        '/auth/mfa/confirm',
        { secret: mfaEnroll.secret, code: mfaCode },
      );
      if (res.success && res.data?.enrolled) {
        setTwoFa((prev) => ({ ...prev, enrolled: true }));
        setMfaEnroll(null);
        setMfaCode('');
        flashSuccess(t('twoFactorEnabled'));
      } else {
        flashError(res.error?.message ?? t('twoFactorCodeInvalid'));
      }
    } catch {
      flashError(t('twoFactorConfirmFailed'));
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel2fa = () => {
    setMfaEnroll(null);
    setMfaCode('');
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
              {/* Avatar shows the owner's initials. The "Change Photo" control
                  was removed: no avatar-upload flow exists anywhere in the
                  owner-portal frontend (no upload route, handler, or input —
                  `avatarUrl` is read-only in AuthContext), so a button here
                  could only ever be dead. It returns when an upload flow lands. */}
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="settings-first-name" className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                  <input
                    id="settings-first-name"
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="settings-last-name" className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                  <input
                    id="settings-last-name"
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                <input
                  id="settings-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="settings-phone" className="block text-sm font-medium text-gray-700 mb-1">{t('phoneNumber')}</label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder={t('phonePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="settings-org" className="block text-sm font-medium text-gray-700 mb-1">{t('organization')}</label>
                <input id="settings-org" type="text" defaultValue={tenant?.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !profileForm.firstName.trim() || !profileForm.email.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? t('savingLoading') : t('saveChanges')}
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-xl">
              <p className="text-sm text-gray-500">{t('notifDesc')}</p>

              <div className="space-y-4">
                {[
                  { id: 'payment', label: t('notifPayment'), desc: t('notifPaymentDesc') },
                  { id: 'maintenance', label: t('notifMaintenance'), desc: t('notifMaintenanceDesc') },
                  { id: 'approval', label: t('notifApproval'), desc: t('notifApprovalDesc') },
                  { id: 'overdue', label: t('notifOverdue'), desc: t('notifOverdueDesc') },
                  { id: 'weekly', label: t('notifWeekly'), desc: t('notifWeeklyDesc') },
                  { id: 'monthly', label: t('notifMonthly'), desc: t('notifMonthlyDesc') },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationPrefs[item.id] ?? false}
                        onChange={(e) =>
                          setNotificationPrefs((prev) => ({ ...prev, [item.id]: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
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
                    <label htmlFor="settings-current-password" className="block text-sm font-medium text-gray-700 mb-1">{t('currentPassword')}</label>
                    <input
                      id="settings-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-new-password" className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword')}</label>
                    <input
                      id="settings-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">{t('confirmNewPassword')}</label>
                    <input
                      id="settings-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdatePassword}
                    disabled={
                      updatingPassword ||
                      !passwordForm.currentPassword ||
                      passwordForm.newPassword.length < 8 ||
                      passwordForm.newPassword !== passwordForm.confirmPassword
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updatingPassword ? t('savingLoading') : t('updatePassword')}
                  </button>
                </div>
              </div>

              <hr />

              <div>
                <h3 className="font-medium text-gray-900 mb-4">{t('twoFactor')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('twoFactorDesc')}</p>
                {!twoFa.available ? (
                  // Honest disabled affordance — MFA is not configured for this
                  // deployment. No dead button.
                  <button
                    type="button"
                    disabled
                    title={t('twoFactorComingSoon')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-400 cursor-not-allowed"
                  >
                    <Key className="h-4 w-4" />
                    {t('twoFactorComingSoon')}
                  </button>
                ) : twoFa.enrolled ? (
                  <span className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    {t('twoFactorEnabledBadge')}
                  </span>
                ) : mfaEnroll ? (
                  // Inline enrollment: scannable QR (rendered client-side, the
                  // secret never leaves the browser) + manual key + 6-digit
                  // confirm. Calls /auth/mfa/confirm; only then is 2FA enabled.
                  <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">{t('twoFactorScanHint')}</p>
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                      <QrCode value={mfaEnroll.otpauth} size={176} className="rounded border border-gray-200" />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">{t('twoFactorManualKey')}</p>
                        <code className="block break-all rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-800">
                          {mfaEnroll.secret}
                        </code>
                        {mfaEnroll.recoveryCodes.length > 0 && (
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer">{t('twoFactorRecoveryCodes')}</summary>
                            <div className="mt-1 grid grid-cols-2 gap-1 font-mono">
                              {mfaEnroll.recoveryCodes.map((rc) => (
                                <span key={rc}>{rc}</span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="settings-mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('twoFactorEnterCode')}
                      </label>
                      <input
                        id="settings-mfa-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleConfirm2fa}
                        disabled={confirming || mfaCode.length !== 6}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {confirming ? t('savingLoading') : t('twoFactorConfirm')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel2fa}
                        disabled={confirming}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnable2fa}
                    disabled={enrolling}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Key className="h-4 w-4" />
                    {enrolling ? t('savingLoading') : t('enable2fa')}
                  </button>
                )}
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
                            {member.properties.length > 1
                              ? t('propertiesCount', { count: member.properties.length })
                              : member.properties.length === 1
                                ? member.properties[0]
                                : t('propertiesNone')}
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
                            {/* PENDING invites are the only locally-actionable
                                rows: the backend resend + revoke (DELETE) paths
                                operate on pending invites. Remove on an ACTIVE
                                member would be a silent no-op, so it is gated
                                out (no active-member offboard route exists yet).
                                Edit had no handler and is removed until an
                                edit-member route lands. */}
                            {member.role !== 'OWNER' && member.status === 'PENDING' && (
                              <>
                                <button onClick={() => handleResendInvite(member.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title={t('resendInvite')}>
                                  <Mail className="h-4 w-4" />
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
                <label htmlFor="settings-language" className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                <select
                  id="settings-language"
                  value={prefs.language}
                  onChange={(e) => setPrefs({ ...prefs, language: e.target.value as 'en' | 'sw' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">{t('langEnglish')}</option>
                  <option value="sw">{t('langSwahili')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-timezone" className="block text-sm font-medium text-gray-700 mb-1">{t('timezone')}</label>
                <select
                  id="settings-timezone"
                  value={prefs.timezone}
                  onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Africa/Dar_es_Salaam">{t('tzEat')}</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-currency" className="block text-sm font-medium text-gray-700 mb-1">{t('currency')}</label>
                <select
                  id="settings-currency"
                  value={prefs.currency}
                  onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TZS">{t('currencyTzs')}</option>
                  <option value="USD">{t('currencyUsd')}</option>
                  <option value="KES">KES</option>
                  <option value="UGX">UGX</option>
                  <option value="NGN">NGN</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-date-format" className="block text-sm font-medium text-gray-700 mb-1">{t('dateFormat')}</label>
                <select
                  id="settings-date-format"
                  value={prefs.dateFormat}
                  onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-user-title"
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowInviteModal(false)}
              aria-hidden="true"
            />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 id="invite-user-title" className="text-lg font-semibold text-gray-900">{t('inviteUser')}</h3>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  aria-label={t('cancel')}
                  className="p-2 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                    <input id="invite-first-name" type="text" value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                    <input id="invite-last-name" type="text" value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                  <input id="invite-email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">{t('colRole')}</label>
                  <select id="invite-role" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="VIEWER">{t('roleViewer')}</option>
                    <option value="CO_OWNER">{t('roleCoOwner')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('propertyAccess')}</label>
                  <div className="space-y-2 mt-2">
                    {portfolioLoading && (
                      <p className="text-sm text-gray-400">{t('propertyAccessLoading')}</p>
                    )}
                    {!portfolioLoading && (portfolio ?? []).length === 0 && (
                      <p className="text-sm text-gray-400">{t('propertyAccessEmpty')}</p>
                    )}
                    {(portfolio ?? []).map((property) => (
                      <label key={property.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={inviteForm.properties.includes(property.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteForm({ ...inviteForm, properties: [...inviteForm.properties, property.id] });
                            } else {
                              setInviteForm({ ...inviteForm, properties: inviteForm.properties.filter((p) => p !== property.id) });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{property.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t">
                <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
                  {t('cancel')}
                </button>
                <button onClick={handleInviteUser} disabled={inviting || !inviteForm.email || !inviteForm.firstName} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Mail className="h-4 w-4" />
                  {inviting ? t('savingLoading') : t('sendInvitation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
