'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getApiClient } from '@bossnyumba/api-client';
import { User, Camera, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await getApiClient().post('/users/me/avatar', formData);
    } catch {
      // Avatar upload failed silently - user can retry
    }
    setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const [formData, setFormData] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await getApiClient().get<UserProfile>('/users/me');
      return response.data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        role: profile.role ?? '',
      });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async (data: UserProfile) => {
      const response = await getApiClient().put<UserProfile>('/users/me', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      });
      return response.data;
    },
    onSuccess: () => {
      router.push('/settings');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Profile Settings" showBack />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Profile Settings" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center relative">
            {avatarUploading ? (
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            ) : (
              <User className="w-12 h-12 text-primary-600" />
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <p className="text-sm text-gray-500 mt-2">Tap to change photo</p>
        </div>

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                type="text"
                className="input"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                type="text"
                className="input"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              className="input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+255..."
            />
          </div>

          <div>
            <label className="label">Role</label>
            <input
              type="text"
              className="input opacity-50"
              value={formData.role}
              disabled
            />
          </div>

          {saveMutation.isError && (
            <p className="text-sm text-red-600">
              {(saveMutation.error as Error)?.message || 'Failed to save profile'}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}
