'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { usersApi } from '@/lib/api';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
});

type ProfileFormState = z.infer<typeof profileSchema>;

const emptyForm: ProfileFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<ProfileFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: () => usersApi.me(),
    retry: false,
  });

  const user = data?.data;

  useEffect(() => {
    if (user) {
      setFormState({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormState) => usersApi.updateProfile(values),
    onSuccess: (resp) => {
      if (resp.success === false) {
        setErrors({ form: resp.error?.message ?? 'Failed to update profile' });
        return;
      }
      setSuccessMessage('Profile updated');
      void queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
    },
    onError: (err) => {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to update profile',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);
    const parsed = profileSchema.safeParse(formState);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    updateMutation.mutate(parsed.data);
  };

  const loadError =
    error instanceof Error
      ? error.message
      : data && !data.success
      ? data.error?.message
      : undefined;

  return (
    <>
      <PageHeader title="Profile Settings" showBack />

      <form
        onSubmit={handleSubmit}
        className="px-4 py-4 space-y-6 max-w-2xl mx-auto"
      >
        {loadError && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{loadError}</div>
          </div>
        )}

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

        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center relative overflow-hidden">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-primary-600" />
            )}
          </div>
          {user?.role && <p className="text-sm text-gray-500 mt-2">{user.role}</p>}
        </div>

        <div className="card p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading profile...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formState.firstName}
                    onChange={(e) =>
                      setFormState({ ...formState, firstName: e.target.value })
                    }
                  />
                  {errors.firstName && (
                    <p className="text-xs text-danger-600 mt-1">
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formState.lastName}
                    onChange={(e) =>
                      setFormState({ ...formState, lastName: e.target.value })
                    }
                  />
                  {errors.lastName && (
                    <p className="text-xs text-danger-600 mt-1">
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={formState.email}
                  onChange={(e) =>
                    setFormState({ ...formState, email: e.target.value })
                  }
                />
                {errors.email && (
                  <p className="text-xs text-danger-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+254..."
                  value={formState.phone ?? ''}
                  onChange={(e) =>
                    setFormState({ ...formState, phone: e.target.value })
                  }
                />
              </div>

              {user?.role && (
                <div>
                  <label className="label">Role</label>
                  <input
                    type="text"
                    className="input opacity-60"
                    value={user.role}
                    disabled
                  />
                </div>
              )}
            </>
          )}
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
            disabled={updateMutation.isPending || isLoading}
          >
            {updateMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </>
  );
}
