'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AlertCircle, Loader2, Mail, Phone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/profile/Avatar';
import { api, type CustomerProfile } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .or(z.literal(''))
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d[\d\s]{7,}$/, 'Enter a valid phone number')
    .or(z.literal(''))
    .optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z
    .string()
    .trim()
    .regex(/^\+?\d[\d\s]{7,}$/, 'Enter a valid phone number')
    .or(z.literal(''))
    .optional(),
});

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

function profileToForm(p: CustomerProfile | undefined): FormState {
  if (!p) return EMPTY;
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  };
}

export default function EditProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const profileQuery = useQuery<CustomerProfile>({
    queryKey: ['profile'],
    queryFn: () => api.profile.get(),
  });

  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setFormData(profileToForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(formData);
      return api.profile.update(parsed);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      toast.success('Profile updated');
      setTimeout(() => router.back(), 500);
    },
    onError: (err: unknown) => {
      if (err instanceof z.ZodError) {
        setFieldError(err.issues[0]?.message ?? 'Please check your input');
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to update profile',
        'Update failed'
      );
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    updateMutation.mutate();
  };

  const emailVerified = profileQuery.data?.emailVerified ?? false;
  const phoneVerified = profileQuery.data?.phoneVerified ?? false;

  if (profileQuery.isLoading) {
    return (
      <>
        <PageHeader title="Edit Profile" showBack />
        <div className="flex items-center justify-center gap-2 px-4 py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading profile...
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Profile" showBack />

      <form onSubmit={handleSave} className="space-y-6 px-4 py-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={`${formData.firstName} ${formData.lastName}`.trim() || 'Resident'}
            size="lg"
          />
          <div>
            <h3 className="font-medium text-white">Profile photo</h3>
            <p className="text-sm text-gray-400">Photo upload coming soon</p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                className="input"
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="label">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                className="input"
                placeholder="Last name"
                required
              />
            </div>
          </div>
        </section>

        <section>
          <label htmlFor="email" className="label">
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="input pl-10"
              placeholder="email@example.com"
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            {emailVerified && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-400">
                Verified
              </span>
            )}
          </div>
        </section>

        <section>
          <label htmlFor="phone" className="label">
            Phone number
          </label>
          <div className="relative">
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="input pl-10"
              placeholder="+254 7XX XXX XXX"
            />
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            {phoneVerified && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-400">
                Verified
              </span>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Emergency Contact</h3>
          <div>
            <label htmlFor="emergencyContactName" className="label">
              Contact name
            </label>
            <input
              id="emergencyContactName"
              name="emergencyContactName"
              type="text"
              value={formData.emergencyContactName}
              onChange={handleChange}
              className="input"
              placeholder="Full name"
            />
          </div>
          <div>
            <label htmlFor="emergencyContactPhone" className="label">
              Contact phone
            </label>
            <input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={handleChange}
              className="input"
              placeholder="+254 7XX XXX XXX"
            />
          </div>
        </section>

        {fieldError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-4 text-red-300">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">{fieldError}</span>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn-primary flex-1"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
