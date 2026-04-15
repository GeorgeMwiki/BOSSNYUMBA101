'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { usersApi } from '@/lib/api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const emptyForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<PasswordForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: Pick<PasswordForm, 'currentPassword' | 'newPassword'>) =>
      usersApi.changePassword(values),
    onSuccess: (resp: { success?: boolean; error?: { message?: string } }) => {
      if (resp?.success === false) {
        setErrors({ form: resp.error?.message ?? 'Failed to change password' });
        return;
      }
      setSuccessMessage('Password updated. Use your new password on next sign-in.');
      setFormData(emptyForm);
    },
    onError: (err) => {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to change password',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);
    const parsed = passwordSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    mutation.mutate({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  };

  return (
    <>
      <PageHeader title="Security" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {errors.form && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errors.form}</div>
          </div>
        )}

        {successMessage && (
          <div className="card p-3 flex items-start gap-2 border-success-200 bg-success-50 text-success-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{successMessage}</div>
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              value={formData.currentPassword}
              onChange={(e) =>
                setFormData({ ...formData, currentPassword: e.target.value })
              }
              placeholder="Enter current password"
              autoComplete="current-password"
            />
            {errors.currentPassword && (
              <p className="text-xs text-danger-600 mt-1">{errors.currentPassword}</p>
            )}
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              value={formData.newPassword}
              onChange={(e) =>
                setFormData({ ...formData, newPassword: e.target.value })
              }
              placeholder="Enter new password"
              autoComplete="new-password"
            />
            {errors.newPassword && (
              <p className="text-xs text-danger-600 mt-1">{errors.newPassword}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 8 characters with upper, lower, and a number.
            </p>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-danger-600 mt-1">{errors.confirmPassword}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </div>
      </form>
    </>
  );
}
