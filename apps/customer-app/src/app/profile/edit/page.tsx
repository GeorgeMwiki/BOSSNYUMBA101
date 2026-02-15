'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/profile/Avatar';

// Mock initial data
const initialData = {
  firstName: 'John',
  lastName: 'Kamau',
  email: 'john.kamau@example.com',
  phone: '+254 712 345 678',
  emergencyContactName: 'Mary Kamau',
  emergencyContactPhone: '+254 723 456 789',
};

export default function EditProfilePage() {
  const router = useRouter();
  const [formData, setFormData] = useState(initialData);
  const [emailVerified] = useState(true);
  const [phoneVerified] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setTimeout(() => router.back(), 1500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Edit Profile" showBack />

      <form onSubmit={handleSave} className="px-4 py-4 space-y-6">
        {/* Profile Picture */}
        <div className="flex items-center gap-4">
          <Avatar
            name={`${formData.firstName} ${formData.lastName}`}
            size="lg"
          />
          <div>
            <h3 className="font-medium text-gray-900">Profile photo</h3>
            <p className="text-sm text-gray-500">Tap to change</p>
          </div>
          <button type="button" className="btn-secondary text-sm ml-auto">
            Change
          </button>
        </div>

        {/* Name Fields */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Personal Information</h3>
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
              />
            </div>
          </div>
        </section>

        {/* Email with verification */}
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
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {emailVerified && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-success-600 font-medium">
                Verified
              </span>
            )}
          </div>
          {!emailVerified && (
            <button type="button" className="text-sm text-primary-600 mt-1">
              Verify email
            </button>
          )}
        </section>

        {/* Phone with verification */}
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
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {phoneVerified && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-success-600 font-medium">
                Verified
              </span>
            )}
          </div>
          {!phoneVerified && (
            <button type="button" className="text-sm text-primary-600 mt-1">
              Verify phone
            </button>
          )}
        </section>

        {/* Emergency Contact */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Emergency Contact</h3>
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

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-success-50 text-success-700'
                : 'bg-danger-50 text-danger-700'
            }`}
          >
            {message.type === 'error' && (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
