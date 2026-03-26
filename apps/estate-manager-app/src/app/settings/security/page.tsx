'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { getApiClient } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validate = (): boolean => {
    const errors: string[] = [];
    if (!formData.currentPassword) errors.push('Current password is required.');
    if (!formData.newPassword) errors.push('New password is required.');
    if (formData.newPassword.length < 8) errors.push('New password must be at least 8 characters.');
    if (formData.newPassword !== formData.confirmPassword) errors.push('Passwords do not match.');
    if (formData.currentPassword === formData.newPassword) errors.push('New password must be different from current password.');
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = getApiClient();
      await client.put('/users/me/password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      router.push('/settings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <>
      <PageHeader title="Security" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {validationErrors.length > 0 && (
          <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-700 space-y-1">
            {validationErrors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </>
  );
}
