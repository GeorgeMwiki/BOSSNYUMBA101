'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parcelsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function NewParcelPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await parcelsService.create({
        parcelCode: formData.get('parcelCode') as string,
        name: formData.get('name') as string,
        type: formData.get('type') as string,
        totalAreaSqm: Number(formData.get('totalAreaSqm') || 0),
        description: formData.get('description') as string || undefined,
        region: formData.get('region') as string || undefined,
        city: formData.get('city') as string || undefined,
        addressLine1: formData.get('addressLine1') as string || undefined,
        latitude: formData.get('latitude') ? Number(formData.get('latitude')) : undefined,
        longitude: formData.get('longitude') ? Number(formData.get('longitude')) : undefined,
        mapUrl: formData.get('mapUrl') as string || undefined,
        titleDeedNumber: formData.get('titleDeedNumber') as string || undefined,
        cadastralReference: formData.get('cadastralReference') as string || undefined,
        surveyorName: formData.get('surveyorName') as string || undefined,
        surveyDate: formData.get('surveyDate') as string || undefined,
        nearRailwayReserve: formData.get('nearRailwayReserve') === 'on',
        requiresCivilEngNotification: formData.get('requiresCivilEngNotification') === 'on',
      });
      router.push('/parcels');
    } catch (err) {
      setError((err as Error).message || 'Failed to create parcel');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Add Land Parcel" showBack />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Parcel Code *</label>
                <input type="text" name="parcelCode" className="input" placeholder="e.g., PRC-DAR-001" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name *</label>
                <input type="text" name="name" className="input" placeholder="Parcel name" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type *</label>
                <select name="type" className="input" required>
                  <option value="">Select type</option>
                  <option value="bareland">Bareland</option>
                  <option value="railway_reserve">Railway Reserve</option>
                  <option value="commercial">Commercial</option>
                  <option value="residential">Residential</option>
                  <option value="industrial">Industrial</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Total Area (sqm) *</label>
                <input type="number" name="totalAreaSqm" className="input" placeholder="0" required />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Description</label>
              <textarea name="description" className="input" rows={2} placeholder="Describe the parcel..." />
            </div>
          </div>

          {/* Location */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Region</label>
                <input type="text" name="region" className="input" placeholder="e.g., Dar es Salaam" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">City</label>
                <input type="text" name="city" className="input" placeholder="e.g., Dar es Salaam" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Address</label>
              <input type="text" name="addressLine1" className="input" placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Latitude</label>
                <input type="number" name="latitude" step="any" className="input" placeholder="-6.7924" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Longitude</label>
                <input type="number" name="longitude" step="any" className="input" placeholder="39.2083" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Google Maps URL</label>
              <input type="url" name="mapUrl" className="input" placeholder="https://maps.google.com/..." />
            </div>
          </div>

          {/* Railway Reserve & District */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Classification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">District</label>
                <select className="input">
                  <option value="">Select district</option>
                  <option value="DAR">Dar es Salaam</option>
                  <option value="DOD">Dodoma</option>
                  <option value="TAB">Tabora</option>
                  <option value="TAN">Tanga</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Station</label>
                <select className="input">
                  <option value="">Select station</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="nearRailwayReserve" className="rounded border-gray-300" />
                <span>Near Railway Reserve</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresCivilEngNotification" className="rounded border-gray-300" />
                <span>Requires Civil Engineering Notification</span>
              </label>
            </div>
          </div>

          {/* Legal */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Legal & Survey</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Title Deed Number</label>
                <input type="text" name="titleDeedNumber" className="input" placeholder="Title deed ref" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cadastral Reference</label>
                <input type="text" name="cadastralReference" className="input" placeholder="Cadastral ref" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Surveyor Name</label>
                <input type="text" name="surveyorName" className="input" placeholder="Surveyor" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Survey Date</label>
                <input type="date" name="surveyDate" className="input" />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => router.back()}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Parcel'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
