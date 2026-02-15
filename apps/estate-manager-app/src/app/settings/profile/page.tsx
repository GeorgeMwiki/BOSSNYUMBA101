'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Camera } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Manager',
    email: 'john.manager@estate.com',
    phone: '+254 700 123 456',
    role: 'Estate Manager',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app: API call to update profile
    router.push('/settings');
  };

  return (
    <>
      <PageHeader title="Profile Settings" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center relative">
            <User className="w-12 h-12 text-primary-600" />
            <button
              type="button"
              className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full"
            >
              <Camera className="w-4 h-4" />
            </button>
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
              placeholder="+254..."
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
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1">
            Save Changes
          </button>
        </div>
      </form>
    </>
  );
}
