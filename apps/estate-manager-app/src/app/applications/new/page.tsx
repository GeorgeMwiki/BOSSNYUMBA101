'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Upload } from 'lucide-react';

export default function NewApplicationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      router.push('/applications');
    }, 1000);
  };

  return (
    <>
      <PageHeader title="Digitize Application" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Letter Upload */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Application Letter</h3>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Upload scanned application letter</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, or PNG</p>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Received Date *</label>
                <input type="date" className="input" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Received At *</label>
                <select className="input" required>
                  <option value="station">Station</option>
                  <option value="hq">HQ Directly</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Receiving Station</label>
              <select className="input">
                <option value="">Select station (if applicable)</option>
              </select>
            </div>
          </div>

          {/* Applicant Info */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Applicant Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Applicant Name *</label>
                <input type="text" className="input" placeholder="Full name" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                <input type="tel" className="input" placeholder="+255..." />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input type="email" className="input" placeholder="email@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Address</label>
              <input type="text" className="input" placeholder="Applicant address" />
            </div>
          </div>

          {/* Application Details */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Application Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Application Type *</label>
                <select className="input" required>
                  <option value="">Select type</option>
                  <option value="new_lease">New Lease</option>
                  <option value="lease_renewal">Lease Renewal</option>
                  <option value="bareland_lease">Bareland Lease</option>
                  <option value="transfer">Transfer</option>
                  <option value="modification">Modification</option>
                  <option value="termination">Termination</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Asset Type</label>
                <select className="input">
                  <option value="">Select asset type</option>
                  <option value="building">Building</option>
                  <option value="unit">Unit/Space</option>
                  <option value="bareland">Bareland</option>
                  <option value="portion">Parcel Portion</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Requested Location</label>
                <input type="text" className="input" placeholder="Location description" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Requested Size</label>
                <input type="text" className="input" placeholder="e.g., 500 sqm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Proposed Rent (TZS/month)</label>
                <input type="number" className="input" placeholder="0" />
                <p className="text-xs text-gray-400 mt-1">500,000+ requires DG approval</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Lease Term (months)</label>
                <input type="number" className="input" placeholder="12" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Purpose of Use</label>
              <textarea className="input" rows={2} placeholder="Describe intended use..." />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => router.back()}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Application'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
